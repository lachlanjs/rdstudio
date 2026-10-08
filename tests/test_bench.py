import json
import subprocess
import sys
from pathlib import Path

BENCH = Path(__file__).resolve().parents[1] / "bench"
sys.path.insert(0, str(BENCH))
import synth  # noqa: E402


def test_synthetic_bundles_are_valid_and_repeatable(tmp_path):
    count = synth.generate(tmp_path / "a", 3, 4)
    assert count == synth.generate(tmp_path / "b", 3, 4) > 20
    # Read by the core (bench/bundle.ts), as the benchmark reads it.
    out = subprocess.run(["node", str(BENCH / "bundle.ts"), str(tmp_path / "a")], capture_output=True, text=True, check=True)
    got = json.loads(out.stdout)
    assert got["notes"] == count
    assert got["errors"] == 0
    assert got["cycles"] == 0  # requires links point back in reading order
    assert {"requires", "uses", "see also"} <= set(got["ratings"])
    assert got["broken"] == 0
    a = sorted(p.read_text() for p in (tmp_path / "a").rglob("*.md"))
    assert a == sorted(p.read_text() for p in (tmp_path / "b").rglob("*.md"))
