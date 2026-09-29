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
        ts = "me.tail1234.ts.net:8003"
        assert post({**good, "Host": ts, "Origin": f"https://{ts}"}) == 200  # behind tailscale serve
        assert post(good, b"not json") == 400
        assert post(good) == 200
        assert [e["event"] for e in learner.events(cfg)] == ["seen", "seen"]
    finally:
        server.shutdown()


def test_server_compresses_text_and_caches_vendor_files(cfg, tmp_path):
    import gzip as gz

    site = tmp_path / "site"
    (site / "vendor").mkdir(parents=True)
    (site / "index.html").write_text("<p>hello</p>" * 100)
    (site / "vendor" / "lib.js").write_text("var x = 1;" * 100)
    (site / "icon.png").write_bytes(b"\x89PNG" + b"0" * 100)
    handler = type("H", (_Handler,), {"cfg": cfg, "token": "tok", "loopback": True})
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"

    def get(path, **headers):
        req = urllib.request.Request(base + path, headers=headers)
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, dict(res.headers), res.read()
        except urllib.error.HTTPError as err:
            return err.code, dict(err.headers), b""

    try:
        status, headers, body = get("/", **{"Accept-Encoding": "gzip"})
        assert status == 200 and headers["Content-Encoding"] == "gzip" and headers["Cache-Control"] == "no-cache"
        assert gz.decompress(body).decode() == "<p>hello</p>" * 100
        assert get("/", **{"Accept-Encoding": "gzip", "If-Modified-Since": headers["Last-Modified"]})[0] == 304
        status, headers, body = get("/vendor/lib.js", **{"Accept-Encoding": "gzip"})
        assert headers["Cache-Control"].startswith("public, max-age=")
        status, headers, body = get("/vendor/lib.js")
        assert "Content-Encoding" not in headers and body.decode() == "var x = 1;" * 100
        status, headers, _ = get("/icon.png", **{"Accept-Encoding": "gzip"})
        assert status == 200 and "Content-Encoding" not in headers
    finally:
        server.shutdown()


def test_events_have_sortable_ids_and_merge_by_union(cfg):
    a = learner.append(cfg, {"event": "seen", "concept": "a"})
    b = learner.append(cfg, {"event": "seen", "concept": "b"})
    assert learner.ID_RE.match(a["id"]) and a["id"] < b["id"]  # made in order, sorted in order
    assert a["device"] == b["device"] == learner.device_id()
    offline = learner.new_id()
    c = learner.append(cfg, {"event": "seen", "id": offline, "device": "phone1"})
    assert (c["id"], c["device"]) == (offline, "phone1")  # ids made offline are kept
    learner.append(cfg, {"event": "seen", "id": offline, "device": "phone1"})  # a retried write
    assert [e["id"] for e in learner.events(cfg)] == [a["id"], b["id"], offline]
    for bad in ({"event": "x", "id": "nope"}, {"event": "x", "device": "Not Valid"}):
        with pytest.raises(learner.LearnerError):
            learner.append(cfg, bad)

    laptop, phone = learner.events(cfg)[:2], learner.events(cfg)[1:]
    merged = learner.merge(laptop, phone)
    assert merged == learner.merge(phone, laptop) == learner.merge(merged, phone, laptop)
    assert [e["id"] for e in merged] == sorted([a["id"], b["id"], offline])


def test_events_written_before_ids_get_the_same_id_everywhere(cfg):
    path = learner.record_dir(cfg) / "record.jsonl"
    path.parent.mkdir(parents=True)
    path.write_text('{"at":"2026-09-28T01:00:00Z","event":"seen","concept":"a"}\n'
                    '{"at":"2026-09-28T02:00:00Z","event":"seen","concept":"b"}\n')
    first = learner.events(cfg)
    assert [e["id"] for e in first] == [e["id"] for e in learner.events(cfg)]
    assert first[0]["id"] < first[1]["id"] and all(learner.ID_RE.match(e["id"]) for e in first)
