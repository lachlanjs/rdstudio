import json
import threading
import urllib.error
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer

import pytest

from rdstudio import config as config_mod
from rdstudio import learner
from rdstudio.serve import _Handler


@pytest.fixture
def cfg(tmp_path, monkeypatch):
    home = tmp_path / "home"
    (home / "config" / "rdstudio").mkdir(parents=True)
    (home / "config" / "rdstudio" / "config.toml").write_text("[learner]\nenabled = true\n")
    monkeypatch.setenv("XDG_CONFIG_HOME", str(home / "config"))
    monkeypatch.setenv("XDG_DATA_HOME", str(home / "data"))
    project = tmp_path / "project"
    project.mkdir()
    (project / "rdstudio.toml").write_text("[project]\ntitle = 'T'\n")
    return config_mod.load(project)


def test_record_is_private_and_append_only(cfg, tmp_path):
    assert learner.enabled(cfg)
    folder = learner.record_dir(cfg)
    assert folder.is_relative_to(tmp_path / "home" / "data") and not folder.is_relative_to(cfg.root)
    assert folder.name.startswith("path-")  # not a git repository
    learner.append(cfg, {"event": "seen", "concept": "a", "hash": "x", "at": "forged"})
    learner.append(cfg, {"event": "attempt", "concept": "b", "kind": "interactive", "grade": 2})
    events = learner.events(cfg)
    assert [e["event"] for e in events] == ["seen", "attempt"] and events[0]["at"] != "forged"
    assert learner.events(cfg, concept="b")[0]["grade"] == 2
    with pytest.raises(learner.LearnerError):
        learner.append(cfg, {"event": "x", "kind": "vibes"})
    with pytest.raises(learner.LearnerError):
        learner.append(cfg, {"concept": "a"})


def test_record_off_by_default(cfg, monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "nowhere"))
    assert not learner.enabled(cfg)


def test_server_accepts_writes_only_from_its_own_pages(cfg, tmp_path):
    handler = type("H", (_Handler,), {"cfg": cfg, "token": "tok", "loopback": True})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(tmp_path)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    host = f"127.0.0.1:{server.server_port}"
    base = f"http://{host}/api/learner"

    def post(headers, body=b'{"event": "seen", "concept": "a"}'):
        req = urllib.request.Request(base, data=body, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req) as res:
                return res.status
        except urllib.error.HTTPError as err:
            return err.code

    try:
        with urllib.request.urlopen(base) as res:
            state = json.load(res)
        assert state["enabled"] and state["token"] == "tok"
        good = {"Origin": f"http://{host}", "Content-Type": "application/json", "X-Rdstudio-Token": "tok"}
        assert post({**good, "Origin": "http://evil.example"}) == 403
        assert post({k: v for k, v in good.items() if k != "Origin"}) == 403
        assert post({**good, "X-Rdstudio-Token": "wrong"}) == 403
        assert post({**good, "Content-Type": "text/plain"}) == 415
        assert post({**good, "Host": "evil.example", "Origin": "http://evil.example"}) == 403  # DNS rebinding
        assert post(good, b"not json") == 400
        assert post(good) == 200
        assert [e["event"] for e in learner.events(cfg)] == ["seen"]
    finally:
        server.shutdown()
