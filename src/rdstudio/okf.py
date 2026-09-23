"""Open Knowledge Format (OKF v0.2) bundle model.

Parses a bundle directory into concepts, directories and links, derives trust
tiers and staleness, lints conformance, and generates ``index.md`` files.
The spec in ``reference/OKF_SPEC.md`` is the ground truth for everything here.
"""

from __future__ import annotations

import posixpath
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import yaml

OKF_VERSION = "0.2"
RESERVED = {"index.md", "log.md"}

_FENCE = re.compile(r"^\s*(```|~~~)")
_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_INLINE_CODE = re.compile(r"`[^`\n]*`")
_LINK = re.compile(r"(?<!!)\[(?P<text>[^\]]*)\]\((?P<target><[^>]+>|[^)\s]+)(?:\s+\"[^\"]*\")?\)")
_REF_DEF = re.compile(r"^\s{0,3}\[(?!\^)[^\]]+\]:\s*(?P<target>\S+)", re.M)
_SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
_LOG_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# --------------------------------------------------------------------------- #
# Frontmatter
# --------------------------------------------------------------------------- #


class FrontmatterError(ValueError):
    pass


def split_frontmatter(text: str) -> tuple[dict[str, Any] | None, str]:
    """Return ``(frontmatter, body)``; frontmatter is None when absent."""
    if text.startswith("﻿"):
        text = text[1:]
    if not text.startswith("---"):
        return None, text
    lines = text.split("\n")
    if lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            raw = "\n".join(lines[1:i])
            body = "\n".join(lines[i + 1 :])
            try:
                meta = yaml.safe_load(raw) if raw.strip() else {}
            except yaml.YAMLError as exc:
                raise FrontmatterError(f"unparseable YAML frontmatter: {exc}") from exc
            if meta is None:
                meta = {}
            if not isinstance(meta, dict):
                raise FrontmatterError("frontmatter is not a mapping")
            return meta, body.lstrip("\n")
    raise FrontmatterError("frontmatter block is not closed with '---'")


class _Dumper(yaml.SafeDumper):
    pass


def _repr_datetime(dumper: yaml.SafeDumper, value: datetime) -> yaml.Node:
    return dumper.represent_scalar("tag:yaml.org,2002:timestamp", iso(value))


def _repr_str(dumper: yaml.SafeDumper, value: str) -> yaml.Node:
    style = "|" if "\n" in value else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)


def _repr_list(dumper: yaml.SafeDumper, value: list) -> yaml.Node:
    flat = all(isinstance(v, (str, int, float, bool)) and "\n" not in str(v) for v in value)
    return dumper.represent_sequence("tag:yaml.org,2002:seq", value, flow_style=flat and bool(value))


_Dumper.add_representer(datetime, _repr_datetime)
_Dumper.add_representer(str, _repr_str)
_Dumper.add_representer(list, _repr_list)


def dump_frontmatter(meta: dict[str, Any]) -> str:
    """Serialise frontmatter, preserving key order and writing ISO 8601 UTC times."""
    return yaml.dump(meta, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=100, default_flow_style=False)


def render_concept(meta: dict[str, Any], body: str) -> str:
    return f"---\n{dump_frontmatter(meta)}---\n\n{body.strip()}\n"


# --------------------------------------------------------------------------- #
# Time helpers
# --------------------------------------------------------------------------- #


