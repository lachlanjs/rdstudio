import json
import subprocess

from rdstudio import config
from rdstudio.build import build
from rdstudio.gitlog import categorise, history
from rdstudio.reports import scan

from .conftest import write

CATS = {"knowledge": ["knowledge/**"], "code": ["**/*.py"], "agent": [".claude/**"]}


def test_categorise():
    assert categorise("knowledge/a/b.md", CATS) == "knowledge"
    assert categorise("src/pkg/mod.py", CATS) == "code"
    assert categorise("setup.py", CATS) == "code"
    assert categorise(".claude/skills/x/SKILL.md", CATS) == "agent"
    assert categorise("README.md", CATS) == "other"


def test_reports_scan(tmp_path):
    write(tmp_path, "reports/2026/a.html", """<html><head><title>Ignored</title>
<meta name="rdstudio:title" content="Run &amp; results"><meta name="rdstudio:date" content="2026-09-01">
<meta name="description" content="What happened."></head>
<body><a href="/knowledge/research/x.md">x</a> <a href="../../knowledge/y.md#s">y</a>
<a href="#/k/z">z</a> <a href="https://example.org">web</a></body></html>""")
    write(tmp_path, "reports/_draft.html", "<title>hidden</title>")
    [r] = scan(tmp_path / "reports", "knowledge", "reports")
    assert r["title"] == "Run & results" and r["date"] == "2026-09-01" and r["description"] == "What happened."
    assert r["links"] == ["research/x", "y", "z"]


def test_build_and_history(tmp_path, bundle_dir):
    root = bundle_dir.parent
    write(root, "rdstudio.toml", '[project]\ntitle = "T"\n')
    write(root, ".claude/skills/demo/SKILL.md", "---\nname: demo\ndescription: A demo skill.\n---\nDo it.\n")
    write(root, "knowledge/research/fig.png", "png")
    subprocess.run(["git", "init", "-q", "-b", "main", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"], check=True)
    cfg = config.load(root)
    site = build(cfg)
    data = site / "data"
    concepts = json.loads((data / "concepts.json").read_text())
    assert {c["id"] for c in concepts} >= {"design/model", "research/spectrum"}
    assert (data / "k/design/model.md").read_text().startswith("# Dynamics")
    assert (data / "k/research/fig.png").exists()
    assert (site / "index.html").exists() and (site / "vendor/d3.min.js").exists()
    skills = json.loads((data / "skills.json").read_text())
    assert skills["skills"][0]["name"] == "demo"
    assert (bundle_dir / "index.md").exists()  # indexes generated
    v1 = json.loads((data / "version.json").read_text())["version"]
    build(cfg)
    assert json.loads((data / "version.json").read_text())["version"] == v1  # stable when unchanged
    changes = history(root, cfg.category_globs(), exclude=(".rdstudio/",))
    assert changes["available"] and changes["commits"][-1]["subject"] == "init"
    pending = changes["commits"][0]
    assert pending.get("pending") and all(not f["path"].startswith(".rdstudio/") for f in pending["files"])


def test_export(tmp_path, bundle_dir, monkeypatch):
    import json as _json

    from rdstudio.cli import main

    root = bundle_dir.parent
    write(root, "rdstudio.toml", '[project]\ntitle = "T"\n')
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    write(tmp_path / "home", ".claude/skills/private/SKILL.md", "---\nname: private\n---\nx\n")
    out = tmp_path / "public"
    assert main(["-C", str(root), "export", str(out)]) == 0
    site = _json.loads((out / "data/site.json").read_text())
    skills = _json.loads((out / "data/skills.json").read_text())
    assert site["static"] is True and skills["skills"] == []
    assert (out / ".nojekyll").exists() and (out / "index.html").exists()
    assert main(["-C", str(root), "export", str(out)]) == 1  # refuses to overwrite
