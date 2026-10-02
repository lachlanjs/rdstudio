"""End to end: the learning features (milestone M8) in headless Chromium,
against a real rdstudio serve on a throwaway copy of the differential geometry
test bed, with the learner record switched on in a throwaway config and data
folder (never the user's own). Run with: mise run e2e

Tours (T25): a shared Tour note kept off the map, followed stop by stop; a
tour of your own written, followed and published.
"""
import json, os, shutil, socket, subprocess, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
DG = Path(os.environ.get("RDSTUDIO_BENCH_DG", Path.home() / "Repositories/differential-geometry"))
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-learn-"))
ROOT = TMP / "project"
shutil.copytree(DG, ROOT, ignore=shutil.ignore_patterns(".rdstudio"))
(TMP / "config/rdstudio").mkdir(parents=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:tester"\n')
ENV = {**os.environ, "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
(ROOT / "knowledge/tours").mkdir()
(ROOT / "knowledge/tours/first-steps.md").write_text("""---
type: Tour
title: First steps
description: From charts to maps between manifolds.
---

Start here if the subject is new.

1. [Smooth manifold](/manifolds/smooth-manifold.md): the space everything lives on.
2. [Charts and atlases](/manifolds/charts-and-atlases.md): how coordinates are glued together.
3. [Smooth maps and diffeomorphisms](/manifolds/smooth-maps.md): what it means for a map to be smooth.
""")

with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, env=ENV)
for _ in range(100):
    try:
        socket.create_connection(("127.0.0.1", PORT), timeout=0.2).close()
        break
    except OSError:
        time.sleep(0.1)
results = []

def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))

def record_dir():
    found = list((TMP / "data/rdstudio/learners").glob("*/record.jsonl"))
    return found[0].parent if found else None

