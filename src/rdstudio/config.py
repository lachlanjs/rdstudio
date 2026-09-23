"""Project (``rdstudio.toml``) and user (``~/.config/rdstudio/config.toml``) configuration."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PROJECT_FILE = "rdstudio.toml"

DEFAULT_CATEGORIES: dict[str, list[str]] = {
    "knowledge": ["{knowledge}/**"],
    "reports": ["{reports}/**"],
    "agent": [".claude/**", ".mcp.json", "CLAUDE.md", "AGENTS.md", ".opencode/**", "opencode.json",
              "opencode.jsonc", "rdstudio.toml"],
    "code": [
        "**/*.py", "**/*.pyi", "**/*.ts", "**/*.js", "**/*.svelte", "**/*.rs", "**/*.c",
        "**/*.cpp", "**/*.h", "**/*.jl", "**/*.go", "**/*.java", "**/*.sh", "**/*.css",
        "**/*.html", "**/*.toml", "**/*.lock", "**/pyproject.toml", "**/package.json",
    ],
}


def user_config_path() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "rdstudio" / "config.toml"


def _read_toml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    with path.open("rb") as fh:
        return tomllib.load(fh)


def find_project_root(start: Path | None = None) -> Path | None:
    """Walk up from ``start`` to the nearest directory holding ``rdstudio.toml``."""
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / PROJECT_FILE).is_file():
            return candidate
    return None


@dataclass
class Config:
    root: Path
    title: str = "rdstudio"
    knowledge: str = "knowledge"
    reports: str = "reports"
    output: str = ".rdstudio"
    human: str = ""  # e.g. "human:lachlan"
    agent: str = "claude-code/unknown"
    categories: dict[str, list[str]] = field(default_factory=dict)
    global_bundle: Path | None = None
    use_global: bool = True
    is_project: bool = True
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def knowledge_dir(self) -> Path:
        return self.root / self.knowledge

    @property
    def reports_dir(self) -> Path:
        return self.root / self.reports

    @property
    def output_dir(self) -> Path:
        return self.root / self.output

    @property
    def site_dir(self) -> Path:
        return self.output_dir / "site"

    def category_globs(self) -> dict[str, list[str]]:
        cats = self.categories or DEFAULT_CATEGORIES
        fmt = {"knowledge": self.knowledge, "reports": self.reports}
        return {name: [g.format(**fmt) for g in globs] for name, globs in cats.items()}


def load(start: Path | None = None) -> Config:
    """Load configuration for the project containing ``start`` (default: cwd).

    Outside a project, the root is ``start`` itself and defaults apply.
    """
    user = _read_toml(user_config_path())
    root = find_project_root(start)
    is_project = root is not None
    root = root or (start or Path.cwd()).resolve()
    project = _read_toml(root / PROJECT_FILE)

    proj = project.get("project", {})
    paths = project.get("paths", {})
    actors = {**user.get("actors", {}), **project.get("actors", {})}
    glob = user.get("global", {})

    global_path = glob.get("path")
    cfg = Config(
        root=root,
        title=proj.get("title") or root.name,
        knowledge=paths.get("knowledge", "knowledge"),
        reports=paths.get("reports", "reports"),
        output=paths.get("output", ".rdstudio"),
        human=actors.get("human", ""),
        agent=actors.get("agent", "claude-code/unknown"),
        categories=project.get("changes", {}).get("categories", {}),
        global_bundle=Path(global_path).expanduser() if global_path else None,
        use_global=project.get("global", {}).get("enabled", True),
        is_project=is_project,
        raw=project,
    )
    return cfg
