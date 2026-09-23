import json

from rdstudio import config
from rdstudio.brief import brief
from rdstudio.okf import Bundle
from rdstudio.scaffold import init

from .conftest import write


def test_init_is_idempotent_and_merges(tmp_path):
    root = tmp_path / "proj"
    write(root, "CLAUDE.md", "# Existing\n\nKeep me.\n")
    write(root, ".mcp.json", json.dumps({"mcpServers": {"other": {"command": "x"}}}))
    write(root, ".gitignore", "node_modules/\n")
    out = list(init(root, title="Proj", human="alice"))
    assert "created rdstudio.toml" in out and out[-1].startswith("done")

    cfg = config.load(root)
    assert cfg.title == "Proj" and cfg.human == "human:alice"
    b = Bundle.load(cfg.knowledge_dir)
    assert {"overview", "tasks/bootstrap-knowledge-base"} <= set(b.concepts)
    assert not [i for i in b.lint() if i.level == "error"]
    assert "{title}" not in (cfg.knowledge_dir / "overview.md").read_text()

    for skill in ("search-okf", "record-okf", "report", "decision", "question", "task", "handoff", "lint-okf"):
        assert (root / ".claude/skills" / skill / "SKILL.md").is_file()
    assert (root / ".claude/skills/report/template.html").is_file()
    assert {p.stem for p in (root / ".claude/agents").glob("*.md")} == {"librarian", "critic", "searcher"}

    mcp = json.loads((root / ".mcp.json").read_text())
    assert set(mcp["mcpServers"]) == {"other", "rdstudio"}
    settings = json.loads((root / ".claude/settings.json").read_text())
    assert settings["enabledMcpjsonServers"] == ["rdstudio"]
    assert settings["hooks"]["SessionStart"][0]["hooks"][0]["command"].endswith("rdstudio brief")
    claude = (root / "CLAUDE.md").read_text()
    assert claude.startswith("# Existing") and "Keep me." in claude and "human:alice" in claude
    assert ".rdstudio/" in (root / ".gitignore").read_text()

    # Second run changes nothing; edited skills survive without --force.
    (root / ".claude/skills/task/SKILL.md").write_text("mine")
    assert list(init(root)) == [out[-1]]
    assert (root / ".claude/skills/task/SKILL.md").read_text() == "mine"
    assert claude == (root / "CLAUDE.md").read_text()
    assert any("task/SKILL.md" in m for m in init(root, force=True))


def test_brief(tmp_path):
    root = tmp_path / "proj"
    list(init(root, title="Proj", human="alice"))
    text = brief(config.load(root))
    assert text.startswith("Project knowledge base (Proj): 2 concepts")
    assert "Directories: tasks (1)" in text and len(text.splitlines()) <= 8
