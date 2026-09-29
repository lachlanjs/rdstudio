"""Compare two benchmark results from bench/run.py, case by case.

    python bench/compare.py .bench/results/before.json .bench/results/after.json

Lower is better for every metric but fps. Changes under 10% are within the
noise of a run on a desktop, so they are shown but not marked.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

METRICS = [  # (section, key, label, higher is better)
    ("build", "build_ms", "build ms", False),
    ("load", "first_map_ms", "first map ms", False),
    ("load", "settled_ms", "settled ms", False),
    ("load", "layout_ms", "layout ms", False),
    ("load", "routes_ms", "routes ms", False),
    ("load", "render_ms", "render ms", False),
    ("load", "transfer_kb", "transfer KB", False),
    ("interact", "fps", "fps", True),
    ("interact", "frame_p95_ms", "frame p95 ms", False),
    ("interact", "janky_pct", "jank %", False),
    ("interact", "render_p95_ms", "render p95 ms", False),
    ("reload", "first_map_ms", "reload ms", False),
    ("reload", "settled_ms", "reload settled", False),
]
NOISE = 0.10


def cases(path: Path) -> tuple[dict, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["meta"], {(r["bundle"], r["theme"], r["profile"]): r for r in data["runs"]}


def change(a: float | None, b: float | None, higher: bool) -> str:
    if a is None or b is None:
        return f"{a if a is not None else '–'} → {b if b is not None else '–'}"
    if not a:
        return f"{a} → {b}"
    d = (b - a) / a
    mark = "" if abs(d) < NOISE else ("  better" if (d > 0) == higher else "  WORSE")
    return f"{a:g} → {b:g} ({d:+.0%}){mark}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("before", type=Path)
    ap.add_argument("after", type=Path)
    args = ap.parse_args(argv)
    ma, a = cases(args.before)
    mb, b = cases(args.after)
    for m, p in ((ma, args.before), (mb, args.after)):
        print(f"{p.name}: {m.get('label') or ''} @ {m['commit']}{' (dirty)' if m.get('dirty') else ''}, {m['at']}")
    if ma["machine"] != mb["machine"]:
        print("warning: different machines; compare with care")
    for key in sorted(a.keys() & b.keys()):
        print(f"\n{' · '.join(key)}")
        if "error" in a[key] or "error" in b[key]:
            print(f"  {a[key].get('error', 'ok')} → {b[key].get('error', 'ok')}")
            continue
        for section, metric, label, higher in METRICS:
            x, y = a[key].get(section, {}).get(metric), b[key].get(section, {}).get(metric)
            if x is not None or y is not None:
                print(f"  {label:<14}{change(x, y, higher)}")
    only = (a.keys() ^ b.keys())
    if only:
        print("\nin one result only: " + ", ".join(" · ".join(k) for k in sorted(only)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
