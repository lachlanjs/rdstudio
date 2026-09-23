"""Optional papis backend: reference stubs in the bundle, and cheap access to
bibliographic metadata and PDF text for agents.

papis stores one directory per document with an ``info.yaml``; this module
reads those files directly, so papis itself is not a dependency. Configure in
``rdstudio.toml``::

    [references]
    backend = "papis"
    library = "thesis"        # a papis library name (from ~/.config/papis/config)
    # path = "~/papis/thesis" # or the library directory itself
    directory = "references"  # where stubs live in the knowledge bundle
"""

from __future__ import annotations

import configparser
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .config import Config
from .okf import now, render_concept
from .search import tokenize

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


class ReferenceError(RuntimeError):
    pass


@dataclass
class Entry:
    ref: str
    folder: Path
    info: dict[str, Any] = field(repr=False)

    @property
    def title(self) -> str:
        return " ".join(str(self.info.get("title") or self.ref).split())

    @property
    def authors(self) -> list[str]:
        out = []
        for a in self.info.get("author_list") or []:
            if isinstance(a, dict):
                name = " ".join(str(x) for x in (a.get("given"), a.get("family")) if x)
                if name:
                    out.append(name)
        if not out and self.info.get("author"):
            out = [s.strip() for s in str(self.info["author"]).split(" and ")]
        return out

    @property
    def year(self) -> str:
        return str(self.info.get("year") or "")

    @property
    def venue(self) -> str:
        return str(self.info.get("journal") or self.info.get("booktitle") or self.info.get("publisher") or "")

    @property
    def url(self) -> str:
        doi = self.info.get("doi")
        return f"https://doi.org/{doi}" if doi else str(self.info.get("url") or "")

    @property
    def pdfs(self) -> list[Path]:
        files = self.info.get("files") or []
        return [self.folder / f for f in files if str(f).lower().endswith(".pdf") and (self.folder / f).exists()]

    def citation(self) -> str:
        names = self.authors
        who = names[0].split()[-1] + (" et al." if len(names) > 2 else f" and {names[1].split()[-1]}" if len(names) == 2 else "") if names else "Anon."
        return f"{who} ({self.year or 'n.d.'}). {self.title}." + (f" {self.venue}." if self.venue else "")

    def summary(self) -> dict[str, Any]:
        return {
            "ref": self.ref, "title": self.title, "authors": self.authors, "year": self.year,
            "venue": self.venue, "url": self.url, "tags": _tags(self.info), "has_pdf": bool(self.pdfs),
        }


def _tags(info: dict[str, Any]) -> list[str]:
    tags = info.get("tags") or []
    if isinstance(tags, str):
        tags = re.split(r"[,\s]+", tags)
    return [str(t) for t in tags if t]


def library_path(cfg: Config) -> Path:
    ref_cfg = cfg.raw.get("references", {})
    if ref_cfg.get("path"):
        return Path(ref_cfg["path"]).expanduser()
    papis_cfg = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "papis" / "config"
    parser = configparser.ConfigParser()
    parser.read(papis_cfg)
    name = ref_cfg.get("library") or parser.get("settings", "default-library", fallback=None)
    if name and parser.has_section(name) and parser.has_option(name, "dir"):
        return Path(parser.get(name, "dir")).expanduser()
    raise ReferenceError("no papis library configured: set [references] library or path in rdstudio.toml")


def enabled(cfg: Config) -> bool:
    return cfg.raw.get("references", {}).get("backend") == "papis"


def stub_dir(cfg: Config) -> str:
    return str(cfg.raw.get("references", {}).get("directory", "references")).strip("/")


