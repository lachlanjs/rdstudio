"""Benchmark the dashboard: build time, time to first map, and smoothness while
panning and zooming, across bundle sizes, themes and device profiles.

Each bundle is built and served by ``rdstudio serve``, then opened in headless
Chromium at ``/?perf#/map``. With ``?perf`` the dashboard records its steps as
performance measures named ``rd:<step>`` (see ``js/util.js``); this script reads
them, then drives a fixed pan and zoom and records every frame.

    uv run --group bench python bench/run.py
    uv run --group bench python bench/run.py --bundles dg,field --profiles phone --themes space

Results go to ``.bench/results/`` as JSON; ``bench/compare.py`` sets two side by
side. Headless Chromium draws in software, so paint costs are higher than on a
real GPU: compare runs with each other, not with a phone in your hand.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
sys.path.insert(0, str(HERE))
import synth  # noqa: E402

WORK = REPO / ".bench"
DG = Path(os.environ.get("RDSTUDIO_BENCH_DG", "~/Repositories/differential-geometry")).expanduser()

PROFILES = {
    "desktop": {"viewport": (1280, 800), "scale": 1, "mobile": False, "cpu": 1},
    # A mid-range phone: a small screen at 3x and a CPU about four times slower.
    "phone": {"viewport": (390, 844), "scale": 3, "mobile": True, "cpu": 4},
    # The desktop over a slow link such as a VS Code tunnel.
    "tunnel": {"viewport": (1280, 800), "scale": 1, "mobile": False, "cpu": 1,
               "net": {"latency": 150, "down": 500_000, "up": 250_000}},
}
THEMES = {"studio": ("studio", "light"), "space": ("space", "dark"), "notebook": ("notebook", "light"),
          "map": ("map", "light"), "cyber": ("cyber", "dark")}

INIT = """
window.__long = [];
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); })
    .observe({ type: "longtask", buffered: true });
} catch {}
"""
FRAMES_START = """() => {
  window.__frames = []; window.__framesOn = true;
  const tick = (t) => { if (!window.__framesOn) return; window.__frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return performance.now();
}"""
MEASURES = """() => performance.getEntriesByType("measure").filter((m) => m.name.startsWith("rd:"))
  .map((m) => ({ name: m.name.slice(3), start: m.startTime, duration: m.duration }))"""
PAGE = """() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const res = performance.getEntriesByType("resource");
  return {
    dom_ready: nav?.domContentLoadedEventEnd ?? null,
    requests: res.length + 1,
    transfer_kb: ((nav?.transferSize ?? 0) + res.reduce((s, r) => s + (r.transferSize || 0), 0)) / 1024,
    svg_nodes: document.querySelectorAll(".map-wrap svg *").length,
    heap_mb: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
  };
}"""


def pct(values: list[float], p: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    return s[min(len(s) - 1, round(p / 100 * (len(s) - 1)))]


def r1(x: float | None) -> float | None:
    return None if x is None else round(x, 1)


# ------------------------------------------------------------------ bundles

def prepare(name: str, fresh: bool) -> Path | None:
    target = WORK / "bundles" / name
    if name == "dg":
        if not DG.is_dir():
            print(f"skipping dg: {DG} not found (set RDSTUDIO_BENCH_DG)", file=sys.stderr)
            return None
        # A copy, so building never touches the real project.
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(DG, target, ignore=shutil.ignore_patterns(".rdstudio", ".venv"))
        return target
    if fresh and target.exists():
        shutil.rmtree(target)
    if not target.exists():
        depth, branch = synth.PRESETS[name]
        synth.generate(target, depth, branch, name=f"Synthetic {name}")
    return target


def build_times(root: Path) -> dict:
    from rdstudio import config as config_mod
    from rdstudio.build import build
    from rdstudio.okf import Bundle

    cfg = config_mod.load(root)
    t = time.perf_counter()
    bundle = Bundle.load(cfg.knowledge_dir)
    load_s = time.perf_counter() - t
    t = time.perf_counter()
    build(cfg)
    build_s = time.perf_counter() - t
    links = sum(len(c.links) for c in bundle.concepts.values())
    return {"notes": len(bundle.concepts), "links": links, "load_ms": r1(load_s * 1000), "build_ms": r1(build_s * 1000)}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(root: Path) -> tuple[subprocess.Popen, str]:
    port = free_port()
    proc = subprocess.Popen([sys.executable, "-m", "rdstudio.cli", "serve", "--no-watch", "--port", str(port)],
                            cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    deadline = time.time() + 120
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"rdstudio serve exited: {proc.stderr.read().decode()[-500:]}")
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            return proc, f"http://127.0.0.1:{port}"
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("rdstudio serve did not start")


# ------------------------------------------------------------------ browser

def wait_for_map(page, timeout_s: float) -> None:
    """Until the map has settled: drawn with its full layout, not the quick start."""
    page.wait_for_function("() => performance.getEntriesByName('rd:map-settled').length > 0",
                           timeout=timeout_s * 1000, polling=50)


def first(measures: list[dict], name: str) -> dict | None:
    return next((m for m in measures if m["name"] == name), None)


def load_metrics(page) -> dict:
    ms = page.evaluate(MEASURES)
    render = first(ms, "map-render")
    settled = first(ms, "map-settled")
    out = {"first_map_ms": r1(render["start"] + render["duration"]) if render else None,
           # the measure runs from when the page opened
           "settled_ms": r1(settled["duration"]) if settled else None}
    for step in ("data", "map-model", "map-place", "map-layout", "map-routes", "map-render"):
        m = first(ms, step)
        out[step.replace("map-", "") + "_ms"] = r1(m["duration"]) if m else None
    info = page.evaluate(PAGE)
    out.update({k: r1(v) if isinstance(v, float) else v for k, v in info.items()})
    return out


def interact(page, cdp, size: tuple[int, int], touch: bool) -> dict:
    """A fixed gesture: zoom in, pan, zoom out, with every frame recorded. On a
    phone profile, as touch (pinch and swipe); otherwise with the mouse wheel."""
    w, h = size
    cx, cy = w / 2, h / 2
    start = page.evaluate(FRAMES_START)
    if touch:
        gesture = {"x": cx, "y": cy, "gestureSourceType": "touch"}
        cdp.send("Input.synthesizePinchGesture", {**gesture, "scaleFactor": 6, "relativeSpeed": 600})
        cdp.send("Input.synthesizeScrollGesture", {**gesture, "xDistance": -300, "yDistance": -120, "speed": 600})
        cdp.send("Input.synthesizePinchGesture", {**gesture, "scaleFactor": 1 / 6, "relativeSpeed": 600})
    else:
        _wheel_gesture(page, cx, cy)
    return _frames_since(page, start)


def _wheel_gesture(page, cx: float, cy: float) -> None:
    page.mouse.move(cx, cy)
    for _ in range(12):
        page.mouse.wheel(0, -150)
        page.wait_for_timeout(40)
    page.mouse.down()
    for i in range(30):
        page.mouse.move(cx - i * 10, cy - i * 4)
        page.wait_for_timeout(16)
    page.mouse.up()
    for _ in range(12):
        page.mouse.wheel(0, 150)
        page.wait_for_timeout(40)


def _frames_since(page, start: float) -> dict:
    page.wait_for_timeout(600)
    frames = page.evaluate("() => { window.__framesOn = false; return window.__frames; }")
    gaps = [b - a for a, b in zip(frames, frames[1:])]
    ms = [m for m in page.evaluate(MEASURES) if m["start"] >= start]
    renders = [m["duration"] for m in ms if m["name"] == "map-render"]
    routes = [m["duration"] for m in ms if m["name"] == "map-routes"]
    longs = [d for s, d in page.evaluate("() => window.__long") if s >= start]
    span = (frames[-1] - frames[0]) if len(frames) > 1 else 0
    return {
        "fps": r1(len(gaps) / span * 1000) if span else None,
        "frame_p50_ms": r1(pct(gaps, 50)), "frame_p95_ms": r1(pct(gaps, 95)), "frame_max_ms": r1(max(gaps, default=None)),
        "janky_pct": r1(100 * sum(g > 50 for g in gaps) / len(gaps)) if gaps else None,
        "renders": len(renders), "render_p50_ms": r1(pct(renders, 50)), "render_p95_ms": r1(pct(renders, 95)),
        "reroutes": len(routes), "routes_total_ms": r1(sum(routes)),
        "long_tasks": len(longs), "long_task_ms": r1(sum(longs)),
    }


def run_case(browser, url: str, theme: str, profile: str, timeout_s: float, sw: bool = True) -> dict:
    p = PROFILES[profile]
    look, mode = THEMES[theme]
    ctx = browser.new_context(viewport=dict(zip(("width", "height"), p["viewport"])),
                              device_scale_factor=p["scale"], is_mobile=p["mobile"], has_touch=p["mobile"])
    ctx.add_init_script(INIT + f"try {{ localStorage.setItem('rdstudio.look', '{look}'); "
                               f"localStorage.setItem('rdstudio.mode', '{mode}'); localStorage.removeItem('rdstudio.map'); }} catch {{}}")
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    if p["cpu"] > 1:
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": p["cpu"]})
    if net := p.get("net"):
        cdp.send("Network.enable")
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": net["latency"],
                                                      "downloadThroughput": net["down"], "uploadThroughput": net["up"]})
    try:
        page.goto(url + ("/?perf#/map" if sw else "/?perf&nosw#/map"))
        wait_for_map(page, timeout_s)
        page.wait_for_timeout(300)
        cold = load_metrics(page)
        motion = interact(page, cdp, p["viewport"], p["mobile"])
        page.reload()
        wait_for_map(page, timeout_s)
        page.wait_for_timeout(300)
        warm = load_metrics(page)
        return {"load": cold, "interact": motion,
                "reload": {k: warm[k] for k in ("first_map_ms", "settled_ms", "data_ms", "layout_ms", "routes_ms", "render_ms", "transfer_kb")}}
    except Exception as exc:  # a timeout on the largest bundle is a result too
        return {"error": f"{type(exc).__name__}: {str(exc).splitlines()[0]}"}
    finally:
        ctx.close()


# ------------------------------------------------------------------ report

def meta(label: str | None) -> dict:
    def git(*args: str) -> str:
        return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True).stdout.strip()
    cpu = next((line.split(":", 1)[1].strip() for line in Path("/proc/cpuinfo").read_text().splitlines()
                if line.startswith("model name")), platform.processor()) if Path("/proc/cpuinfo").exists() else platform.processor()
    return {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "label": label,
            "commit": git("rev-parse", "--short", "HEAD"), "dirty": bool(git("status", "--porcelain", "--", "src")),
            "machine": {"cpu": cpu, "cores": os.cpu_count(), "os": platform.platform()}}


def table(runs: list[dict]) -> str:
    cols = [("bundle", lambda r: r["bundle"]), ("notes", lambda r: r["build"]["notes"]),
            ("theme", lambda r: r["theme"]), ("profile", lambda r: r["profile"]),
            ("build ms", lambda r: r["build"]["build_ms"]),
            ("first map ms", lambda r: r.get("load", {}).get("first_map_ms")),
            ("settled ms", lambda r: r.get("load", {}).get("settled_ms")),
            ("layout", lambda r: r.get("load", {}).get("layout_ms")),
            ("routes", lambda r: r.get("load", {}).get("routes_ms")),
            ("render", lambda r: r.get("load", {}).get("render_ms")),
            ("fps", lambda r: r.get("interact", {}).get("fps")),
            ("frame p95", lambda r: r.get("interact", {}).get("frame_p95_ms")),
            ("jank %", lambda r: r.get("interact", {}).get("janky_pct")),
            ("reload ms", lambda r: r.get("reload", {}).get("settled_ms") or r.get("reload", {}).get("first_map_ms")),
            ("error", lambda r: r.get("error", ""))]
    rows = [[str(f(r) if f(r) is not None else "–") for _, f in cols] for r in runs]
    if not any(r[-1] for r in rows):
        cols, rows = cols[:-1], [r[:-1] for r in rows]
    widths = [max(len(c[0]), *(len(r[i]) for r in rows)) for i, c in enumerate(cols)]
    line = lambda cells: "  ".join(c.rjust(w) if i > 3 else c.ljust(w) for i, (c, w) in enumerate(zip(cells, widths)))
    return "\n".join([line([c[0] for c in cols]), line(["-" * w for w in widths]), *map(line, rows)])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--bundles", default="dg,subject,area,field,ceiling", help="dg and/or presets: " + ", ".join(synth.PRESETS))
    ap.add_argument("--themes", default="studio,space", help=", ".join(THEMES))
    ap.add_argument("--profiles", default="desktop,phone", help=", ".join(PROFILES))
    ap.add_argument("--label", help="a name for this run, kept in the results")
    ap.add_argument("--fresh", action="store_true", help="regenerate the synthetic bundles")
    ap.add_argument("--no-sw", action="store_true", help="without the service worker (offline cache)")
    ap.add_argument("--timeout", type=float, default=180, help="seconds to wait for a map")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args(argv)

    from playwright.sync_api import sync_playwright

    runs = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name in args.bundles.split(","):
            root = prepare(name, args.fresh)
            if root is None:
                continue
            built = build_times(root)
            server, url = start_server(root)
            try:
                for theme in args.themes.split(","):
                    for profile in args.profiles.split(","):
                        print(f"{name} ({built['notes']} notes) · {theme} · {profile} …", file=sys.stderr, flush=True)
                        runs.append({"bundle": name, "theme": theme, "profile": profile, "build": built,
                                     **run_case(browser, url, theme, profile, args.timeout, not args.no_sw)})
            finally:
                server.terminate()
                server.wait()
        result = {"meta": {**meta(args.label), "chromium": browser.version, "service_worker": not args.no_sw}, "runs": runs}
        browser.close()

    out = args.out or WORK / "results" / f"{datetime.now():%Y%m%d-%H%M%S}-{result['meta']['commit']}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    print(table(runs))
    print(f"\n{out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
