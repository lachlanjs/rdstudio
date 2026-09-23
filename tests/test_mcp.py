import asyncio
import json

from rdstudio import config
from rdstudio.mcp_server import create_server

from .conftest import write


def call(server, name, **args):
    result = asyncio.run(server.call_tool(name, args))
    return "".join(c.text for c in result.content if getattr(c, "text", None))


def test_tools(bundle_dir):
    root = bundle_dir.parent
    write(root, "rdstudio.toml", '[actors]\nagent = "test-agent/1"\n')
    server = create_server(config.load(root))
    names = {t.name for t in asyncio.run(server.list_tools())}
    assert names == {"search", "outline", "read", "list_concepts", "record", "backlinks", "review_queue",
                     "procedure_next", "procedure_propose", "promote"}

    hits = json.loads(call(server, "search", query="random matrices"))
    assert hits[0]["id"] in {"research/spectrum", "design/model"} and "snippet" in hits[0]
    outline = json.loads(call(server, "outline", id="/design/model.md"))
    assert outline["headings"] == ["# Dynamics", "## Stability", "# Evolution"] and outline["linked_from"] == ["design/overview"]
    assert call(server, "read", id="design/model", section_heading="stability").startswith("## Stability")
    assert "Headings:" in call(server, "read", id="design/model", section_heading="nope")
    listing = json.loads(call(server, "list_concepts", directory="design"))
    assert {c["id"] for c in listing["concepts"]} == {"design/model", "design/overview"}

    out = json.loads(call(server, "record", id="decisions/tanh", type="Decision", title="Use tanh",
                          description="Activation choice.", body="# Decision\n\nTanh. See [model](/design/model.md)."))
    assert out["created"] and out["path"] == "decisions/tanh.md"
    text = (bundle_dir / "decisions/tanh.md").read_text()
    assert "by: test-agent/1" in text and (bundle_dir / "decisions/index.md").exists()
    assert "Not recorded" in call(server, "record", id="x/untyped", body="no type")

    queue = json.loads(call(server, "review_queue"))
    assert [c["id"] for c in queue["changed_since_review"]] == ["design/model"]
    assert json.loads(call(server, "backlinks", id="design/model"))[0]["id"] in {"decisions/tanh", "design/overview"}
