"""Do the Python and Node stores leave notes that read the same?

    python fixtures/agree_writes.py

Runs one sequence of writes (create, update frontmatter, replace a section,
append, let the classifier decide, verify) through each store on copies of
the basics fixture, then reads every note back with the Python core and
compares frontmatter and body, times aside. The Node store edits frontmatter
in place and the Python one re-renders it, so the bytes may differ; what the
notes say must not.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))
from rdstudio import store  # noqa: E402
from rdstudio.okf import Bundle, jsonable  # noqa: E402

SCRIPT = HERE.parent / "packages" / "cli" / "scripts" / "writes.ts"
ACTOR, HUMAN = "agent/test", "human:tester"

OPS = [
    {"op": "record", "id": "new/idea", "actor": ACTOR, "meta": {"type": "Idea", "title": "A new idea", "tags": ["x", "y"],
                                                               "description": "Line one\nline two"},
     "body": "# Idea\n\nSomething new."},
    {"op": "record", "id": "design/model", "actor": ACTOR, "meta": {"status": "stable", "custom_key": None, "extra": {"a": 1, "b": [1, 2]}},
     "significant": False},
    {"op": "record", "id": "design/model", "actor": ACTOR, "section": "Dynamics", "body": "Tanh units, rewritten.", "significant": True},
    {"op": "record", "id": "design/model", "actor": ACTOR, "section": "A new section", "body": "Appended as a section."},
    {"op": "record", "id": "research/spectrum", "actor": ACTOR, "append": "One more line.", "significant": None},
    {"op": "record", "id": "research/fresh", "actor": ACTOR, "body": "Still good!", "significant": None},
    {"op": "record", "id": "research/stale", "actor": ACTOR, "meta": {"title": "Stale (renamed)"}, "significant": None},
    {"op": "record", "id": "research/stale", "actor": ACTOR, "meta": {"type": None}},
    {"op": "record", "id": "../escape", "actor": ACTOR, "meta": {"type": "X"}},
    {"op": "record", "id": "research/index", "actor": ACTOR, "meta": {"type": "X"}},
    {"op": "verify", "id": "design/overview", "actor": HUMAN},
    {"op": "verify", "id": "design/model", "actor": HUMAN},
    {"op": "verify", "id": "new/idea", "actor": HUMAN},
    {"op": "verify", "id": "no/such", "actor": HUMAN},
]


def run_python(root: Path) -> list:
    out = []
    for op in OPS:
        args = {k: v for k, v in op.items() if k not in ("op", "id")}
        try:
            r = store.verify(root, op["id"], actor=args["actor"]) if op["op"] == "verify" else store.record(root, op["id"], **args)
            out.append(r.as_dict())
        except store.StoreError as exc:
            out.append({"error": str(exc)})
    return out


def untimed(value):
    if isinstance(value, dict):
        return {k: ("<time>" if k == "at" else untimed(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [untimed(v) for v in value]
    return value


def notes(root: Path) -> dict:
    b = Bundle.load(root)
    return {cid: {"meta": untimed(jsonable(c.meta)), "body": c.body.strip()} for cid, c in sorted(b.concepts.items())}


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        py, nd = Path(tmp, "py"), Path(tmp, "node")
        for d in (py, nd):
            shutil.copytree(HERE / "bundles" / "basics", d)
        a = run_python(py)
        b = json.loads(subprocess.run(["node", str(SCRIPT), str(nd)], input=json.dumps(OPS), capture_output=True,
                                      text=True, check=True).stdout)
        diffs = []
        for op, x, y in zip(OPS, a, b):
            if ("error" in x) != ("error" in y) or ("error" not in x and x != y):
                diffs.append(f"  {op['op']} {op['id']}: python {x} / node {y}")
        na, nb = notes(py), notes(nd)
        for cid in sorted(set(na) | set(nb)):
            if na.get(cid) != nb.get(cid):
                diffs.append(f"  note {cid}:\n    python {na.get(cid)}\n    node   {nb.get(cid)}")
        print(f"{len(OPS)} writes: {'the notes read the same' if not diffs else f'{len(diffs)} differences'}")
        print("\n".join(diffs))
        if "-v" in sys.argv:
            for rel in ("new/idea.md", "design/model.md", "design/overview.md"):
                print(f"--- python {rel}\n{(py / rel).read_text()}\n--- node {rel}\n{(nd / rel).read_text()}")
        return 1 if diffs else 0


if __name__ == "__main__":
    sys.exit(main())
