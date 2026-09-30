"""Does the Node build write exactly what the Python build writes?

    python fixtures/agree_build.py [project folders...]

Copies each project (with its git history) twice, builds one copy with each
command line (and exports each), and compares every file written, byte for
byte, apart from the build time in data/version.json. With no folders, uses
the fixture bundles (each made into a small git project) and this repository.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PYTHON = [sys.executable, "-m", "rdstudio.cli"]
NODE = ["node", str(REPO / "packages" / "cli" / "src" / "main.ts")]


def tree(root: Path) -> dict[str, bytes]:
    """Every file's bytes, with the build time dropped and YAML error messages
    (worded by each language's parser) blanked; the data version, a hash that
    includes those messages, is then left out too."""
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file():
            out[p.relative_to(root).as_posix()] = p.read_bytes()
    for rel in [r for r in out if r.endswith("data/site.json")]:
        site = json.loads(out[rel])
        worded = [i for i in site.get("issues", []) if i.get("code") == "frontmatter-invalid"]
        for issue in worded:
            issue["message"] = "…"
        out[rel] = json.dumps(site).encode()
        version = rel.replace("site.json", "version.json")
        if worded:
            out.pop(version, None)
        elif version in out:
            out[version] = json.dumps(json.loads(out[version])["version"]).encode()
    return out


def compare_trees(a: Path, b: Path, label: str) -> list[str]:
    ta, tb = tree(a), tree(b)
    diffs = [f"  {label}: only in the Python output: {p}" for p in sorted(ta.keys() - tb.keys())]
    diffs += [f"  {label}: only in the Node output: {p}" for p in sorted(tb.keys() - ta.keys())]
    for p in sorted(ta.keys() & tb.keys()):
        if ta[p] != tb[p]:
            x, y = ta[p], tb[p]
            i = next((i for i in range(min(len(x), len(y))) if x[i] != y[i]), min(len(x), len(y)))
            diffs.append(f"  {label}: {p} differs at byte {i}:\n    python: {x[max(0, i - 60):i + 80]!r}\n    node:   {y[max(0, i - 60):i + 80]!r}")
    return diffs


def compare(project: Path) -> list[str]:
    diffs = []
    with tempfile.TemporaryDirectory() as tmp:
        py, nd = Path(tmp, "py", project.name), Path(tmp, "node", project.name)
        ignore = shutil.ignore_patterns(".rdstudio", ".venv", "node_modules", ".bench")
        for d in (py, nd):
            shutil.copytree(project, d, ignore=ignore, symlinks=True)
        for cmd, where in ((PYTHON, py), (NODE, nd)):
            out = subprocess.run(cmd + ["build"], cwd=where, capture_output=True, text=True)
            if out.returncode:
                diffs.append(f"  build failed ({cmd[0]}): {out.stderr[-400:]}")
        diffs += compare_trees(py / ".rdstudio" / "site", nd / ".rdstudio" / "site", "build")
        diffs += compare_trees(py / "knowledge", nd / "knowledge", "indexes written")
        for cmd, where in ((PYTHON, py), (NODE, nd)):
            subprocess.run(cmd + ["export", str(where.parent / "export")], cwd=where, capture_output=True)
        diffs += compare_trees(py.parent / "export", nd.parent / "export", "export")
    return diffs


def git_project(bundle: Path, into: Path) -> Path:
    proj = into / bundle.name
    shutil.copytree(bundle, proj / "knowledge")
    (proj / "rdstudio.toml").write_text(f'[project]\ntitle = "{bundle.name}"\n')
    (proj / "reports").mkdir()
    (proj / "reports" / "note.html").write_text(
        '<html><head><title>A  report &amp; notes</title><meta name="rdstudio:date" content="2026-09-01">'
        '</head><body><a href="../knowledge/x.md">x</a> <a href="#/k/y">y</a></body></html>')
    git = ["git", "-C", str(proj), "-c", "user.name=Fixture", "-c", "user.email=f@example.org"]
    subprocess.run(git + ["init", "-q"], check=True)
    subprocess.run(git + ["add", "-A"], check=True)
    subprocess.run(git + ["commit", "-qm", "Fixture bundle", "--date", "2026-01-01T00:00:00Z"], check=True,
                   env={"GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z", "PATH": "/usr/bin:/bin"})
    (proj / "knowledge" / "uncommitted.md").write_text("---\ntype: Concept\n---\nNew.\n")
    return proj


def main(argv: list[str]) -> int:
    projects = [Path(p).resolve() for p in argv]
    tmp = tempfile.TemporaryDirectory()
    if not projects:
        projects = [git_project(b, Path(tmp.name)) for b in sorted((HERE / "bundles").iterdir())] + [REPO]
    total = 0
    for project in projects:
        diffs = compare(project)
        total += len(diffs)
        print(f"{project.name}: {'identical' if not diffs else f'{len(diffs)} differences'}")
        if diffs:
            print("\n".join(diffs[:15]))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
