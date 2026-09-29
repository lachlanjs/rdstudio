"""The private learner record: what a person has done to learn a project.

Kept apart from the project (``~/.local/share/rdstudio/learners/<project>/`` by
default, or under ``[learner] path`` in the user config), one JSON event per
line in ``record.jsonl``, only ever appended. Off until ``[learner] enabled``.

Every event has an ``id``: a ULID (a millisecond timestamp, then randomness, in
26 sortable characters), and the ``device`` that wrote it. Records from several
devices merge as a union by id, in any order and as often as needed; sorting by
id puts them in time order. Corrections are new events that name the id they
correct, so nothing is ever rewritten.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import Config, _read_toml, user_config_path
from .okf import iso, now

KINDS = ("autodidactic", "interactive", "ai")
MAX_EVENT_BYTES = 64 * 1024
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
ID_RE = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")
DEVICE_RE = re.compile(r"^[a-z0-9]{4,16}$")


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


def learners_root() -> Path:
    base = settings().get("path")
    if base:
        return Path(base).expanduser()
    data = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(data) / "rdstudio" / "learners"


def record_dir(cfg: Config) -> Path:
    return learners_root() / project_id(cfg.root)


def device_id() -> str:
    """This machine's id in learner records, made once and kept beside them."""
    path = learners_root() / "device"
    try:
        dev = path.read_text(encoding="utf-8").strip()
        if DEVICE_RE.match(dev):
            return dev
    except OSError:
        pass
    dev = secrets.token_hex(4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dev + "\n", encoding="utf-8")
    return dev


def _encode(n: int, length: int) -> str:
    return "".join(_CROCKFORD[(n >> (5 * i)) & 31] for i in reversed(range(length)))


_last = [0, 0]  # the last id's time and random part, for ids made in the same millisecond
_lock = threading.Lock()


def new_id(ms: int | None = None) -> str:
    """A ULID. Within one millisecond the random part counts up, so ids from one
    device sort in the order they were made."""
    ms = time.time_ns() // 1_000_000 if ms is None else ms
    with _lock:
        rand = _last[1] + 1 if ms == _last[0] else secrets.randbits(80)
        _last[:] = [ms, rand]
    return _encode(ms, 10) + _encode(rand & ((1 << 80) - 1), 16)


def legacy_id(line: str, at: object) -> str:
    """A fixed id for an event written before events had ids: its time, and a
    hash of the line in place of randomness, so every device derives the same one."""
    try:
        ms = int(datetime.fromisoformat(str(at).replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        ms = 0
    return _encode(ms, 10) + _encode(int(hashlib.sha256(line.encode()).hexdigest()[:20], 16), 16)


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
    eid = event.get("id")
    if eid is not None and not (isinstance(eid, str) and ID_RE.match(eid)):
        raise LearnerError("'id' is a ULID (26 characters)")  # given when made offline
    dev = event.get("device")
    if dev is not None and not (isinstance(dev, str) and DEVICE_RE.match(dev)):
        raise LearnerError("'device' is 4 to 16 lowercase letters and digits")
    rest = {k: v for k, v in event.items() if k not in ("at", "id", "device")}
    out = {"id": eid or new_id(), "at": iso(now()), "device": dev or device_id(), **rest}
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


def read(path: Path) -> list[dict[str, Any]]:
    """The events in one record file, in the order written, each once (a retried
    write can repeat one); lines that do not parse are skipped."""
    if not path.is_file():
        return []
    out, seen = [], set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if not isinstance(e, dict):
            continue
        if not isinstance(e.get("id"), str):
            e = {"id": legacy_id(line, e.get("at")), **e}
        if e["id"] not in seen:
            seen.add(e["id"])
            out.append(e)
    return out


def merge(*records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The union of several devices' records, by id, in time order. The same in
    any order and however often it is repeated."""
    by_id: dict[str, dict[str, Any]] = {}
    for record in records:
        for e in record:
            by_id.setdefault(e["id"], e)
    return [by_id[k] for k in sorted(by_id)]


def events(cfg: Config, *, concept: str | None = None) -> list[dict[str, Any]]:
    """Every event, oldest first."""
    out = read(record_dir(cfg) / "record.jsonl")
    return [e for e in out if concept is None or e.get("concept") == concept]
