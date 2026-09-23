"""Commit-by-commit change lists, with each file sorted into a category."""

from __future__ import annotations

import re
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

_STATUS = {"A": "added", "M": "modified", "D": "deleted", "R": "renamed", "C": "copied", "T": "modified"}


@lru_cache(maxsize=256)
def _glob_regex(pattern: str) -> re.Pattern[str]:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        elif pattern[i] == "?":
            out, i = out + "[^/]", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + r"\Z")


def categorise(path: str, categories: dict[str, list[str]]) -> str:
    for name, globs in categories.items():
        if any(_glob_regex(g).match(path) for g in globs):
            return name
    return "other"


def _git(root: Path, *args: str) -> str | None:
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True, timeout=20, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return proc.stdout if proc.returncode == 0 else None


def history(root: Path, categories: dict[str, list[str]], limit: int = 200,
            exclude: tuple[str, ...] = (".rdstudio/",)) -> dict[str, Any]:
    """Recent commits (newest first), plus uncommitted changes as a pseudo-commit.

    Paths under ``exclude`` prefixes (build output) are left out."""
    if _git(root, "rev-parse", "--is-inside-work-tree") is None:
        return {"available": False, "commits": []}
    commits: list[dict[str, Any]] = []

    status = _git(root, "status", "--porcelain", "-uall") or ""
    pending = []
    for line in status.splitlines():
        if len(line) < 4:
            continue
        code, path = line[:2], line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path.strip('"').startswith(exclude):
            continue
        kind = "added" if "?" in code or "A" in code else "deleted" if "D" in code else "modified"
        pending.append({"path": path.strip('"'), "status": kind, "category": categorise(path, categories)})
    if pending:
        commits.append({"hash": "", "short": "", "author": "", "date": "", "subject": "Uncommitted changes",
                        "files": pending, "pending": True})

    out = _git(root, "log", f"-n{limit}", "--name-status", "--no-renames", "--format=%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1f%P")
    for block in (out or "").split("\x1e"):
        if not block.strip():
            continue
        header, _, rest = block.partition("\n")
        full, short, author, date, subject, parents = (header.split("\x1f") + [""] * 6)[:6]
        files = []
        for line in rest.splitlines():
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            path = parts[-1]
            if path.startswith(exclude):
                continue
            files.append({"path": path, "status": _STATUS.get(parts[0][:1], "modified"),
                          "category": categorise(path, categories)})
        commits.append({"hash": full, "short": short, "author": author, "date": date, "subject": subject,
                        "files": files, "merge": len(parents.split()) > 1})
    branch = (_git(root, "rev-parse", "--abbrev-ref", "HEAD") or "").strip()
    return {"available": True, "branch": branch, "commits": commits}
