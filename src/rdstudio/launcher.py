"""The ``rdstudio`` command: runs the Node command line (packages/cli in the
repository), bundled into this package at release, with Node from the
``nodejs-wheel-binaries`` dependency, so ``uv tool install rdstudio`` needs
nothing else.

- In a checkout (an editable install), the TypeScript sources run directly.
- ``RDSTUDIO_PYTHON=1`` (or the ``rdstudio-py`` command) runs the Python
  command line instead, while it lasts; so does a missing Node program.
- ``RDSTUDIO_NODE`` names another node executable (24 or later).
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


def python_cli() -> None:
    from .cli import main as python_main

    sys.exit(python_main())


def main() -> None:
    if os.environ.get("RDSTUDIO_PYTHON"):
        python_cli()
    script, node = program(), node_executable()
    if script is None or node is None:
        print("rdstudio: the Node command line is not available here; using the Python one.", file=sys.stderr)
        python_cli()
    env = {**os.environ, "RDSTUDIO_WEB_DIR": str(HERE / "web"), "RDSTUDIO_TEMPLATES_DIR": str(HERE / "templates")}
    args = [node, str(script), *sys.argv[1:]]
    if os.name == "posix":
        os.execve(node, args, env)  # hand over the process: stdio for MCP, signals for serve
    sys.exit(subprocess.run(args, env=env).returncode)


if __name__ == "__main__":
    main()
