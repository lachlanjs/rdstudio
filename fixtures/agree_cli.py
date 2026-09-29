"""Do the Python and Node command lines print the same thing?

    python fixtures/agree_cli.py [project folders...]

Runs each ported command in each project with both command lines and compares
standard output and the exit code. With no folders, uses the fixture bundles
(each copied into a temporary project) and this repository. Commands that
write run on separate copies, and the written files are compared too. YAML
error messages come from each language's parser and are compared only up to
"unparseable YAML frontmatter:".
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PYTHON = [sys.executable, "-m", "rdstudio.cli"]
NODE = ["node", str(REPO / "packages" / "cli" / "src" / "main.ts")]
# A YAML error message, which may run over several lines, up to the next issue or the summary.
YAML_ERROR = re.compile(r"(unparseable YAML frontmatter:)[\s\S]*?(?=\n(?:error|warning) |\n\d+ concepts)")


def run(cmd: list[str], cwd: Path) -> tuple[int, str]:
    out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return out.returncode, YAML_ERROR.sub(r"\1 …", out.stdout)


def commands(project: Path) -> list[list[str]]:
    from rdstudio import config
    from rdstudio.okf import Bundle

    b = Bundle.load(config.load(project).knowledge_dir)
    ids = sorted(b.concepts)
    words = [w for c in ids[:: max(1, len(ids) // 5)] for w in b.concepts[c].title.split()[:2]]
    out = [["check"], ["check", "-w"], ["path"], ["path", "no/such/note"], ["learner", "where"],
           ["learner", "log", "-n", "3"], ["--version"]]
    out += [["path", c] for c in ids[:: max(1, len(ids) // 4)]]
    for w in words[:6]:
        out += [["search", w], ["search", w, "--json", "-n", "3"]]
    if ids:
        top = ids[0].split("/")[0]
        out += [["search", words[0] if words else "note", "--under", top], ["search", "a", "--type", "definition"]]
    return out


def files(root: Path) -> dict[str, str]:
    return {p.relative_to(root).as_posix(): p.read_text(encoding="utf-8")
            for p in sorted(root.rglob("index.md"))}


def compare(project: Path) -> list[str]:
    diffs = []
    for args in commands(project):
        a, b = run(PYTHON + args, project), run(NODE + args, project)
        if a != b:
            diffs.append(f"  rdstudio {' '.join(args)}: exit {a[0]} vs {b[0]}" + (
                "" if a[1] == b[1] else f"\n    python: {a[1][:300]!r}\n    node:   {b[1][:300]!r}"))
    with tempfile.TemporaryDirectory() as tmp:  # index writes files: one copy each
        py, nd = Path(tmp, "py"), Path(tmp, "node")
        ignore = shutil.ignore_patterns(".git", ".rdstudio", ".venv", "node_modules")
        shutil.copytree(project, py, ignore=ignore)
        shutil.copytree(project, nd, ignore=ignore)
        for f in [*py.rglob("index.md"), *nd.rglob("index.md")]:
            f.unlink()  # so both write every index
        a, b = run(PYTHON + ["index"], py), run(NODE + ["index"], nd)
        if a != b:
            diffs.append(f"  rdstudio index: {a!r} vs {b!r}")
        if files(py) != files(nd):
            diffs.append("  rdstudio index: the written index.md files differ")
    return diffs


def main(argv: list[str]) -> int:
    projects = [Path(p) for p in argv]
    tmp = None
    if not projects:
        tmp = tempfile.TemporaryDirectory()
        for bundle in sorted((HERE / "bundles").iterdir()):
            proj = Path(tmp.name, bundle.name)
            shutil.copytree(bundle, proj / "knowledge")
            (proj / "rdstudio.toml").write_text(f'[project]\ntitle = "{bundle.name}"\n')
            projects.append(proj)
        projects.append(REPO)
    total = 0
    for project in projects:
        diffs = compare(project)
        total += len(diffs)
        print(f"{project.name}: {len(commands(project)) + 1} commands, {'agree' if not diffs else f'{len(diffs)} differ'}")
        if diffs:
            print("\n".join(diffs[:20]))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
