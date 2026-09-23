import pytest

from rdstudio.okf import Bundle, split_frontmatter
from rdstudio.store import StoreError, record, verify


def test_create_and_minor_update(bundle_dir):
    r = record(bundle_dir, "decisions/d1", actor="agent/y", meta={"type": "Decision", "title": "D1"}, body="# Decision\n\nX.")
    assert r.created and r.path == "decisions/d1.md"
    meta, body = split_frontmatter((bundle_dir / r.path).read_text())
    assert meta["type"] == "Decision" and meta["generated"]["by"] == "agent/y"
    first = meta["generated"]["at"]
    record(bundle_dir, "decisions/d1", actor="agent/z", append="Typo fix.", significant=False)
    meta, body = split_frontmatter((bundle_dir / r.path).read_text())
    assert meta["generated"]["by"] == "agent/y" and meta["generated"]["at"] == first
    assert body.rstrip().endswith("Typo fix.")


def test_section_replace_preserves_unknown_keys(bundle_dir):
    record(bundle_dir, "design/model", actor="agent/y", section="Dynamics", body="ReLU units.")
    meta, body = split_frontmatter((bundle_dir / "design/model.md").read_text())
    assert meta["custom_key"] == "kept"
    assert "ReLU units." in body and "Tanh" not in body and "Genetic programming" in body
    record(bundle_dir, "design/model", actor="agent/y", section="Open issues", body="None yet.")
    assert "# Open issues\n\nNone yet." in (bundle_dir / "design/model.md").read_text()


def test_verify_clears_staleness(bundle_dir):
    assert Bundle.load(bundle_dir).concepts["design/model"].verification_stale
    verify(bundle_dir, "design/model.md", actor="human:alice")
    c = Bundle.load(bundle_dir).concepts["design/model"]
    assert c.trust == "human-reviewed" and not c.verification_stale
    assert len(c.verified) == 3
    text = (bundle_dir / "design/model.md").read_text()
    assert "at: 2026" in text and "'20" not in text  # timestamps unquoted ISO


def test_rejects_bad_ids(bundle_dir):
    for bad in ("../escape", "index", "a/log", ""):
        with pytest.raises(StoreError):
            record(bundle_dir, bad, actor="a", meta={"type": "X"})
    with pytest.raises(StoreError):
        record(bundle_dir, "new/thing", actor="a", body="no type")
