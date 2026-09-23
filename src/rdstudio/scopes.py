"""The global knowledge base, promotion between bundles, and skill scopes.

The global knowledge base is an ordinary rdstudio root (by default
``~/knowledge``, a private git repository) named in the user configuration::

    # ~/.config/rdstudio/config.toml
    [global]
    path = "~/knowledge"

Bundles never link to each other. Knowledge moves from a project to the global
base by promotion; the project export never includes global content.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterator

from . import config as config_mod
from .config import Config
from .okf import Bundle, render_concept, split_frontmatter
from .store import concept_path


class ScopeError(RuntimeError):
    pass


def global_config(cfg: Config) -> Config | None:
    """The global knowledge base's configuration, if one is set up and enabled."""
    if not cfg.use_global or cfg.global_bundle is None:
        return None
    root = cfg.global_bundle.expanduser()
    if not (root / config_mod.PROJECT_FILE).is_file():
        return None
    if cfg.is_project and root.resolve() == cfg.root.resolve():
        return None  # we are the global base
    return config_mod.load(root)


def scoped(cfg: Config, scope: str) -> list[tuple[str, Config]]:
    """``[(name, config)]`` for ``project`` | ``global`` | ``all``."""
    if scope not in ("project", "global", "all"):
        raise ScopeError(f"unknown scope {scope!r}; use project, global or all")
    out: list[tuple[str, Config]] = []
    if scope in ("project", "all"):
        out.append(("project", cfg))
    if scope in ("global", "all"):
        g = global_config(cfg)
        if g is None:
            if scope == "global":
                raise ScopeError("no global knowledge base (run `rdstudio global init`)")
        else:
            out.append(("global", g))
    return out


def _set_user_global(path: Path) -> str:
    user = config_mod.user_config_path()
    text = user.read_text(encoding="utf-8") if user.exists() else ""
    line = f'path = "{path}"'
    if "[global]" in text:
        lines = text.splitlines()
        start = lines.index("[global]")
        end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("[")), len(lines))
        block = [l for l in lines[start + 1 : end] if not l.strip().startswith("path")]
        lines[start + 1 : end] = [line, *block]
        text = "\n".join(lines) + "\n"
    else:
        text = (text.rstrip() + "\n\n" if text.strip() else "") + f"[global]\n{line}\n"
    user.parent.mkdir(parents=True, exist_ok=True)
    user.write_text(text, encoding="utf-8")
    return f"set [global] path in {user}"


def init_global(path: Path, *, human: str | None = None) -> Iterator[str]:
    from .scaffold import init

    path = path.expanduser().resolve()
    yield from init(path, title="Global knowledge", human=human)
    if not (path / ".git").exists():
        subprocess.run(["git", "init", "-q", "-b", "main", str(path)], check=False)
        yield f"initialised a git repository in {path} (private: add no remote unless you mean to)"
    yield _set_user_global(path)


def promote(cfg: Config, cid: str, *, as_id: str | None = None, keep: bool = False,
            force: bool = False) -> dict[str, Any]:
    """Move (or copy, with ``keep``) a project concept into the global base."""
    g = global_config(cfg)
    if g is None:
        raise ScopeError("no global knowledge base (run `rdstudio global init`)")
    project = Bundle.load(cfg.knowledge_dir)
    source_id = project.resolve_id(cid)
    if source_id is None:
        raise ScopeError(f"no project concept {cid!r}")
    backlinks = project.backlinks(source_id)
    if backlinks and not keep and not force:
        raise ScopeError(
            "project concepts link to it: " + ", ".join(backlinks)
            + ". Use --keep to copy instead of move, or --force to move anyway."
        )
    target = concept_path(g.knowledge_dir, as_id or source_id)
    if target.exists():
        raise ScopeError(f"the global base already has {target.relative_to(g.knowledge_dir)}")
    src = concept_path(cfg.knowledge_dir, source_id)
    meta, body = split_frontmatter(src.read_text(encoding="utf-8"))
    meta = dict(meta or {})
    sources = list(meta.get("sources") or [])
    sources.append({"resource": f"project {cfg.title}: {source_id}", "title": "Promoted from a project"})
    meta["sources"] = sources
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_concept(meta, body), encoding="utf-8")
    if not keep:
        src.unlink()
    new_id = target.relative_to(g.knowledge_dir).as_posix()[:-3]
    global_bundle = Bundle.load(g.knowledge_dir)
    unresolved = [l.target for l in global_bundle.concepts[new_id].links if l.broken]
    global_bundle.write_indexes()
    Bundle.load(cfg.knowledge_dir).write_indexes()
    return {
        "from": source_id,
        "to": new_id,
        "moved": not keep,
        "broken_links_in_global": unresolved,
        "project_backlinks": backlinks,
    }


# --------------------------------------------------------------------------- #
# Skill scopes
# --------------------------------------------------------------------------- #


def user_skills_dir() -> Path:
    return Path.home() / ".claude" / "skills"


def skill_dirs(cfg: Config) -> dict[str, dict[str, Path]]:
    out: dict[str, dict[str, Path]] = {"project": {}, "user": {}}
    for scope, base in (("project", cfg.root / ".claude" / "skills"), ("user", user_skills_dir())):
        if base.is_dir():
            for d in sorted(base.iterdir()):
                if (d / "SKILL.md").is_file():
                    out[scope][d.name] = d
    return out


def move_skill(cfg: Config, name: str, to: str) -> str:
    dirs = skill_dirs(cfg)
    src_scope = "project" if to == "user" else "user"
    if name not in dirs[src_scope]:
        raise ScopeError(f"no {src_scope} skill {name!r}")
    if name in dirs[to]:
        raise ScopeError(f"a {to} skill {name!r} already exists")
    dest_base = user_skills_dir() if to == "user" else cfg.root / ".claude" / "skills"
    dest_base.mkdir(parents=True, exist_ok=True)
    shutil.move(str(dirs[src_scope][name]), dest_base / name)
    return f"moved skill {name} to {to} scope ({dest_base / name})"

