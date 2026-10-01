"""Build the static dashboard: web assets plus JSON data under ``.rdstudio/site``."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from . import gitlog, learner, reports
from .config import Config
from .okf import Bundle, FrontmatterError, headings, iso, jsonable, now, split_frontmatter

# The built dashboard: the Svelte app builds it here (npm run build --workspace
# @rdstudio/app); releases carry it.
WEB_DIR = Path(__file__).parent / "web"


def _sync_tree(src: Path, dst: Path, *, skip: frozenset[str] = frozenset()) -> None:
    """Copy ``src`` into ``dst``, skipping files whose size and mtime already match
    and the relative paths in ``skip``."""
    for path in src.rglob("*"):
        rel = path.relative_to(src)
        if rel.as_posix() in skip:
            continue
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


# Top-level names the old dashboard wrote that the Svelte one does not.
_FORMER_DASHBOARD = frozenset({"app.js", "js", "style.css", "style-tokens.css"})


def _prune_dashboard(site: Path) -> None:
    """Remove dashboard files from ``site`` that the current dashboard does not
    have: an earlier build's hashed scripts, or the old dashboard. Only names
    the dashboard owns are touched, so other files in an export folder stay."""
    keep = {p.relative_to(WEB_DIR).as_posix() for p in WEB_DIR.rglob("*") if p.is_file()}
    owned = {p.name for p in WEB_DIR.iterdir()} | _FORMER_DASHBOARD
    for name in sorted(owned - {"sw.js"}):
        top = site / name
        if top.is_file() or top.is_symlink():
            if name not in keep:
                top.unlink()
            continue
        if not top.is_dir():
            continue
        for path in sorted(top.rglob("*"), reverse=True):  # files before their folders
            if path.is_dir() and not path.is_symlink():
                if not any(path.iterdir()):
                    path.rmdir()
            elif path.relative_to(site).as_posix() not in keep:
                path.unlink()
        if not any(top.iterdir()):
            top.rmdir()


def service_worker() -> str:
    """The service worker, stamped with a fingerprint of the app's files, so a
    new rdstudio (or an edited app file) replaces what browsers have cached."""
    digest = hashlib.sha256()
    for path in sorted(WEB_DIR.rglob("*")):
        if path.is_file():
            st = path.stat()
            digest.update(f"{path.relative_to(WEB_DIR).as_posix()}:{st.st_size}:{st.st_mtime_ns}\n".encode())
    return (WEB_DIR / "sw.js").read_text(encoding="utf-8").replace("__SHELL__", digest.hexdigest()[:16])


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
    place = bundle.prerequisite_order()[cid]
    rec.update({
        "hash": learner.content_hash(c.body),  # the version learner-record events refer to
        "order": place["order"],  # reading order from requires links
        "depth": place["depth"],  # longest chain of prerequisites below this note
        "requires": bundle.requires_graph()[cid],
        "meta": jsonable(c.meta),
        "directory": c.directory,
        "links": [{"target": l.target, "kind": l.kind, "broken": l.broken, "rel": l.rel} for l in c.links],
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


def build(cfg: Config, *, write_indexes: bool | None = None, export: bool = False,
          site: Path | None = None) -> Path:
    """Build the dashboard into ``site`` (default ``.rdstudio/site``).

    ``export`` produces a snapshot for static hosting: no user-level skills, no
    uncommitted changes, and the page does not poll for updates."""
    site = site or cfg.site_dir
    data = site / "data"
    if not (WEB_DIR / "index.html").is_file():
        raise RuntimeError(f"the dashboard is not built (no {WEB_DIR / 'index.html'}): "
                           "run npm run build --workspace @rdstudio/app")
    site.mkdir(parents=True, exist_ok=True)
    _prune_dashboard(site)
    _sync_tree(WEB_DIR, site, skip=frozenset({"sw.js"}))
    _write_if_changed(site / "sw.js", service_worker())

    auto_index = cfg.raw.get("index", {}).get("auto", True) if write_indexes is None else write_indexes
    bundle = Bundle.load(cfg.knowledge_dir)
    if auto_index and cfg.knowledge_dir.is_dir():
        if bundle.write_indexes():
            bundle = Bundle.load(cfg.knowledge_dir)

    concepts = [concept_record(bundle, cid) for cid in sorted(bundle.concepts)]
    tree = tree_record(bundle)
    changes = gitlog.history(cfg.root, cfg.category_globs(), exclude=(cfg.output.strip("/") + "/",))
    if export:
        changes["commits"] = [c for c in changes["commits"] if not c.get("pending")]
    report_items = reports.scan(cfg.reports_dir, cfg.knowledge, cfg.reports)
    skills = _skill_files(cfg.root, user=not export)
    issues = [{"path": i.path, "level": i.level, "code": i.code, "message": i.message} for i in bundle.lint()]

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
        "static": export,
        "map": cfg.raw.get("map", {}),  # project defaults for the Map tab ([map] in rdstudio.toml)
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
    # Installable as an app (add to home screen), opening full screen.
    _write_if_changed(site / "manifest.webmanifest", _dump({
        "name": cfg.title, "short_name": cfg.title[:24], "start_url": "./", "scope": "./",
        "display": "fullscreen", "display_override": ["fullscreen", "standalone"],
        "background_color": "#141a20", "theme_color": "#141a20",
        "icons": [{"src": f"icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any maskable"}
                  for n in (192, 512)],
    }))
    vfile = data / "version.json"
    try:
        old = json.loads(vfile.read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError):
        old = None
    if old != version:
        vfile.write_text(_dump({"version": version, "built": iso(now())}), encoding="utf-8")
    return site
