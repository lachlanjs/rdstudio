import asyncio
import json

import pytest

from rdstudio import config
from rdstudio.mcp_server import create_server
from rdstudio.okf import Bundle
from rdstudio.procedures import Graph, ProcedureError, graph_of, propose, resolve

from .conftest import write

PROC = """---
type: Procedure
title: Add a reference
description: From DOI to a citable bibliography entry.
start: add
nodes:
  - {id: add, label: papis add by DOI}
  - {id: rename, label: Rename citekey}
  - {id: authors, label: Check author list}
  - {id: export, label: make refs}
edges:
  - {from: add, to: rename, relation: LEADS_TO, guidance: use author2020short, pitfalls: auto keys do not conform}
  - {from: rename, to: authors, relation: LEADS_TO, condition: always}
  - {from: authors, to: export, relation: LEADS_TO, pitfalls: run papis cache clear first}
---

Body.
"""


@pytest.fixture
def proc_root(bundle_dir):
    write(bundle_dir, "procedures/add-reference.md", PROC)
    return bundle_dir


def call(server, name, **args):
    result = asyncio.run(server.call_tool(name, args))
    return "".join(c.text for c in result.content if getattr(c, "text", None))


def test_graph_and_neighbourhood(proc_root):
    c = Bundle.load(proc_root).concepts["procedures/add-reference"]
    g = graph_of(c)
    assert not g.issues and g.start == "add" and g.match("Rename citekey") == "rename"
    sub = g.neighbourhood("add", hops=2)
    assert set(sub.nodes) == {"add", "rename", "authors"}
    assert [(e["from"], e["to"]) for e in sub.edges] == [("add", "rename"), ("rename", "authors")]


def test_validation():
    g = Graph.from_meta({"nodes": [{"id": "a"}], "edges": [{"from": "a", "to": "b", "relation": "JUMPS"}]})
    assert any("unknown node 'b'" in i for i in g.issues) and any("unknown relation" in i for i in g.issues)


def test_lint_reports_bad_graph(proc_root):
    write(proc_root, "procedures/bad.md", "---\ntype: Procedure\nnodes: [a]\nedges: [{from: a, to: z}]\n---\n")
    assert any(i.path == "procedures/bad.md" and i.level == "error" for i in Bundle.load(proc_root).lint())


def test_propose_apply_reject(proc_root):
    r = propose(proc_root, "procedures/add-reference", actor="agent/x", rationale="Missed a step",
                edits=[{"op": "add_node", "id": "clear", "label": "papis cache clear"},
                       {"op": "delete_edge", "from": "authors", "to": "export"},
                       {"op": "add_edge", "from": "authors", "to": "clear"},
                       {"op": "add_edge", "from": "clear", "to": "export"}])
    assert r["proposal"] == 1
    with pytest.raises(ProcedureError):
        propose(proc_root, "procedures/add-reference", actor="agent/x", rationale="bad",
                edits=[{"op": "add_edge", "from": "authors", "to": "nowhere"}])
    resolve(proc_root, "procedures/add-reference", 1, accept=True, actor="human:alice")
    c = Bundle.load(proc_root).concepts["procedures/add-reference"]
    g = graph_of(c)
    assert "clear" in g.nodes and ("authors", "export") not in {(e["from"], e["to"]) for e in g.edges}
    assert c.meta["proposals"][0]["state"] == "applied" and c.meta["generated"]["by"] == "human:alice"

    propose(proc_root, "procedures/add-reference", actor="agent/x", rationale="Skip checks",
            edits=[{"op": "delete_node", "id": "authors"}])
    resolve(proc_root, "procedures/add-reference", 2, accept=False, actor="human:alice")
    c = Bundle.load(proc_root).concepts["procedures/add-reference"]
    assert "authors" in graph_of(c).nodes and c.meta["proposals"][1]["state"] == "rejected"
    with pytest.raises(ProcedureError):
        resolve(proc_root, "procedures/add-reference", 2, accept=True, actor="human:alice")


def test_mcp_procedure_tools(proc_root):
    server = create_server(config.load(proc_root.parent))
    out = json.loads(call(server, "procedure_next", procedure="add-reference", step="rename", hops=1))
    assert out["current"] == "rename" and out["transitions"] == [
        {"from": "rename", "to": "authors", "relation": "LEADS_TO", "condition": "always"}]
    start = json.loads(call(server, "procedure_next", procedure="procedures/add-reference"))
    assert start["current"] == "add" and start["transitions"][0]["pitfalls"] == "auto keys do not conform"
    assert "whole graph" in call(server, "procedure_next", procedure="add-reference", step="dance")
    assert "Not proposed" in call(server, "procedure_propose", procedure="add-reference", edits=[{"op": "fly"}], rationale="x")
