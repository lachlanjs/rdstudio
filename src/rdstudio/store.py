"""Writing concepts with provenance: create, update (whole body or one section), verify."""

from __future__ import annotations

import posixpath
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .okf import (
    RESERVED,
    FrontmatterError,
    headings,
    now,
    render_concept,
    split_frontmatter,
)

_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")


class StoreError(ValueError):
    pass


@dataclass
class WriteResult:
    id: str
    path: str
    created: bool
    significant: bool
    decided_by: str = "caller"

    def as_dict(self) -> dict[str, Any]:
        return {"id": self.id, "path": self.path, "created": self.created, "significant": self.significant,
                "decided_by": self.decided_by}


def concept_path(root: Path, cid: str) -> Path:
    cid = cid.strip().lstrip("/")
    if cid.endswith(".md"):
        cid = cid[:-3]
    norm = posixpath.normpath(cid)
    if not _SAFE_ID.match(norm) or norm.startswith("..") or "/../" in f"/{norm}/":
        raise StoreError(f"invalid concept id: {cid!r}")
    if posixpath.basename(norm) + ".md" in RESERVED:
        raise StoreError(f"{posixpath.basename(norm)}.md is reserved by OKF")
    return root / f"{norm}.md"


def _read(path: Path) -> tuple[dict[str, Any], str]:
    meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
    return (meta or {}), body


def replace_section(body: str, heading: str, content: str) -> str:
    """Replace the content under ``heading`` (keeping the heading line); append the
    section at the end when it does not exist."""
    wanted = heading.strip().lstrip("#").strip()
    hs = headings(body)
    lines = body.split("\n")
    for idx, h in enumerate(hs):
        if h.text.lower() == wanted.lower():
            end = len(lines)
            for later in hs[idx + 1 :]:
                if later.level <= h.level:
                    end = later.line
                    break
            new = lines[: h.line + 1] + ["", content.strip(), ""] + lines[end:]
            return "\n".join(new)
    return body.rstrip() + f"\n\n# {wanted}\n\n{content.strip()}\n"


def record(
    root: Path,
    cid: str,
    *,
    actor: str,
    body: str | None = None,
    meta: dict[str, Any] | None = None,
    section: str | None = None,
    append: str | None = None,
    significant: bool | None = True,
    classifier: Any = None,
) -> WriteResult:
    """Create or update a concept.

    - ``meta`` keys overwrite existing keys; a ``None`` value deletes the key.
      Unknown keys already present are preserved.
    - ``body`` replaces the whole body; ``section`` + ``body`` replaces only that
      section; ``append`` adds text at the end.
    - ``significant`` edits stamp ``generated: {by, at}`` (OKF: last meaningful
      change). Minor edits leave provenance untouched. ``None`` lets the
      classifier decide from the before and after text.
    """
    path = concept_path(root, cid)
    created = not path.exists()
    if created:
        current_meta: dict[str, Any] = {}
        current_body = ""
        significant = True
    else:
        try:
            current_meta, current_body = _read(path)
        except FrontmatterError as exc:
            raise StoreError(f"cannot update {path.name}: {exc}") from exc

    new_meta = dict(current_meta)
    for key, value in (meta or {}).items():
        if value is None:
            new_meta.pop(key, None)
        else:
            new_meta[key] = value
    if not new_meta.get("type"):
        raise StoreError("a concept needs a non-empty 'type'")

    new_body = current_body
    if body is not None:
        new_body = replace_section(current_body, section, body) if section else body
    if append:
        new_body = new_body.rstrip() + "\n\n" + append.strip() + "\n"

    decided_by = "caller"
    if significant is None:
        headline = any(new_meta.get(k) != current_meta.get(k) for k in ("type", "title", "description"))
        if headline:
            significant, decided_by = True, "rules"
        else:
            from .classify import RulesClassifier

            decision = (classifier or RulesClassifier()).choose(
                "edit_significance", ["minor", "significant"], {"before": current_body, "after": new_body})
            significant, decided_by = decision.choice != "minor", decision.backend

    if significant:
        new_meta["generated"] = {"by": actor, "at": now()}

    # Keep 'type' first for readability.
    ordered = {"type": new_meta.pop("type"), **new_meta}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_concept(ordered, new_body), encoding="utf-8")
    rel = path.relative_to(root).as_posix()
    return WriteResult(rel[:-3], rel, created, bool(significant), decided_by if not created else "new")


def verify(root: Path, cid: str, *, actor: str) -> WriteResult:
    """Append a verification event by ``actor`` at the current time."""
    path = concept_path(root, cid)
    if not path.exists():
        raise StoreError(f"no such concept: {cid}")
    meta, body = _read(path)
    events = meta.get("verified")
    if isinstance(events, dict):
        events = [events]
    events = list(events or [])
    events.append({"by": actor, "at": now()})
    meta["verified"] = events
    path.write_text(render_concept(meta, body), encoding="utf-8")
    rel = path.relative_to(root).as_posix()
    return WriteResult(rel[:-3], rel, False, False)
