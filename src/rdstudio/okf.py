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
_LINK = re.compile(r"(?<!!)\[(?P<text>[^\]]*)\]\((?P<target><[^>]+>|[^)\s]+)(?:\s+(?:\"(?P<title>[^\"]*)\"|'(?P<title2>[^']*)'))?\)")
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
    return [target for target, _ in link_refs(body)]


# How consequential a link is, given as the link's title:
# [tangent space](/manifolds/tangent-space.md "requires").
RATINGS = {"requires": 3, "uses": 2, "see also": 1}


def rating(title: str | None) -> str | None:
    """The rating a link title names, or None (unrated, or an ordinary title)."""
    key = " ".join((title or "").lower().replace("-", " ").replace("_", " ").split())
    key = {"seealso": "see also"}.get(key, key)
    return key if key in RATINGS else None


def link_refs(body: str) -> list[tuple[str, str | None]]:
    """Link targets with their ratings, in order of appearance."""
    text = "\n".join(_strip_code(body))
    refs = [(m.group("target").strip("<>"), rating(m.group("title") or m.group("title2"))) for m in _LINK.finditer(text)]
    refs += [(m.group("target").strip("<>"), None) for m in _REF_DEF.finditer(text)]
    return refs


# --------------------------------------------------------------------------- #
# Model
# --------------------------------------------------------------------------- #


@dataclass
class Link:
    target: str  # concept id, or directory id with trailing '/'
    kind: str  # "concept" | "directory"
    broken: bool = False
    rel: str | None = None  # "requires" | "uses" | "see also" | None (unrated)


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
        self._prereq: dict[str, dict[str, int]] | None = None

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
            links = []
            for target, rel in link_refs(concept.body):
                link = self._resolve(concept, target)
                if link is not None:
                    link.rel = rel
                    links.append(link)
            concept.links = links
            for link in concept.links:
                if link.broken:
                    self.issues.append(Issue(concept.path, "warning", f"broken link to {link.target}"))
        for group in self.requires_cycles():
            first = self.concepts[group[0]]
            self.issues.append(Issue(first.path, "warning", "requires cycle: " + ", ".join(group) + " require each other"))

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

    def requires_graph(self) -> dict[str, list[str]]:
        """Each concept's direct prerequisites: the concepts it links to as ``requires``."""
        return {cid: sorted({l.target for l in c.links if l.rel == "requires" and l.kind == "concept"
                             and not l.broken and l.target != cid and l.target in self.concepts})
                for cid, c in self.concepts.items()}

    def _components(self) -> list[list[str]]:
        """Strongly connected components of the requires graph (Tarjan's algorithm),
        singletons included; a component is a group that require each other."""
        graph = self.requires_graph()
        index: dict[str, int] = {}
        low: dict[str, int] = {}
        stack: list[str] = []
        on_stack: set[str] = set()
        groups: list[list[str]] = []
        counter = 0

        def visit(v: str) -> None:
            nonlocal counter
            index[v] = low[v] = counter
            counter += 1
            stack.append(v)
            on_stack.add(v)
            for w in graph[v]:
                if w not in index:
                    visit(w)
                    low[v] = min(low[v], low[w])
                elif w in on_stack:
                    low[v] = min(low[v], index[w])
            if low[v] == index[v]:
                group = []
                while True:
                    w = stack.pop()
                    on_stack.discard(w)
                    group.append(w)
                    if w == v:
                        break
                groups.append(sorted(group))

        for v in sorted(graph):
            if v not in index:
                visit(v)
        return groups

    def requires_cycles(self) -> list[list[str]]:
        """Groups of concepts that require each other, directly or through a chain."""
        return sorted(g for g in self._components() if len(g) > 1)

    def prerequisite_order(self) -> dict[str, dict[str, int]]:
        """For every concept, its place in a reading order (``order``) and how advanced
        it is (``depth``: the longest chain of prerequisites below it).

        The order is a topological sort of the requires graph with cycles treated
        as one step; among the concepts that are ready, it prefers staying in the
        folder just read, then shallower concepts, then titles."""
        if self._prereq is not None:
            return self._prereq
        graph = self.requires_graph()
        comps = self._components()
        comp_of = {cid: i for i, g in enumerate(comps) for cid in g}
        needs = [sorted({comp_of[w] for v in g for w in graph[v]} - {i}) for i, g in enumerate(comps)]
        depth: list[int] = [-1] * len(comps)
        # Tarjan emits a component only after everything it reaches, so this order is safe.
        for i in range(len(comps)):
            depth[i] = 1 + max((depth[j] for j in needs[i]), default=-1)
        waiting = [len(n) for n in needs]
        unlocks: list[list[int]] = [[] for _ in comps]
        for i, n in enumerate(needs):
            for j in n:
                unlocks[j].append(i)
        ready = {i for i, w in enumerate(waiting) if w == 0}
        title = {i: min(self.concepts[c].title.lower() for c in g) for i, g in enumerate(comps)}
        folder = {i: self.concepts[comps[i][0]].directory for i in range(len(comps))}

        def shared(a: str, b: str) -> int:
            pa, pb = a.split("/") if a else [], b.split("/") if b else []
            n = 0
            while n < min(len(pa), len(pb)) and pa[n] == pb[n]:
                n += 1
            return n

        out: dict[str, dict[str, int]] = {}
        last = None
        while ready:
            i = min(ready, key=lambda k: (-(shared(folder[k], folder[last]) if last is not None else 0),
                                          depth[k], folder[k], title[k]))
            ready.discard(i)
            for cid in sorted(comps[i], key=lambda c: self.concepts[c].title.lower()):
                out[cid] = {"order": len(out), "depth": depth[i]}
            last = i
            for k in unlocks[i]:
                waiting[k] -= 1
                if waiting[k] == 0:
                    ready.add(k)
        self._prereq = out
        return out

    def prerequisites(self, cid: str) -> list[str]:
        """Everything ``cid`` requires, directly or through a chain, in reading order
        (``cid`` itself excluded)."""
        graph = self.requires_graph()
        seen: set[str] = set()
        todo = list(graph.get(cid, []))
        while todo:
            v = todo.pop()
            if v not in seen:
                seen.add(v)
                todo.extend(graph[v])
        seen.discard(cid)
        order = self.prerequisite_order()
        return sorted(seen, key=lambda c: order[c]["order"])

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
