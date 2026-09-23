import asyncio
import json
import sys

from rdstudio import config
from rdstudio.classify import CommandClassifier, edit_significance, from_config, match_step, RulesClassifier
from rdstudio.mcp_server import create_server
from rdstudio.okf import split_frontmatter
from rdstudio.store import record

from .conftest import write

TEXT = "The spectral radius stays below one when the gain is small, so activity decays to a fixed point."


def test_edit_significance_rules():
    assert edit_significance(TEXT, TEXT.replace("spectral", "Spectral")).choice == "minor"
    assert edit_significance(TEXT, TEXT.replace("decays", "decay")).choice == "minor"
    assert edit_significance(TEXT, TEXT + " With plasticity, the radius grows until activity becomes chaotic.").choice == "significant"


def test_match_step():
    steps = {"add": "papis add by DOI", "rename": "Rename citekey", "refs": "make refs"}
    assert match_step("renamed the citekey", steps).choice == "rename"
    assert match_step("walked the dog", steps).choice is None


def test_record_auto_significance(bundle_dir):
    before = split_frontmatter((bundle_dir / "design/model.md").read_text())[0]["generated"]
    r = record(bundle_dir, "design/model", actor="agent/y", section="Stability", body="Spectral radius below one!", significant=None)
    assert not r.significant and r.decided_by == "rules"
    assert split_frontmatter((bundle_dir / "design/model.md").read_text())[0]["generated"] == before
    r = record(bundle_dir, "design/model", actor="agent/y", section="Stability", body="Radius above one gives chaos; we use tanh units with Dale's law.", significant=None)
    assert r.significant


def test_command_backend(tmp_path):
    script = tmp_path / "clf.py"
    script.write_text("import json,sys\nq=json.load(sys.stdin)\nprint(json.dumps({'choice': q['options'][-1], 'confidence': 0.9}))\n")
    c = CommandClassifier([sys.executable, str(script)])
    assert c.choose("procedure_step", ["a", "b"], {}).choice == "b"
    low = CommandClassifier([sys.executable, str(script)], min_confidence=0.95)
    assert low.choose("edit_significance", ["minor", "significant"], {"before": TEXT, "after": TEXT}).backend == "rules"
    broken = CommandClassifier(["/nonexistent/classifier"])
    assert broken.choose("edit_significance", ["minor", "significant"], {"before": TEXT, "after": TEXT}).choice == "minor"
    assert isinstance(from_config({}), RulesClassifier)
    assert isinstance(from_config({"classifier": {"backend": "command", "command": "x y"}}), CommandClassifier)


def test_mcp_fuzzy_step(bundle_dir):
    write(bundle_dir, "procedures/p.md", "---\ntype: Procedure\nnodes: [{id: a, label: Draft the plan}, {id: b, label: Get approval}]\nedges: [{from: a, to: b}]\n---\n")
    server = create_server(config.load(bundle_dir.parent))
    res = asyncio.run(server.call_tool("procedure_next", {"procedure": "p", "step": "drafted a plan"}))
    out = json.loads(res.content[0].text)
    assert out["current"] == "a" and out["matched_by"].startswith("rules")
