"""A short orientation for the start of an agent session (``rdstudio brief``).

Printed by a Claude Code SessionStart hook, so it must stay small: it tells the
agent what exists and where to look, not the content itself.
"""

from __future__ import annotations

from . import gitlog
from .config import Config
from .okf import Bundle


def brief(cfg: Config, *, commits: int = 3) -> str:
    b = Bundle.load(cfg.knowledge_dir)
    if not b.concepts:
        return f"rdstudio: no knowledge base found in {cfg.knowledge}/ (run `rdstudio init`)."
    lines = [f"Project knowledge base ({cfg.title}): {len(b.concepts)} concepts in {cfg.knowledge}/, OKF format."]
    root = b.directories[""]
    dirs = []
    for d in sorted(root.children):
        count = sum(1 for cid in b.concepts if cid.startswith(d + "/"))
        dirs.append(f"{d} ({count})")
    if dirs:
        lines.append("Directories: " + ", ".join(dirs))
    active = [c for c in b.concepts.values() if c.type.lower() == "task" and "active" in c.tags]
    if active:
        lines.append("Active tasks: " + "; ".join(f"{c.title} [{c.id}]" for c in active[:5]))
    stale = sum(c.verification_stale for c in b.concepts.values())
    questions = sum(c.type.lower() == "question" and "answered" not in c.tags for c in b.concepts.values())
    unverified = sum(c.trust == "unverified" for c in b.concepts.values())
    lines.append(f"Awaiting the developer: {stale} changed since review, {questions} open questions, {unverified} unverified.")
    history = gitlog.history(cfg.root, cfg.category_globs(), limit=commits, exclude=(cfg.output.strip("/") + "/",))
    recent = [c["subject"] for c in history.get("commits", []) if not c.get("pending")][:commits]
    if recent:
        lines.append("Recent commits: " + " | ".join(recent))
    lines.append("Search it (rdstudio MCP tools, /search-okf, or the librarian subagent) before re-deriving; "
                 "record decisions, questions and findings as you go.")
    return "\n".join(lines)
