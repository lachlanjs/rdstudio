import asyncio
import json

import pytest

from rdstudio import config, scopes
from rdstudio.mcp_server import create_server
from rdstudio.okf import Bundle
from rdstudio.scaffold import init

from .conftest import write


@pytest.fixture
def two_bases(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "home/.config"))
    out = list(scopes.init_global(tmp_path / "home/knowledge", human="alice"))
    assert any("set [global] path" in line for line in out)
    project = tmp_path / "proj"
    list(init(project, title="Proj", human="alice"))
    write(project, "knowledge/practice/uv.md", "---\ntype: Procedure\ntitle: Use uv\ndescription: Always uv, never pip.\n---\nuv sync.\n")
    write(project, "knowledge/design/model.md", "---\ntype: Design\n---\nSee [uv](/practice/uv.md).\n")
    write(tmp_path / "home/knowledge", "knowledge/reading/latex.md", "---\ntype: Research\ntitle: LaTeX tooling\n---\nlatexmk and vimtex.\n")
    return config.load(project)


def call(server, name, **args):
    result = asyncio.run(server.call_tool(name, args))
    return "".join(c.text for c in result.content if getattr(c, "text", None))


def test_scoped_search_and_read(two_bases):
    server = create_server(two_bases)
    assert "No matches" in call(server, "search", query="latex")
    hits = json.loads(call(server, "search", query="latex", scope="all"))
    assert hits[0]["id"] == "global:reading/latex"
    assert "latexmk" in call(server, "read", id="global:reading/latex")
    out = json.loads(call(server, "record", id="habits/editor", type="Practice", body="Neovim.", scope="global"))
    assert out["created"] and (scopes.global_config(two_bases).knowledge_dir / "habits/editor.md").exists()


def test_promote(two_bases):
    with pytest.raises(scopes.ScopeError, match="link to it"):
        scopes.promote(two_bases, "practice/uv")
    result = scopes.promote(two_bases, "practice/uv", keep=True)
    assert result == {"from": "practice/uv", "to": "practice/uv", "moved": False,
                      "broken_links_in_global": [], "project_backlinks": ["design/model"]}
    g = Bundle.load(scopes.global_config(two_bases).knowledge_dir)
    assert g.concepts["practice/uv"].meta["sources"][-1]["resource"] == "project Proj: practice/uv"
    with pytest.raises(scopes.ScopeError, match="already has"):
        scopes.promote(two_bases, "practice/uv", keep=True)


def test_skill_scopes(two_bases):
    dirs = scopes.skill_dirs(two_bases)
    assert "report" in dirs["project"] and dirs["user"] == {}
    scopes.move_skill(two_bases, "ingest-ref", "user")
    assert "ingest-ref" in scopes.skill_dirs(two_bases)["user"]
    with pytest.raises(scopes.ScopeError):
        scopes.move_skill(two_bases, "ingest-ref", "user")
