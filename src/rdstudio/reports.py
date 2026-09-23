"""HTML reports: metadata from <meta name="rdstudio:*"> tags and links into knowledge."""

from __future__ import annotations

import html
import posixpath
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
_META = re.compile(r"<meta\s+[^>]*>", re.I)
_ATTR = re.compile(r'(\w[\w:-]*)\s*=\s*("([^"]*)"|\'([^\']*)\')')
_HREF = re.compile(r'href\s*=\s*("([^"]*)"|\'([^\']*)\')', re.I)
_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.I | re.S)
_TAGS = re.compile(r"<[^>]+>")


def _meta(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for tag in _META.findall(text):
        attrs = {m.group(1).lower(): html.unescape(m.group(3) if m.group(3) is not None else m.group(4) or "")
                 for m in _ATTR.finditer(tag)}
        name = attrs.get("name", "")
        if name.startswith("rdstudio:") or name == "description":
            out[name.removeprefix("rdstudio:")] = attrs.get("content", "")
    return out


def knowledge_links(text: str, report_rel: str, knowledge: str, reports: str) -> list[str]:
    """Concept ids linked from a report (``/knowledge/x.md`` or relative paths into it)."""
    ids: list[str] = []
    here = posixpath.dirname(posixpath.join(reports, report_rel))
    for m in _HREF.finditer(text):
        href = html.unescape(m.group(2) if m.group(2) is not None else m.group(3) or "")
        if href.startswith("#/k/"):  # a dashboard route
            ids.append(href[4:])
            continue
        href = href.split("#", 1)[0].split("?", 1)[0]
        if not href or re.match(r"^[a-z][a-z0-9+.-]*:", href, re.I):
            continue
        path = href.lstrip("/") if href.startswith("/") else posixpath.normpath(posixpath.join(here, href))
        prefix = knowledge.strip("/") + "/"
        if path.startswith(prefix) and path.endswith(".md"):
            ids.append(path[len(prefix) : -3])
    return sorted(set(ids))


def scan(reports_dir: Path, knowledge: str, reports: str) -> list[dict[str, Any]]:
    if not reports_dir.is_dir():
        return []
    items = []
    for path in sorted(reports_dir.rglob("*.html")):
        rel = path.relative_to(reports_dir).as_posix()
        if any(part.startswith((".", "_")) for part in rel.split("/")):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        meta = _meta(text)
        title = meta.get("title")
        if not title:
            m = _TITLE.search(text) or _H1.search(text)
            title = html.unescape(_TAGS.sub("", m.group(1))).strip() if m else path.stem
        mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        items.append({
            "path": rel,
            "title": " ".join(title.split()),
            "date": meta.get("date") or mtime.strftime("%Y-%m-%d"),
            "author": meta.get("author", ""),
            "description": meta.get("description", ""),
            "activity": meta.get("activity", ""),
            "links": knowledge_links(text, rel, knowledge, reports),
        })
    items.sort(key=lambda r: (r["date"], r["path"]), reverse=True)
    return items
