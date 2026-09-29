"""Do the Python and TypeScript cores agree on a real bundle?

    python fixtures/agree.py path/to/knowledge [more folders]

Builds the conformance snapshot of each folder with both cores and lists every
difference, note by note (search is left out until the TypeScript core has it).
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
        py = json.loads(expected.dump(expected.snapshot(Path(folder), [])))
        ts = json.loads(subprocess.run(["node", str(SCRIPT), folder], capture_output=True, text=True, check=True).stdout)
        diffs = []
        for part in py:
            if part == "search":
                continue
            if part == "concepts":
                for cid in sorted(set(py[part]) | set(ts.get(part, {}))):
                    a, b = py[part].get(cid), ts.get(part, {}).get(cid)
                    if a != b:
                        fields = sorted(k for k in set(a or {}) | set(b or {}) if (a or {}).get(k) != (b or {}).get(k))
                        diffs.append(f"  note {cid}: {', '.join(fields)}")
            elif py[part] != ts.get(part):
                diffs.append(f"  {part}")
        total += len(diffs)
        print(f"{folder}: {len(py['concepts'])} notes, {'agree' if not diffs else f'{len(diffs)} differences'}")
        print("\n".join(diffs[:40]))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