def load(cfg: Config) -> dict[str, Entry]:
    root = library_path(cfg)
    if not root.is_dir():
        raise ReferenceError(f"papis library not found at {root}")
    entries: dict[str, Entry] = {}
    for info_path in sorted(root.glob("*/info.yaml")):
        try:
            info = yaml.safe_load(info_path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError:
            continue
        ref = str(info.get("ref") or info_path.parent.name)
        entries[ref] = Entry(ref, info_path.parent, info)
    return entries


def stub_id(cfg: Config, ref: str) -> str:
    return f"{stub_dir(cfg)}/{_SAFE.sub('-', ref)}"


def sync_stubs(cfg: Config) -> list[str]:
    """Create a ``type: Reference`` concept for every papis entry that lacks one.
    Existing concepts are never modified."""
    created = []
    for ref, e in load(cfg).items():
        cid = stub_id(cfg, ref)
        path = cfg.knowledge_dir / f"{cid}.md"
        if path.exists():
            continue
        meta: dict[str, Any] = {
            "type": "Reference",
            "title": e.title,
            "description": e.citation(),
        }
        if e.url:
            meta["resource"] = e.url
        tags = _tags(e.info)
        if tags:
            meta["tags"] = tags
        meta["papis"] = {"ref": ref}
        meta["generated"] = {"by": "process:rdstudio-refs", "at": now()}
        body = (
            "# Summary\n\nNot yet summarised.\n\n"
            "# Relevance\n\nHow this bears on the project: which decisions, questions or designs it supports or challenges.\n"
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_concept(meta, body), encoding="utf-8")
        created.append(cid)
    return created


def search(cfg: Config, query: str, limit: int = 8) -> list[dict[str, Any]]:
    terms = set(tokenize(query))
    scored = []
    for e in load(cfg).values():
        fields = [e.title] * 3 + [" ".join(e.authors)] * 2 + [" ".join(_tags(e.info)), str(e.info.get("abstract") or ""), e.venue]
        tokens = tokenize(" ".join(fields))
        score = sum(tokens.count(t) for t in terms)
        if e.ref.lower() in query.lower():
            score += 10
        if score:
            scored.append((score, e))
    scored.sort(key=lambda x: (-x[0], x[1].ref))
    return [{**e.summary(), "concept": stub_id(cfg, e.ref)} for _, e in scored[:limit]]


def text_pages(cfg: Config, ref: str) -> list[str]:
    """Plain text of an entry's first PDF, one string per page, cached under the
    build output directory."""
    entries = load(cfg)
    if ref not in entries:
        raise ReferenceError(f"no papis entry {ref!r}")
    e = entries[ref]
    if not e.pdfs:
        raise ReferenceError(f"{ref} has no PDF attached")
    pdf = e.pdfs[0]
    cache = cfg.output_dir / "cache" / "text" / f"{_SAFE.sub('-', ref)}.txt"
    if not cache.exists() or cache.stat().st_mtime < pdf.stat().st_mtime:
        if not shutil.which("pdftotext"):
            raise ReferenceError("pdftotext (poppler) is not installed")
        cache.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["pdftotext", "-layout", str(pdf), str(cache)], check=True, capture_output=True, timeout=120)
    pages = cache.read_text(encoding="utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()  # pdftotext ends every page, including the last, with a form feed
    return pages


def text(cfg: Config, ref: str, *, pages: str | None = None, query: str | None = None, max_chars: int = 6000) -> str:
    all_pages = text_pages(cfg, ref)
    n = len(all_pages)
    chosen: list[int] = []
    if pages:
        for part in pages.split(","):
            if "-" in part:
                a, b = part.split("-", 1)
                chosen.extend(range(int(a), int(b) + 1))
            elif part.strip():
                chosen.append(int(part))
    elif query:
        terms = set(tokenize(query))
        ranked = sorted(range(1, n + 1), key=lambda p: -sum(tokenize(all_pages[p - 1]).count(t) for t in terms))
        chosen = sorted(p for p in ranked[:2] if any(t in tokenize(all_pages[p - 1]) for t in terms))
    else:
        chosen = [1]
    out = []
    for p in chosen:
        if 1 <= p <= n:
            out.append(f"--- page {p} of {n} ---\n{all_pages[p - 1].strip()}")
    result = "\n\n".join(out) or f"No matching pages (the PDF has {n} pages)."
    return result if len(result) <= max_chars else result[:max_chars] + f"\n[truncated; ask for fewer pages]"
