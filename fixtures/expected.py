"""Conformance fixtures: what an OKF implementation must compute for each bundle
in fixtures/bundles/, recorded from the Python core in fixtures/expected/.

    python fixtures/expected.py            # check the Python core against them
    python fixtures/expected.py --update   # record them again (review the diff)

Any other implementation (the TypeScript core) produces the same JSON and compares.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from rdstudio import learner
from rdstudio.okf import Bundle, headings, iso, jsonable
from rdstudio.search import Index

HERE = Path(__file__).resolve().parent
BUNDLES = HERE / "bundles"
EXPECTED = HERE / "expected"
QUERIES = json.loads((HERE / "queries.json").read_text(encoding="utf-8"))
RECORDS = HERE / "learner"
FORMAT = 1  # bump when the snapshot's shape changes


def snapshot(root: Path, queries: list[str]) -> dict[str, Any]:
    """Everything an implementation must agree on, as plain JSON. Nothing here
    depends on the clock, the file system's times or the order files are listed."""
    b = Bundle.load(root)
    order = b.prerequisite_order()
    index = Index(b)
    concepts = {}
    for cid, c in sorted(b.concepts.items()):
        human = c.last_human_verification
        concepts[cid] = {
            "path": c.path,
            "directory": c.directory,
            "title": c.title,
            "type": c.type,
            "description": c.description,
            "tags": c.tags,
            "status": c.status,
            "meta": jsonable(c.meta),
            "trust": c.trust,
            "generated_at": iso(c.generated_at) if c.generated_at else None,
            "last_human_verification": iso(human) if human else None,
            "verification_stale": c.verification_stale,
            "content_stale": c.content_stale,  # fixtures use dates far from today
            "hash": learner.content_hash(c.body),
            "headings": [[h.level, h.text, h.slug, h.line] for h in headings(c.body)],
            "links": [[l.target, l.kind, l.broken, l.rel] for l in c.links],
            "backlinks": b.backlinks(cid),
            "requires": b.requires_graph()[cid],
            "prerequisites": b.prerequisites(cid),
            "order": order[cid]["order"],
            "depth": order[cid]["depth"],
        }
    return {
        "format": FORMAT,
        "root_meta": jsonable(b.root_meta),
        "concepts": concepts,
        "directories": {
            did: {"concepts": sorted(d.concepts), "children": sorted(d.children),
                  "has_index": d.has_index, "has_log": d.has_log}
            for did, d in sorted(b.directories.items())
        },
        # Compared as a set: implementations may find issues in any order.
        "issues": sorted([i.path, i.level, i.code] for i in b.lint()),
        "requires_cycles": b.requires_cycles(),
        "indexes": {did: b.render_index(did) for did in sorted(b.directories)},
        "search": {q: [[h.concept.id, round(h.score, 3), h.snippet] for h in index.search(q, limit=10)]
                   for q in queries},
    }


def learner_snapshot() -> dict[str, Any]:
    """Learner records: each file as read (ids given to events written before
    ids, repeats dropped, unreadable lines skipped), and all merged."""
    records = {p.name: learner.read(p) for p in sorted(RECORDS.glob("*.jsonl"))}
    return {"format": FORMAT, "read": records, "merged": learner.merge(*records.values())}


def dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def names() -> list[str]:
    return sorted(p.name for p in BUNDLES.iterdir() if p.is_dir())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--update", action="store_true", help="record the expected output again")
    args = ap.parse_args(argv)
    EXPECTED.mkdir(exist_ok=True)
    failed = []
    outputs = {f"{name}.json": lambda name=name: snapshot(BUNDLES / name, QUERIES.get(name, [])) for name in names()}
    outputs["learner.json"] = learner_snapshot
    for file, make in outputs.items():
        name = file[:-5]
        got = dump(make())
        path = EXPECTED / file
        if args.update:
            path.write_text(got, encoding="utf-8")
        elif not path.exists() or path.read_text(encoding="utf-8") != got:
            failed.append(name)
    if args.update:
        print(f"recorded {len(outputs)} files in {EXPECTED}")
        return 0
    for name in failed:
        print(f"{name}: differs from fixtures/expected/{name}.json", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
