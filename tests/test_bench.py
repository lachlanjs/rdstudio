import sys
from pathlib import Path

from rdstudio.okf import Bundle

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bench"))
import synth  # noqa: E402


def test_synthetic_bundles_are_valid_and_repeatable(tmp_path):
    count = synth.generate(tmp_path / "a", 3, 4)
    assert count == synth.generate(tmp_path / "b", 3, 4) > 20
    bundle = Bundle.load(tmp_path / "a" / "knowledge")
    assert len(bundle.concepts) == count
    assert not [i for i in bundle.lint() if i.level == "error"]
    assert not bundle.requires_cycles()  # requires links point back in reading order
    ratings = [l.rel for c in bundle.concepts.values() for l in c.links]
    assert {"requires", "uses", "see also"} <= set(ratings)
    assert not any(l.broken for c in bundle.concepts.values() for l in c.links)
    a = sorted(p.read_text() for p in (tmp_path / "a").rglob("*.md"))
    assert a == sorted(p.read_text() for p in (tmp_path / "b").rglob("*.md"))
