"""The ``rdstudio`` command: runs the Node command line (packages/cli in the
repository), bundled into this package at release, with Node from the
``nodejs-wheel-binaries`` dependency, so ``uv tool install rdstudio`` needs
nothing else.

- In a checkout (an editable install), the TypeScript sources run directly.
- ``RDSTUDIO_NODE`` names another node executable (24 or later).

This package holds nothing else of rdstudio: the Node program is the only
implementation (T102).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUNDLE = HERE / "_node" / "rdstudio.mjs"  # built by `npm run bundle --workspace rdstudio`
SOURCE = HERE.parent.parent / "packages" / "cli" / "src" / "main.ts"  # present in a checkout


def node_executable() -> str | None:
    if os.environ.get("RDSTUDIO_NODE"):
        return os.environ["RDSTUDIO_NODE"]
    try:
        from nodejs_wheel import executable
    except ImportError:
        return shutil.which("node")
    return os.path.join(executable.ROOT_DIR, "node.exe" if os.name == "nt" else os.path.join("bin", "node"))


def program() -> Path | None:
    """The Node program to run: the sources in a checkout, else the bundle."""
    if SOURCE.is_file() and (SOURCE.parents[3] / "node_modules").is_dir():  # the repository root
        return SOURCE
    return BUNDLE if BUNDLE.is_file() else None


def main() -> None:
    script, node = program(), node_executable()
    if script is None:
        sys.exit("rdstudio: the Node program is missing from this installation (rdstudio/_node/rdstudio.mjs). "
                 "Install it again: uv tool install --reinstall rdstudio; or run it with npx rdstudio.")
    if node is None:
        sys.exit("rdstudio: no node executable was found. Install it again (uv tool install --reinstall rdstudio), "
                 "or name one, version 24 or later, in RDSTUDIO_NODE.")
    env = {**os.environ, "RDSTUDIO_WEB_DIR": str(HERE / "web"), "RDSTUDIO_TEMPLATES_DIR": str(HERE / "templates")}
    args = [node, str(script), *sys.argv[1:]]
    if os.name == "posix":
        os.execve(node, args, env)  # hand over the process: stdio for MCP, signals for serve
    sys.exit(subprocess.run(args, env=env).returncode)


if __name__ == "__main__":
    main()