def events(name=None):
    d = record_dir()
    if not d:
        return []
    out = [json.loads(l) for l in (d / "record.jsonl").read_text().splitlines() if l.strip()]
    return [e for e in out if name is None or e["event"] == name]

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    errors = []

    def page_for(**kw):
        ctx = browser.new_context(**kw)
        p = ctx.new_page()
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.on("console", lambda m: m.type == "error" and errors.append(m.text))
        p.on("dialog", lambda d: d.accept())
        return ctx, p

    ctx, p = page_for(viewport={"width": 1280, "height": 860})

    # ------------------------------------------------------------ tours (T25)
    p.goto(URL + "?nosw#/map")
    p.wait_for_selector(".m-place", timeout=20000)
    p.wait_for_timeout(800)
    labels = p.locator(".m-text").evaluate_all("els => els.map(e => e.textContent)")
    check("a Tour note is kept off the map", not any("First steps" in t for t in labels) and not any(t.strip() == "Tours" for t in labels), labels[:20])

    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Tours", exact=True).wait_for()
    check("the Learn tab lists the shared tour", p.locator(".rows.tours a.title", has_text="First steps").count() == 1)
    p.locator(".rows.tours li", has_text="First steps").get_by_role("link", name="Follow").click()
    card = p.locator(".tour-card")
    expect(card).to_be_visible(timeout=20000)
    check("following a tour shows its first stop and narration",
          "Stop 1 of 3" in card.inner_text() and card.locator(".tour-stop").inner_text() == "Smooth manifold"
          and "the space everything lives on" in card.inner_text(), card.inner_text())
    p.wait_for_timeout(1000)
    check("the stops are numbered on the map", p.locator(".m-step").count() >= 3, p.locator(".m-step").count())
    check("…and joined by a route from each to the next", p.locator(".m-routes path").count() >= 2, p.locator(".m-routes path").count())
    p.screenshot(path=str(OUT / "learn-tour-desktop.png"))
    card.get_by_role("button", name="Next").click()
    expect(card.locator(".tour-stop")).to_have_text("Charts and atlases")
    p.keyboard.press("Tab")  # into the card, then the arrow keys step
    card.focus()
    p.keyboard.press("ArrowRight")
    expect(card.locator(".tour-stop")).to_have_text("Smooth maps and diffeomorphisms")
    check("Next and the arrow keys step through the stops", card.get_by_role("button", name="Finish").is_visible())
    p.wait_for_timeout(500)
    steps = events("tour_step")
    check("reaching each stop is recorded as an interactive task",
          [e.get("stop") for e in steps] == [0, 1, 2] and all(e["kind"] == "interactive" and e["tour"] == "tours/first-steps" for e in steps)
          and steps[0].get("concept") == "manifolds/smooth-manifold", steps)
    card.get_by_role("button", name="Finish").click()
    p.wait_for_url("**#/learn")
    check("Finish returns to the Learn tab", True)

    p.goto(URL + "?nosw#/k/tours/first-steps")
    p.wait_for_selector("h1")
    check("a Tour note's page offers to follow it", p.get_by_role("link", name="Follow this tour").is_visible())

    # Writing your own.
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("link", name="Write a tour").click()
    p.get_by_label("Title").fill("Orientation first")
    p.get_by_label("Description").fill("A short way in, through orientation.")
    p.get_by_label("Stop 1: note").fill("Orientation")
    p.get_by_label("Stop 1: narration").fill("Start with the idea of a consistent choice.")
    p.get_by_role("button", name="Add a stop").click()
    p.get_by_label("Stop 2: note").fill("No such note")
    check("a stop that names no note is pointed out", p.get_by_text("names no note").is_visible() and p.get_by_role("button", name="Save").is_disabled())
    p.get_by_label("Stop 2: note").fill("Smooth manifold")
    p.get_by_role("button", name="Save").click()
    expect(p.get_by_role("status")).to_have_text("Saved privately.")
    saved = record_dir() / "tours/orientation-first.md"
    check("your tour is saved privately beside the record, as a Tour note",
          saved.exists() and saved.read_text().startswith("---\ntype: Tour\ntitle: Orientation first\n")
          and "1. [Orientation](/forms/orientation.md): Start with the idea of a consistent choice.\n2. [Smooth manifold](/manifolds/smooth-manifold.md)\n" in saved.read_text(),
          saved.read_text() if saved.exists() else "missing")
    check("…and is not in the project", not (ROOT / "knowledge/tours/orientation-first.md").exists())
    check("writing a tour is recorded as an autodidactic task", any(e.get("tour") == "~orientation-first" and e["kind"] == "autodidactic" for e in events("tour_written")))
    p.get_by_role("link", name="Follow").click()
    expect(p.locator(".tour-card .tour-stop")).to_have_text("Orientation", timeout=20000)
    check("your own tour can be followed", "Stop 1 of 2" in p.locator(".tour-card").inner_text())
    p.go_back()
    p.get_by_role("button", name="Publish to the project").click()
    p.wait_for_url("**#/k/tours/orientation-first", timeout=10000)
    published = ROOT / "knowledge/tours/orientation-first.md"
    check("publishing makes it a Tour note in the project and removes your copy",
          published.exists() and "type: Tour" in published.read_text() and not saved.exists())

    # ----------------------------------------------------------------- phone
    ctx.close()
    ctx, p = page_for(viewport={"width": 390, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p.goto(URL + "?nosw#/tour/tours/first-steps")
    card = p.locator(".tour-card")
    expect(card).to_be_visible(timeout=20000)
    box = card.bounding_box()
    check("on a phone the tour card fits the screen", box["x"] >= 0 and box["x"] + box["width"] <= 390 and box["y"] + box["height"] <= 800, box)
    check("…with no sideways scrolling", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    p.screenshot(path=str(OUT / "learn-tour-phone.png"))
    card.get_by_role("button", name="Next").tap()
    expect(card.locator(".tour-stop")).to_have_text("Charts and atlases")
    check("tapping Next steps on", True)

    browser.close()

server.terminate()
check("no errors in the browser console", not errors, errors[:5])
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
raise SystemExit(1 if failed else 0)
