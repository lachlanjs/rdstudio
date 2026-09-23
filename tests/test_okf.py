from rdstudio.okf import Bundle, headings, section, split_frontmatter

from .conftest import write


def test_concepts_and_directories(bundle_dir):
    b = Bundle.load(bundle_dir)
    assert set(b.concepts) == {
        "design/overview", "design/model", "research/spectrum", "research/broken", "research/untyped",
    }
    assert set(b.directories) == {"", "design", "research"}
    assert b.directories[""].children == ["design", "research"]


def test_links(bundle_dir):
    b = Bundle.load(bundle_dir)
    links = {(l.target, l.kind, l.broken) for l in b.concepts["design/overview"].links}
    assert links == {
        ("research/spectrum", "concept", False),
        ("design/model", "concept", False),
        ("nowhere", "concept", True),
        ("research/", "directory", False),
    }
    assert b.backlinks("design/model") == ["design/overview"]


def test_trust_tiers_and_staleness(bundle_dir):
    b = Bundle.load(bundle_dir)
    overview, model, spectrum = (b.concepts[k] for k in ("design/overview", "design/model", "research/spectrum"))
    assert overview.trust == "human-reviewed" and not overview.verification_stale
    assert model.trust == "human-reviewed" and model.verification_stale  # generated after human check
    assert spectrum.trust == "machine-confirmed"
    assert b.concepts["research/untyped"].trust == "unverified"
    assert spectrum.title == "Spectrum"  # derived from filename
    assert model.meta["custom_key"] == "kept"


def test_lint(bundle_dir):
    issues = {(i.path, i.level) for i in Bundle.load(bundle_dir).lint()}
    assert ("research/broken.md", "error") in issues
    assert ("research/untyped.md", "error") in issues
    assert ("design/overview.md", "warning") in issues  # broken link


def test_index_rules(bundle_dir):
    write(bundle_dir, "design/index.md", "---\nokf_version: '0.2'\n---\n# X\n")
    write(bundle_dir, "index.md", "---\nokf_version: '0.2'\n---\n# X\n")
    issues = {(i.path, i.message) for i in Bundle.load(bundle_dir).lint()}
    assert any(p == "design/index.md" for p, _ in issues)
    assert not any(p == "index.md" for p, _ in issues)


def test_generated_indexes(bundle_dir):
    b = Bundle.load(bundle_dir)
    changed = b.write_indexes()
    assert set(changed) == {"index.md", "design/index.md", "research/index.md"}
    root = (bundle_dir / "index.md").read_text()
    assert root.startswith('---\nokf_version: "0.2"\n---')
    assert "* [design](design/) - How the system is designed." in root
    design = (bundle_dir / "design/index.md").read_text()
    assert design.index("# Overview") < design.index("# Design")
    assert "* [Model](model.md) - The recurrent network model with random matrices." in design
    assert Bundle.load(bundle_dir).write_indexes() == []  # idempotent
    assert not [i for i in Bundle.load(bundle_dir).lint() if "index" in i.path]


def test_headings_and_sections(bundle_dir):
    body = split_frontmatter((bundle_dir / "design/model.md").read_text())[1]
    assert [(h.level, h.text) for h in headings(body)] == [(1, "Dynamics"), (2, "Stability"), (1, "Evolution")]
    dyn = section(body, "dynamics")
    assert "Tanh" in dyn and "Spectral radius" in dyn and "Genetic" not in dyn
    assert section(body, "## Stability").startswith("## Stability")
    assert section(body, "missing") is None
