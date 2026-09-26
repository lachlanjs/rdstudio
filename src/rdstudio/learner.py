"""The private learner record: what a person has done to learn a project.

Kept apart from the project (``~/.local/share/rdstudio/learners/<project>/`` by
default, or under ``[learner] path`` in the user config), one JSON event per
line in ``record.jsonl``, only ever appended. Off until ``[learner] enabled``.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .config import Config, _read_toml, user_config_path
from .okf import iso, now

KINDS = ("autodidactic", "interactive", "ai")
MAX_EVENT_BYTES = 64 * 1024


class LearnerError(ValueError):
    pass


def settings() -> dict[str, Any]:
    return _read_toml(user_config_path()).get("learner", {})


def enabled(cfg: Config) -> bool:
    return bool(settings().get("enabled", False)) and cfg.is_project


def project_id(root: Path) -> str:
    """The repository's first root commit, the same in every clone; outside git,
    a hash of the path."""
    try:
        out = subprocess.run(["git", "rev-list", "--max-parents=0", "HEAD"], cwd=root,
                             capture_output=True, text=True, timeout=10)
        roots = sorted(out.stdout.split())
        if out.returncode == 0 and roots:
            return roots[0][:16]
    except (OSError, subprocess.SubprocessError):
        pass
    return "path-" + hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:12]


def record_dir(cfg: Config) -> Path:
    base = settings().get("path")
    if base:
        root = Path(base).expanduser()
    else:
        data = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
        root = Path(data) / "rdstudio" / "learners"
    return root / project_id(cfg.root)


def content_hash(body: str) -> str:
    """The version of a note an event refers to."""
    return hashlib.sha256(body.strip().encode("utf-8")).hexdigest()[:12]


def _clean(event: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(event, dict):
        raise LearnerError("an event is a JSON object")
    name = event.get("event")
    if not isinstance(name, str) or not name or len(name) > 40:
        raise LearnerError("an event needs an 'event' name")
    kind = event.get("kind")
    if kind is not None and kind not in KINDS:
        raise LearnerError(f"'kind' is one of {', '.join(KINDS)}")
    out = {"at": iso(now()), **{k: v for k, v in event.items() if k != "at"}}
    if len(json.dumps(out, ensure_ascii=False)) > MAX_EVENT_BYTES:
        raise LearnerError("event too large")
    return out


def append(cfg: Config, event: dict[str, Any]) -> dict[str, Any]:
    """Add one event to the record and return it as stored."""
    out = _clean(event)
    path = record_dir(cfg) / "record.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    return out


def events(cfg: Config, *, concept: str | None = None) -> list[dict[str, Any]]:
    """Every event, oldest first; lines that do not parse are skipped."""
    path = record_dir(cfg) / "record.jsonl"
    if not path.is_file():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if isinstance(e, dict) and (concept is None or e.get("concept") == concept):
            out.append(e)
    return out
