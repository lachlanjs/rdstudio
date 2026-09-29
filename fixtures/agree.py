"""Do the Python and TypeScript cores agree on a real bundle?

    python fixtures/agree.py path/to/knowledge [more folders]

Builds the conformance snapshot of each folder with both cores and lists every
difference, note by note. Search is compared with queries made from the notes'
titles and descriptions.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import expected  # noqa: E402

SCRIPT = HERE.parent / "packages" / "core" / "scripts" / "snapshot.ts"


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__.strip().split("\n\n")[1], file=sys.stderr)
        return 2
    total = 0
    for folder in argv:
        from rdstudio.okf import Bundle

        b = Bundle.load(Path(folder))
        notes = [b.concepts[c] for c in sorted(b.concepts)]
        queries = [c.title for c in notes[::max(1, len(notes) // 12)]]
        queries += [" ".join(c.description.split()[:3]) for c in notes[::max(1, len(notes) // 6)] if c.description]
        py = json.loads(expected.dump(expected.snapshot(Path(folder), queries)))
        ts = json.loads(subprocess.run(["node", str(SCRIPT), folder, *queries], capture_output=True, text=True,
                                       check=True).stdout)
        diffs = []
        for part in py:
            if part == "search":
                diffs += [f"  search {q!r}" for q in py[part] if py[part][q] != ts.get(part, {}).get(q)]
            elif part == "concepts":
                for cid in sorted(set(py[part]) | set(ts.get(part, {}))):
                    a, b = py[part].get(cid), ts.get(part, {}).get(cid)
                    if a != b:
                        fields = sorted(k for k in set(a or {}) | set(b or {}) if (a or {}).get(k) != (b or {}).get(k))
                        diffs.append(f"  note {cid}: {', '.join(fields)}")
            elif py[part] != ts.get(part):
                diffs.append(f"  {part}")
        total += len(diffs)
        print(f"{folder}: {len(py['concepts'])} notes, {len(queries)} searches, "
              f"{'agree' if not diffs else f'{len(diffs)} differences'}")
        print("\n".join(diffs[:40]))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
