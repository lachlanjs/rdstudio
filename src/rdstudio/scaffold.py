"""``rdstudio init``: scaffold rdstudio into a repository, idempotently."""

from __future__ import annotations

import getpass
import json
import re
import shutil
from pathlib import Path
from typing import Iterator

from . import config as config_mod
from .okf import Bundle, dump_frontmatter, split_frontmatter

TEMPLATES = Path(__file__).parent / "templates"
SECTION_START = "<!-- rdstudio:start"
SECTION_END = "<!-- rdstudio:end -->"
HOOK_COMMAND = "rdstudio brief"
OPENCODE_AGENT = "opencode/unknown"

# OpenCode subagent permissions; Claude Code's equivalent is each agent's `tools` list.
OPENCODE_PERMISSIONS: dict[str, dict[str, str]] = {
    "librarian": {"edit": "deny", "bash": "deny", "webfetch": "deny"},
    "critic": {"edit": "deny", "bash": "deny", "webfetch": "deny"},
    "searcher": {"edit": "deny"},
}


def _fill(text: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        text = text.replace("{" + key + "}", value)
    return text


def _write(path: Path, content: str, root: Path, *, force: bool = False) -> str | None:
    rel = path.relative_to(root).as_posix()
    if path.exists():
        if not force or path.read_text(encoding="utf-8") == content:
            return None
        path.write_text(content, encoding="utf-8")
        return f"updated {rel}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return f"created {rel}"


def _uses_dev_dependency(root: Path) -> bool:
    pyproject = root / "pyproject.toml"
    return pyproject.is_file() and re.search(r"[\"']rdstudio\b", pyproject.read_text(encoding="utf-8")) is not None


def mcp_command(root: Path) -> dict[str, object]:
    if _uses_dev_dependency(root) or not shutil.which("rdstudio"):
        return {"command": "uv", "args": ["run", "rdstudio", "mcp"]}
    return {"command": "rdstudio", "args": ["mcp"]}


def opencode_agent(src: str, name: str) -> str:
    """Translate a Claude Code subagent file into an OpenCode one."""
    meta, body = split_frontmatter(src)
    meta = meta or {}
    out = {"description": meta.get("description", name), "mode": "subagent"}
    if name in OPENCODE_PERMISSIONS:
        out["permission"] = OPENCODE_PERMISSIONS[name]
    return f"---\n{dump_frontmatter(out)}---\n{body}"


def _merge_json(path: Path, root: Path, update) -> str | None:
    data = {}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8") or "{}")
        except json.JSONDecodeError:
            return f"skipped {path.relative_to(root).as_posix()} (not valid JSON; add rdstudio by hand)"
    before = json.dumps(data, sort_keys=True)
    update(data)
    if json.dumps(data, sort_keys=True) == before:
        return None
    existed = path.exists()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{'updated' if existed else 'created'} {path.relative_to(root).as_posix()}"


def _managed_section(path: Path, section: str, root: Path, *, create: bool) -> str | None:
    rel = path.relative_to(root).as_posix()
    if not path.exists():
        if not create:
            return None
        path.write_text(f"# {root.name}\n\n{section}", encoding="utf-8")
        return f"created {rel}"
    text = path.read_text(encoding="utf-8")
    if SECTION_START in text and SECTION_END in text:
        start = text.index(SECTION_START)
        end = text.index(SECTION_END) + len(SECTION_END)
        new = text[:start] + section.strip() + text[end:]
    else:
        new = text.rstrip() + "\n\n" + section
    if new == text:
        return None
    path.write_text(new, encoding="utf-8")
    return f"updated {rel}"


def init(root: Path, *, title: str | None = None, human: str | None = None, force: bool = False) -> Iterator[str]:
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)

    toml = root / config_mod.PROJECT_FILE
    if not toml.exists():
        human = human or config_mod.load(root).human or f"human:{getpass.getuser()}"
        if not human.startswith("human:"):
            human = f"human:{human}"
        toml.write_text(
            "# rdstudio project configuration\n"
            "[project]\n"
            f'title = "{title or root.name}"\n\n'
            "[paths]\n"
            'knowledge = "knowledge"\n'
            'reports = "reports"\n\n'
            "[actors]\n"
            f'human = "{human}"\n'
            'agent = "claude-code/claude"\n\n'
            "# Which files count as which kind of change in the Changes tab.\n"
            "# [changes.categories]\n"
            '# code = ["src/**", "tests/**"]\n',
            encoding="utf-8",
        )
        yield f"created {config_mod.PROJECT_FILE}"
    cfg = config_mod.load(root)
    values = {
        "title": cfg.title,
        "knowledge": cfg.knowledge,
        "reports": cfg.reports,
        "human": cfg.human or "human:<you>",
        "agent": cfg.agent,
    }

    # Knowledge bundle placeholders (never overwritten).
    for src in sorted((TEMPLATES / "knowledge").rglob("*.md")):
        dst = cfg.knowledge_dir / src.relative_to(TEMPLATES / "knowledge")
        if msg := _write(dst, _fill(src.read_text(encoding="utf-8"), values), root):
            yield msg

    cfg.reports_dir.mkdir(parents=True, exist_ok=True)
    if msg := _write(cfg.reports_dir / ".gitkeep", "", root):
        yield msg

    # Skills and agents (rdstudio-managed: --force refreshes them).
    for src in sorted((TEMPLATES / "skills").rglob("*")):
        if src.is_file():
            dst = root / ".claude" / "skills" / src.relative_to(TEMPLATES / "skills")
            if msg := _write(dst, _fill(src.read_text(encoding="utf-8"), values), root, force=force):
                yield msg
    for src in sorted((TEMPLATES / "agents").glob("*.md")):
        text = _fill(src.read_text(encoding="utf-8"), values)
        if msg := _write(root / ".claude" / "agents" / src.name, text, root, force=force):
            yield msg
        if msg := _write(root / ".opencode" / "agents" / src.name, opencode_agent(text, src.stem), root, force=force):
            yield msg

    # MCP registration and Claude Code settings.
    command = mcp_command(root)

    def add_server(data: dict) -> None:
        data.setdefault("mcpServers", {})["rdstudio"] = command

    if msg := _merge_json(root / ".mcp.json", root, add_server):
        yield msg

    def add_settings(data: dict) -> None:
        enabled = data.setdefault("enabledMcpjsonServers", [])
        if "rdstudio" not in enabled:
            enabled.append("rdstudio")
        allow = data.setdefault("permissions", {}).setdefault("allow", [])
        if "mcp__rdstudio" not in allow:
            allow.append("mcp__rdstudio")
        hooks = data.setdefault("hooks", {}).setdefault("SessionStart", [])
        brief = HOOK_COMMAND if command["command"] == "rdstudio" else "uv run " + HOOK_COMMAND
        present = any(h.get("command", "").endswith(HOOK_COMMAND) for entry in hooks for h in entry.get("hooks", []))
        if not present:
            hooks.append({"hooks": [{"type": "command", "command": brief}]})

    if msg := _merge_json(root / ".claude" / "settings.json", root, add_settings):
        yield msg

    # OpenCode: MCP registration. It reads skills from .claude/skills directly.
    def add_opencode(data: dict) -> None:
        data.setdefault("$schema", "https://opencode.ai/config.json")
        data.setdefault("mcp", {})["rdstudio"] = {
            "type": "local",
            "command": [command["command"], *command["args"], "--agent", OPENCODE_AGENT],
            "enabled": True,
        }

    jsonc = root / "opencode.jsonc"
    if jsonc.exists() and not (root / "opencode.json").exists():
        msg = _merge_json(jsonc, root, add_opencode)
    else:
        msg = _merge_json(root / "opencode.json", root, add_opencode)
    if msg:
        yield msg

    # Instructions: the shared section lives in AGENTS.md (read by OpenCode, Codex
    # and others); CLAUDE.md imports it.
    section = _fill((TEMPLATES / "agents_section.md").read_text(encoding="utf-8"), values)
    if msg := _managed_section(root / "AGENTS.md", section, root, create=True):
        yield msg
    claude_md = root / "CLAUDE.md"
    if not (claude_md.is_symlink() and claude_md.resolve() == (root / "AGENTS.md").resolve()):
        section = (TEMPLATES / "claude_section.md").read_text(encoding="utf-8")
        if msg := _managed_section(claude_md, section, root, create=True):
            yield msg

    gitignore = root / ".gitignore"
    ignore_line = cfg.output.strip("/") + "/"
    lines = gitignore.read_text(encoding="utf-8").splitlines() if gitignore.exists() else []
    if ignore_line not in lines and f"/{ignore_line}" not in lines:
        with gitignore.open("a", encoding="utf-8") as fh:
            prefix = "\n" if lines and lines[-1].strip() else ""
            fh.write(f"{prefix}# rdstudio build output\n{ignore_line}\n")
        yield "updated .gitignore"

    for rel in Bundle.load(cfg.knowledge_dir).write_indexes():
        yield f"wrote {cfg.knowledge}/{rel}"

    yield "done. Next: `rdstudio serve` for the dashboard; start an agent session (Claude Code, OpenCode, ...) and run the bootstrap task."
