"""Build the static dashboard: web assets plus JSON data under ``.rdstudio/site``."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from . import gitlog, reports
from .config import Config
from .okf import Bundle, FrontmatterError, headings, iso, jsonable, now, split_frontmatter

WEB_DIR = Path(__file__).parent / "web"


def _sync_tree(src: Path, dst: Path) -> None:
    """Copy ``src`` into ``dst``, skipping files whose size and mtime already match."""
    for path in src.rglob("*"):
        rel = path.relative_to(src)
        target = dst / rel
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        st = path.stat()
        if target.exists():
            tt = target.stat()
            if tt.st_size == st.st_size and int(tt.st_mtime) == int(st.st_mtime):
                continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def _write_if_changed(path: Path, content: str) -> None:
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def concept_record(bundle: Bundle, cid: str) -> dict[str, Any]:
    c = bundle.concepts[cid]
    rec = c.summary()
    rec.update({
        "meta": jsonable(c.meta),
        "directory": c.directory,
        "links": [{"target": l.target, "kind": l.kind, "broken": l.broken} for l in c.links],
        "backlinks": bundle.backlinks(cid),
        "headings": [{"level": h.level, "text": h.text, "slug": h.slug} for h in headings(c.body)],
        "generated_at": iso(c.generated_at) if c.generated_at else None,
        "mtime": int(c.mtime),
    })
    return rec


def tree_record(bundle: Bundle) -> dict[str, Any]:
    out = {}
    for did, d in bundle.directories.items():
        overview = bundle.overview_for(did)
        out[did] = {
            "id": did,
            "name": d.name,
            "concepts": sorted(d.concepts, key=lambda c: bundle.concepts[c].title.lower()),
            "children": sorted(d.children),
            "overview": overview.id if overview else None,
            "index": bundle.render_index(did),
        }
    return out


def _skill_files(root: Path, *, user: bool = True) -> dict[str, list[dict[str, Any]]]:
    """Skills (``.claude/skills/<name>/SKILL.md``) and agents (``.claude/agents/*.md``),
    from the project and, unless ``user`` is false, from ``~/.claude``."""
    out: dict[str, list[dict[str, Any]]] = {"skills": [], "agents": []}
    specs = [("skills", "project", root, sorted((root / ".claude" / "skills").glob("*/SKILL.md"))),
             ("agents", "project", root, sorted((root / ".claude" / "agents").glob("*.md")))]
    if user:
        home = Path.home()
        specs += [("skills", "user", home, sorted((home / ".claude" / "skills").glob("*/SKILL.md"))),
                  ("agents", "user", home, sorted((home / ".claude" / "agents").glob("*.md")))]
    for kind, scope, base, paths in specs:
        for path in paths:
            try:
                meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
            except FrontmatterError:
                meta, body = {}, path.read_text(encoding="utf-8")
            meta = meta or {}
            name = meta.get("name") or (path.parent.name if kind == "skills" else path.stem)
            out[kind].append({
                "name": str(name),
                "description": str(meta.get("description") or ""),
                "path": ("~/" if scope == "user" else "") + path.relative_to(base).as_posix(),
                "scope": scope,
                "meta": jsonable(meta),
                "body": body,
            })
    return out


def build(cfg: Config, *, write_indexes: bool | None = None, export: bool = False) -> Path:
    site = cfg.site_dir
    data = site / "data"
    site.mkdir(parents=True, exist_ok=True)
    _sync_tree(WEB_DIR, site)

    auto_index = cfg.raw.get("index", {}).get("auto", True) if write_indexes is None else write_indexes
    bundle = Bundle.load(cfg.knowledge_dir)
    if auto_index and cfg.knowledge_dir.is_dir():
        if bundle.write_indexes():
            bundle = Bundle.load(cfg.knowledge_dir)

    concepts = [concept_record(bundle, cid) for cid in sorted(bundle.concepts)]
    tree = tree_record(bundle)
    changes = gitlog.history(cfg.root, cfg.category_globs(), exclude=(cfg.output.strip("/") + "/",))
    report_items = reports.scan(cfg.reports_dir, cfg.knowledge, cfg.reports)
    skills = _skill_files(cfg.root, user=not export)
    issues = [{"path": i.path, "level": i.level, "message": i.message} for i in bundle.lint()]

    payload = {
        "concepts.json": _dump(concepts),
        "tree.json": _dump(tree),
        "changes.json": _dump(changes),
        "reports.json": _dump(report_items),
        "skills.json": _dump(skills),
    }
    site_info = {
        "title": cfg.title,
        "knowledge": cfg.knowledge,
        "reports": cfg.reports,
        "human": cfg.human,
        "okf_version": bundle.root_meta.get("okf_version"),
        "issues": issues,
        "counts": {"concepts": len(concepts), "reports": len(report_items),
                   "skills": len(skills["skills"]), "agents": len(skills["agents"])},
    }
    payload["site.json"] = _dump(site_info)

    bodies: dict[str, str] = {f"k/{cid}.md": c.body for cid, c in bundle.concepts.items()}
    digest = hashlib.sha256()
    for name in sorted(payload):
        digest.update(payload[name].encode())
    for name in sorted(bodies):
        digest.update(name.encode() + bodies[name].encode())
    version = digest.hexdigest()[:16]

    for rel, text in bodies.items():
        _write_if_changed(data / rel, text)
    keep = {data / rel for rel in bodies}
    # Non-markdown bundle files (images, data) are served beside the bodies.
    if cfg.knowledge_dir.is_dir():
        for path in cfg.knowledge_dir.rglob("*"):
            rel = path.relative_to(cfg.knowledge_dir)
            if path.is_file() and path.suffix != ".md" and not any(p.startswith(".") for p in rel.parts):
                target = data / "k" / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
                    shutil.copy2(path, target)
    if (data / "k").is_dir():
        for stale in (data / "k").rglob("*.md"):
            if stale not in keep:
                stale.unlink()

    # Reports are served beside the app so relative media keeps working.
    if cfg.reports_dir.is_dir():
        _sync_tree(cfg.reports_dir, site / "reports")

    for name, text in payload.items():
        _write_if_changed(data / name, text)
    vfile = data / "version.json"
    try:
        old = json.loads(vfile.read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError):
        old = None
    if old != version:
        vfile.write_text(_dump({"version": version, "built": iso(now())}), encoding="utf-8")
    return site
