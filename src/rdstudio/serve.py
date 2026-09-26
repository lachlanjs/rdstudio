"""Serve the dashboard with the standard library, rebuilding when sources change."""

from __future__ import annotations

import functools
import json
import os
import secrets
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from . import learner
from .build import WEB_DIR, build
from .config import Config

POLL_SECONDS = 1.0


LOOPBACK = {"localhost", "127.0.0.1", "::1"}


class _Handler(SimpleHTTPRequestHandler):
    """Static files, plus ``/api/learner`` for the private learner record.

    Writes are accepted only from the dashboard's own pages: the Origin must
    match the Host, the body must be JSON, and the request must carry the token
    handed out by GET (which other sites cannot read). When bound to localhost,
    only localhost host names are served the API, against DNS rebinding."""

    cfg: Config
    token: str
    loopback: bool

    def _host_ok(self) -> bool:
        host = urlsplit("//" + (self.headers.get("Host") or "")).hostname or ""
        return not self.loopback or host in LOOPBACK

    def _json(self, status: int, value: object) -> None:
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlsplit(self.path).path != "/api/learner":
            return super().do_GET()
        if not self._host_ok():
            return self._json(403, {"error": "host not allowed"})
        on = learner.enabled(self.cfg)
        self._json(200, {
            "enabled": on,
            "token": self.token if on else None,
            "dir": str(learner.record_dir(self.cfg)) if on else None,
            "events": learner.events(self.cfg) if on else [],
        })

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/learner":
            return self._json(404, {"error": "not found"})
        origin = urlsplit(self.headers.get("Origin") or "").netloc
        if not self._host_ok() or origin != self.headers.get("Host"):
            return self._json(403, {"error": "cross-origin request refused"})
        if self.headers.get("X-Rdstudio-Token") != self.token:
            return self._json(403, {"error": "bad token"})
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self._json(415, {"error": "JSON only"})
        if not learner.enabled(self.cfg):
            return self._json(409, {"error": "the learner record is off ([learner] enabled in the user config)"})
        length = int(self.headers.get("Content-Length") or 0)
        if length > learner.MAX_EVENT_BYTES:
            return self._json(413, {"error": "event too large"})
        try:
            event = learner.append(self.cfg, json.loads(self.rfile.read(length) or b"null"))
        except (ValueError, learner.LearnerError) as exc:
            return self._json(400, {"error": str(exc)})
        self._json(200, event)

    def end_headers(self) -> None:
        if self.path.startswith("/data/") or self.path.endswith((".html", ".js", ".css")) or self.path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib signature
        pass


def _fingerprint(cfg: Config) -> tuple:
    """A cheap summary of everything the build reads."""
    roots = [cfg.knowledge_dir, cfg.reports_dir, cfg.root / ".claude", WEB_DIR]
    files = [cfg.root / "rdstudio.toml", cfg.root / ".git" / "HEAD", cfg.root / ".git" / "index"]
    stamp: list[tuple[str, int, int]] = []
    for root in roots:
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if not d.startswith(".")]
            for name in filenames:
                p = os.path.join(dirpath, name)
                try:
                    st = os.stat(p)
                except OSError:
                    continue
                stamp.append((p, st.st_mtime_ns, st.st_size))
    for f in files:
        if f.exists():
            st = f.stat()
            stamp.append((str(f), st.st_mtime_ns, st.st_size))
    return tuple(sorted(stamp))


def _watch(cfg: Config, stop: threading.Event) -> None:
    last = _fingerprint(cfg)
    while not stop.wait(POLL_SECONDS):
        current = _fingerprint(cfg)
        if current == last:
            continue
        try:
            build(cfg)
            print(f"[{time.strftime('%H:%M:%S')}] rebuilt", flush=True)
        except Exception as exc:  # keep serving the last good build
            print(f"[{time.strftime('%H:%M:%S')}] build failed: {exc}", file=sys.stderr, flush=True)
        last = _fingerprint(cfg)  # the build may regenerate index.md files


def serve(cfg: Config, *, host: str = "127.0.0.1", port: int = 8000, watch: bool = True) -> None:
    site = build(cfg)
    handler_cls = type("Handler", (_Handler,), {
        "cfg": cfg, "token": secrets.token_urlsafe(24), "loopback": host in LOOPBACK})
    handler = functools.partial(handler_cls, directory=str(site))
    server = ThreadingHTTPServer((host, port), handler)
    stop = threading.Event()
    if watch:
        threading.Thread(target=_watch, args=(cfg, stop), daemon=True).start()
    shown = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
    print(f"Serving {cfg.title} at http://{shown}:{port}/  (Ctrl+C to stop)", flush=True)
    if host == "0.0.0.0":
        print("Listening on all interfaces (reachable over your tailnet/LAN).", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()

