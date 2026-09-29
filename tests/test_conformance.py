import json
import sys
from pathlib import Path

import pytest

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
sys.path.insert(0, str(FIXTURES))
import expected  # noqa: E402


@pytest.mark.parametrize("name", expected.names())
def test_python_core_matches_the_fixtures(name):
    got = json.loads(expected.dump(expected.snapshot(expected.BUNDLES / name, expected.QUERIES.get(name, []))))
    want = json.loads((expected.EXPECTED / f"{name}.json").read_text(encoding="utf-8"))
    for key in want:  # one assertion per part, so a failure says which
        assert got[key] == want[key], f"{name}: {key} differs (python fixtures/expected.py --update, then review)"
    assert got.keys() == want.keys()


def test_learner_records_match_the_fixtures():
    got = json.loads(expected.dump(expected.learner_snapshot()))
    assert got == json.loads((expected.EXPECTED / "learner.json").read_text(encoding="utf-8"))
