"""Do the Python and Node command lines set up projects the same way?

    python fixtures/agree_scaffold.py

In a temporary home (so the real one is untouched), runs with each command
line: `init` into an empty folder and again over it (and with --force), `init`
into a folder with an existing README-style CLAUDE.md and settings, `global
init` and `global status`, `promote` (refused because of backlinks, copied
with --keep, moved with --force), and `skills list|to-user|to-project`. Then
compares what each printed and every file written. Files whose frontmatter is
written by a YAML library (.opencode/agents/*.md, promoted notes) are compared
by what they say rather than byte for byte.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(REPO / "src"))
from rdstudio.okf import jsonable, split_frontmatter  # noqa: E402

PYTHON = [sys.executable, "-m", "rdstudio.cli"]
NODE = ["node", str(REPO / "packages" / "cli" / "src" / "main.ts")]


def session(cli: list[str], base: Path) -> list[str]:
    home = base / "home"
    (home / ".config" / "rdstudio").mkdir(parents=True)
    env = {**os.environ, "HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config"), "XDG_DATA_HOME": str(home / ".local" / "share"),
           "USER": "tester", "LOGNAME": "tester"}
    log = []

    def run(*args: str, cwd: Path = base) -> None:
        out = subprocess.run(cli + list(args), cwd=cwd, env=env, capture_output=True, text=True)
        log.append(f"$ rdstudio {' '.join(args)}  [exit {out.returncode}]\n{out.stdout}{out.stderr}".replace(str(base), "<base>"))

    run("init", "proj", "--title", "Project", "--human", "lachlan")
    run("init", "proj")
    run("-C", "proj", "init", ".", "--force")
    other = base / "other"
    (other / ".claude").mkdir(parents=True)
    (other / "CLAUDE.md").write_text("# Other\n\nExisting instructions.\n")
    (other / ".claude" / "settings.json").write_text('{"permissions": {"allow": ["Bash(ls)"]}, "model": "x"}')
    (other / ".gitignore").write_text("node_modules/")
    run("init", "other")
    run("global", "status", cwd=base / "proj")
    run("global", "init", str(base / "gk"), "--human", "human:tester")
    run("global", "status", cwd=base / "proj")
    k = base / "proj" / "knowledge"
    (k / "a.md").write_text("---\ntype: Concept\ntitle: A\n---\nSee [b](/b.md).\n")
    (k / "b.md").write_text("---\ntype: Concept\ntitle: B\nsources: [{resource: somewhere}]\n---\nB links to [nothing](/nowhere.md).\n")
    run("promote", "b", cwd=base / "proj")
    run("promote", "b", "--keep", "--as", "shared/b", cwd=base / "proj")
    run("promote", "b", "--force", cwd=base / "proj")
    run("promote", "no/such", cwd=base / "proj")
    run("skills", "list", cwd=base / "proj")
    run("skills", "to-user", "task", cwd=base / "proj")
    run("skills", "to-user", "task", cwd=base / "proj")
    run("skills", "list", cwd=base / "proj")
    run("skills", "to-project", "task", cwd=base / "proj")
    run("skills", "to-user", "nonexistent", cwd=base / "proj")
    return log


def files(base: Path) -> dict[str, object]:
    out: dict[str, object] = {}
    for p in sorted(base.rglob("*")):
        if not p.is_file() or ".git/" in p.as_posix() + "/" and "/.git/" in p.as_posix():
            continue
        rel = p.relative_to(base).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace").replace(str(base), "<base>")
        if "/.opencode/agents/" in f"/{rel}" or rel.endswith(("knowledge/b.md", "shared/b.md")):
            meta, body = split_frontmatter(text)
            out[rel] = {"meta": jsonable(meta), "body": body}
        else:
            out[rel] = text
    return out


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        py, nd = Path(tmp, "py", "run"), Path(tmp, "node", "run")  # the same folder name for both
        py.mkdir(parents=True), nd.mkdir(parents=True)
        a, b = session(PYTHON, py), session(NODE, nd)
        diffs = [f"  {x}\n  vs\n  {y}" for x, y in zip(a, b) if x != y]
        fa, fb = files(py), files(nd)
        diffs += [f"  only in the Python run: {p}" for p in sorted(fa.keys() - fb.keys())]
        diffs += [f"  only in the Node run: {p}" for p in sorted(fb.keys() - fa.keys())]
        for p in sorted(fa.keys() & fb.keys()):
            if fa[p] != fb[p]:
                diffs.append(f"  {p} differs:\n    python {json.dumps(fa[p])[:400]}\n    node   {json.dumps(fb[p])[:400]}")
        print(f"{len(a)} commands, {len(fa)} files: {'the same' if not diffs else f'{len(diffs)} differences'}")
        print("\n".join(diffs[:30]))
        return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
