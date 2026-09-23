"""Serve the dashboard with the standard library, rebuilding when sources change."""

from __future__ import annotations

import functools
import os
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from .build import WEB_DIR, build
from .config import Config

POLL_SECONDS = 1.0


class _Handler(SimpleHTTPRequestHandler):
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
    handler = functools.partial(_Handler, directory=str(site))
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