def now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def to_datetime(value: Any) -> datetime | None:
    """Coerce a YAML timestamp (datetime, date or string) to an aware datetime."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.strip())
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def jsonable(value: Any) -> Any:
    """Convert frontmatter values to JSON-safe equivalents."""
    if isinstance(value, datetime):
        return iso(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


# --------------------------------------------------------------------------- #
# Markdown helpers
# --------------------------------------------------------------------------- #


def _strip_code(body: str) -> list[str]:
    """Body lines with fenced blocks blanked and inline code removed."""
    out: list[str] = []
    in_fence = False
    for line in body.split("\n"):
        if _FENCE.match(line):
            in_fence = not in_fence
            out.append("")
            continue
        out.append("" if in_fence else _INLINE_CODE.sub("", line))
    return out


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[\s_]+", "-", text)


@dataclass
class Heading:
    level: int
    text: str
    slug: str
    line: int


def headings(body: str) -> list[Heading]:
    out: list[Heading] = []
    for i, line in enumerate(_strip_code(body)):
        m = _HEADING.match(line)
        if m:
            text = m.group(2).strip()
            out.append(Heading(len(m.group(1)), text, slugify(text), i))
    return out


def section(body: str, heading: str) -> str | None:
    """Return the text under ``heading`` (matched by text or slug) up to the next
    heading of the same or higher level, including the heading line itself."""
    wanted = heading.strip().lstrip("#").strip().lower()
    wanted_slug = slugify(wanted)
    hs = headings(body)
    lines = body.split("\n")
    for idx, h in enumerate(hs):
        if h.text.lower() == wanted or h.slug == wanted_slug:
            end = len(lines)
            for later in hs[idx + 1 :]:
                if later.level <= h.level:
                    end = later.line
                    break
            return "\n".join(lines[h.line : end]).strip()
    return None


def link_targets(body: str) -> list[str]:
    text = "\n".join(_strip_code(body))
    targets = [m.group("target").strip("<>") for m in _LINK.finditer(text)]
    targets += [m.group("target").strip("<>") for m in _REF_DEF.finditer(text)]
    return targets


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #


@dataclass
class Link:
    target: str  # concept id, or directory id with trailing '/'
    kind: str  # "concept" | "directory"
    broken: bool = False


@dataclass
class Concept:
    id: str  # bundle path without .md, e.g. "design/overview"
    path: str  # bundle path, e.g. "design/overview.md"
    meta: dict[str, Any]
    body: str
    mtime: float = 0.0
    links: list[Link] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def directory(self) -> str:
        return posixpath.dirname(self.id)

    @property
    def type(self) -> str:
        t = self.meta.get("type")
        return str(t) if t not in (None, "") else ""

    @property
    def title(self) -> str:
        t = self.meta.get("title")
        if t:
            return str(t)
        stem = posixpath.basename(self.id)
        return stem.replace("-", " ").replace("_", " ").strip().capitalize() or stem

    @property
    def description(self) -> str:
        return str(self.meta.get("description") or "")

    @property
    def tags(self) -> list[str]:
        tags = self.meta.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        return [str(t) for t in tags]

    @property
    def status(self) -> str:
        return str(self.meta.get("status") or "stable")

    @property
    def generated(self) -> dict[str, Any]:
        g = self.meta.get("generated")
        return g if isinstance(g, dict) else {}

    @property
    def generated_at(self) -> datetime | None:
        return to_datetime(self.generated.get("at"))

    @property
    def verified(self) -> list[dict[str, Any]]:
        v = self.meta.get("verified")
        if isinstance(v, dict):
            return [v]
        if isinstance(v, list):
            return [e for e in v if isinstance(e, dict)]
        return []

    @property
    def trust(self) -> str:
        """``unverified`` | ``machine-confirmed`` | ``human-reviewed`` (OKF §5.3)."""
        events = self.verified
        if not events:
            return "unverified"
        if any(str(e.get("by", "")).startswith("human:") for e in events):
            return "human-reviewed"
        return "machine-confirmed"

    @property
    def last_human_verification(self) -> datetime | None:
        times = [
            to_datetime(e.get("at"))
            for e in self.verified
            if str(e.get("by", "")).startswith("human:")
        ]
        times = [t for t in times if t is not None]
        return max(times) if times else None

    @property
    def verification_stale(self) -> bool:
        """Human-reviewed, but meaningfully changed since the latest human check."""
        verified_at = self.last_human_verification
        generated_at = self.generated_at
        return bool(verified_at and generated_at and generated_at > verified_at)

    @property
    def content_stale(self) -> bool:
        """``stale_after`` has passed (OKF §5.5)."""
        at = to_datetime(self.meta.get("stale_after"))
        return bool(at and now() >= at)

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "path": self.path,
            "title": self.title,
            "type": self.type,
            "description": self.description,
            "tags": self.tags,
            "status": self.status,
            "trust": self.trust,
            "verification_stale": self.verification_stale,
            "content_stale": self.content_stale,
        }


@dataclass
class Directory:
    id: str  # "" for the root, otherwise "design" / "design/sub"
    concepts: list[str] = field(default_factory=list)
    children: list[str] = field(default_factory=list)
    has_index: bool = False
    has_log: bool = False

    @property
    def name(self) -> str:
        return posixpath.basename(self.id) if self.id else ""


@dataclass
class Issue:
    path: str
    level: str  # "error" | "warning"
    message: str


class Bundle:
    """An OKF bundle loaded from disk."""

    def __init__(self, root: Path, name: str = "project"):
        self.root = Path(root)
        self.name = name
        self.concepts: dict[str, Concept] = {}
        self.directories: dict[str, Directory] = {}
        self.issues: list[Issue] = []
        self.root_meta: dict[str, Any] = {}

    # ----------------------------------------------------------------- load

    @classmethod
    def load(cls, root: Path, name: str = "project") -> "Bundle":
        bundle = cls(root, name)
        bundle._scan()
        return bundle

    def _scan(self) -> None:
        self.directories[""] = Directory("")
        if not self.root.is_dir():
            return
        for path in sorted(self.root.rglob("*")):
            rel = path.relative_to(self.root).as_posix()
            if any(part.startswith(".") for part in rel.split("/")):
                continue
            if path.is_dir():
                self._ensure_dir(rel)
                continue
            if path.suffix != ".md":
                continue
            directory = posixpath.dirname(rel)
            self._ensure_dir(directory)
            if path.name == "index.md":
                self.directories[directory].has_index = True
                self._check_index(path, rel, directory)
                continue
            if path.name == "log.md":
                self.directories[directory].has_log = True
                self._check_log(path, rel)
                continue
            self._load_concept(path, rel)
        for concept in self.concepts.values():
            concept.links = [self._resolve(concept, t) for t in link_targets(concept.body)]
            concept.links = [l for l in concept.links if l is not None]
            for link in concept.links:
                if link.broken:
                    self.issues.append(Issue(concept.path, "warning", f"broken link to {link.target}"))

    def _ensure_dir(self, directory: str) -> None:
        if directory in self.directories:
            return
        parent = posixpath.dirname(directory)
        self._ensure_dir(parent)
        self.directories[directory] = Directory(directory)
        self.directories[parent].children.append(directory)

    def _load_concept(self, path: Path, rel: str) -> None:
        text = path.read_text(encoding="utf-8")
        cid = rel[:-3]
        try:
            meta, body = split_frontmatter(text)
        except FrontmatterError as exc:
            self.issues.append(Issue(rel, "error", str(exc)))
            meta, body = {}, text
        concept = Concept(cid, rel, meta or {}, body, path.stat().st_mtime)
        if meta is None:
            self.issues.append(Issue(rel, "error", "missing YAML frontmatter"))
        elif not concept.type:
            self.issues.append(Issue(rel, "error", "frontmatter has no non-empty 'type'"))
        for key in ("generated",):
            if key in concept.meta and "by" not in concept.generated:
                self.issues.append(Issue(rel, "warning", "'generated' should record 'by'"))
        for event in concept.verified:
            if "by" not in event:
                self.issues.append(Issue(rel, "warning", "'verified' entry without 'by'"))
        self.concepts[cid] = concept
        self.directories[posixpath.dirname(rel)].concepts.append(cid)

    def _check_index(self, path: Path, rel: str, directory: str) -> None:
        try:
            meta, _ = split_frontmatter(path.read_text(encoding="utf-8"))
        except FrontmatterError as exc:
            self.issues.append(Issue(rel, "error", str(exc)))
            return
        if meta is None:
            return
        if directory != "":
            self.issues.append(Issue(rel, "error", "index.md below the root must not have frontmatter"))
        elif set(meta) - {"okf_version"}:
            self.issues.append(Issue(rel, "error", "root index.md frontmatter may only carry okf_version"))
        else:
            self.root_meta = meta

    def _check_log(self, path: Path, rel: str) -> None:
        for line in path.read_text(encoding="utf-8").split("\n"):
            if line.startswith("## ") and not _LOG_DATE.match(line[3:].strip()):
                self.issues.append(Issue(rel, "warning", f"log heading is not YYYY-MM-DD: {line.strip()}"))

    def _resolve(self, concept: Concept, target: str) -> Link | None:
        if not target or target.startswith("#") or _SCHEME.match(target):
            return None
        target = unquote(target.split("#", 1)[0].split("?", 1)[0])
        if not target:
            return None
        if target.startswith("/"):
            joined = target.lstrip("/")
        else:
            joined = posixpath.join(concept.directory, target)
        norm = posixpath.normpath(joined) if joined else "."
        if norm.startswith(".."):
            return None  # outside the bundle
        if norm == ".":
            norm = ""
        if target.endswith("/") or norm in self.directories:
            return Link(norm + "/", "directory", norm not in self.directories)
        if norm.endswith("/index.md") or norm == "index.md":
            d = posixpath.dirname(norm)
            return Link(d + "/", "directory", d not in self.directories)
        if norm.endswith(".md"):
            cid = norm[:-3]
            return Link(cid, "concept", cid not in self.concepts)
        return None  # a non-markdown file: not a concept link

    # ------------------------------------------------------------- queries

    def backlinks(self, cid: str) -> list[str]:
        return sorted(c.id for c in self.concepts.values() if any(l.target == cid for l in c.links))

    def lint(self) -> list[Issue]:
        from .procedures import lint as lint_procedures  # procedures builds on this module

        return list(self.issues) + [Issue(path, "error", msg) for path, msg in lint_procedures(self)]

    def resolve_id(self, ref: str) -> str | None:
        """Accept an id, a bundle path, or a bundle-absolute link."""
        ref = ref.strip().lstrip("/")
        if ref.endswith(".md"):
            ref = ref[:-3]
        return ref if ref in self.concepts else None

    # ------------------------------------------------------------- indexes

    def overview_for(self, directory: str) -> Concept | None:
        for cid in self.directories[directory].concepts:
            c = self.concepts[cid]
            if c.type.lower() == "overview":
                return c
        return None

    def render_index(self, directory: str) -> str:
        """Generate an OKF §8 index for ``directory``."""
        d = self.directories[directory]
        groups: dict[str, list[Concept]] = {}
        for cid in d.concepts:
            c = self.concepts[cid]
            groups.setdefault(c.type or "Concept", []).append(c)
        parts: list[str] = []
        if directory == "":
            parts.append(f"---\nokf_version: \"{OKF_VERSION}\"\n---\n")
        for type_name in sorted(groups, key=lambda t: (t.lower() != "overview", t.lower())):
            items = sorted(groups[type_name], key=lambda c: c.title.lower())
            lines = [f"# {type_name}", ""]
            for c in items:
                href = posixpath.basename(c.path)
                desc = f" - {_one_line(c.description)}" if c.description else ""
                lines.append(f"* [{_escape(c.title)}]({href}){desc}")
            parts.append("\n".join(lines) + "\n")
        if d.children:
            lines = ["# Directories", ""]
            for child in sorted(d.children):
                overview = self.overview_for(child)
                desc = f" - {_one_line(overview.description)}" if overview and overview.description else ""
                name = posixpath.basename(child)
                lines.append(f"* [{name}]({name}/){desc}")
            parts.append("\n".join(lines) + "\n")
        if not groups and not d.children:
            parts.append("# Contents\n")
        return "\n".join(parts).rstrip() + "\n"

    def write_indexes(self) -> list[str]:
        """Write every directory's index.md; return the paths that changed."""
        changed: list[str] = []
        for directory in sorted(self.directories):
            target = self.root / directory / "index.md" if directory else self.root / "index.md"
            content = self.render_index(directory)
            current = target.read_text(encoding="utf-8") if target.exists() else None
            if current != content:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                changed.append(target.relative_to(self.root).as_posix())
            self.directories[directory].has_index = True
        return changed


def _one_line(text: str) -> str:
    return " ".join(text.split())


def _escape(text: str) -> str:
    return text.replace("[", r"\[").replace("]", r"\]")
