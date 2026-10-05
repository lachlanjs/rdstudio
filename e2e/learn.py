"""End to end: the learning features (milestone M8) in headless Chromium,
against a real rdstudio serve on a throwaway copy of the differential geometry
test bed, with the learner record switched on in a throwaway config and data
folder (never the user's own). Run with: mise run e2e

Tours (T25): a shared Tour note kept off the map, followed stop by stop; a
tour of your own written, followed and published.
Exercises (T26): recall with a self-grade, fill the gap, placement and the
landmarks, each answer an event in the record.
Coverage and review (T27): discovery states on the note, in the tree and on
the map, marking, hiding what is not reached, coverage per folder, the review
queue and the load note.
Explain-back (T28): an answer written under a note, waiting; an agent's
marking and question (appended as the MCP tools write them) shown on the note
and the Learn tab.
Catching up (T29): a note changed since you last looked, with the commits and
the diff from git; a note you understood whose prerequisite changed since.
"""
import json, os, shutil, socket, subprocess, tempfile, time
from datetime import datetime, timedelta, timezone
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

def settle(name, count, timeout=3.0):
    """Wait until the record holds `count` events named `name` (the page writes them in the background)."""
    end = time.time() + timeout
    while time.time() < end and len(events(name)) < count:
        time.sleep(0.05)

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
        p.on("console", lambda m: m.type == "error" and errors.append(f"{m.text} at {p.url}"))
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
    settle("tour_step", 3)
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

    # -------------------------------------------------------- exercises (T26)
    p.goto(URL + "?nosw#/practice")
    p.locator(".practice-list li").first.wait_for()
    check("Practice lists the four exercises", p.locator(".practice-list li").count() == 4)
    p.get_by_label("Notes from").select_option("manifolds")
    p.get_by_role("link", name="Recall").click()
    p.wait_for_url("**#/practice/recall/manifolds")
    card = p.locator(".practice-card")
    first = card.locator("h2").inner_text()
    p.get_by_role("button", name="Show the note").click()
    check("recall shows the note's description to check against", card.locator(".practice-answer").is_visible())
    p.get_by_role("button", name="Got it").click()
    expect(p.locator(".practice-progress")).to_have_text("2 of up to 10")
    settle("exercise", 1)
    rec = [e for e in events("exercise") if e["exercise"] == "recall"]
    check("a recall is recorded with its self-grade, as interactive",
          len(rec) == 1 and rec[0]["result"] == "got" and rec[0]["kind"] == "interactive" and rec[0]["concept"].startswith("manifolds/")
          and card.locator("h2").inner_text() != first, rec)

    p.goto(URL + "?nosw#/practice/gap/manifolds")
    expect(p.locator(".practice h1")).to_have_text("Fill the gap")
    card = p.locator(".practice-card")
    check("fill the gap gives the folder and the links as clues", "is hidden" in card.inner_text() and ("links to" in card.inner_text() or "linked from" in card.inner_text()))
    options = card.locator(".practice-options button")
    check("…and four notes to choose among", options.count() == 4, options.count())
    options.first.click()
    verdict = card.locator(".practice-verdict").inner_text()
    settle("exercise", 2)
    gap = [e for e in events("exercise") if e["exercise"] == "gap"]
    check("the answer is checked, shown, and recorded", card.locator(".practice-options .right").count() == 1
          and len(gap) == 1 and gap[0]["result"] == ("got" if verdict.startswith("Right") else "missed"), (verdict, gap))
    p.get_by_role("button", name="Next").click()
    expect(p.locator(".practice-progress")).to_have_text("2 of up to 10")

    p.goto(URL + "?nosw#/practice/placement")
    expect(p.locator(".practice h1")).to_have_text("Placement")  # not the last page's card
    card = p.locator(".practice-card")
    card.locator(".practice-options button").first.click()
    expect(card.locator(".practice-verdict")).to_be_visible()
    settle("exercise", 3)
    check("placement asks for the folder and checks it", len([e for e in events("exercise") if e["exercise"] == "placement"]) == 1)

    p.goto(URL + "?nosw#/practice/landmarks/manifolds")
    marked = sorted(str(f.relative_to(ROOT / "knowledge"))[:-3] for f in (ROOT / "knowledge/manifolds").rglob("*.md") if "\nlandmark: true\n" in f.read_text())
    check("landmarks: the notes marked as landmarks", "marked as landmarks" in p.locator(".lede").inner_text() and f"are {len(marked)}" in p.locator(".lede").inner_text(), p.locator(".lede").inner_text())
    box = p.get_by_label("A landmark's name")
    box.fill("smooth manifold"); box.press("Enter")
    box.fill("Vector bundles"); box.press("Enter")  # a slip is allowed
    box.fill("Topology"); box.press("Enter")
    check("names are matched, allowing a slip", p.get_by_text(f"2 of {len(marked)} named").is_visible() and "not one of them" in p.locator(".edit-status").inner_text())
    p.get_by_role("button", name="Show the rest").click()
    settle("exercise", 3 + len(marked))
    lm = {e["concept"]: e["result"] for e in events("exercise") if e["exercise"] == "landmarks"}
    check("each landmark is recorded, named or not", sorted(lm) == marked and lm["manifolds/smooth-manifold"] == "got"
          and lm["manifolds/bundles/vector-bundle"] == "got" and list(lm.values()).count("missed") == len(marked) - 2, lm)
    p.screenshot(path=str(OUT / "learn-practice.png"))

    # ------------------------------------------------ coverage and review (T27)
    p.goto(URL + "?nosw#/k/forms/stokes-theorem")
    head = p.locator(".doc-head")
    expect(head).to_have_class("doc-head st-discovered")
    meta = p.locator("aside.meta")
    check("the companion says where it stands for you: opened, one step of three",
          "1 of 3" in meta.locator(".you-blk .kind-row").inner_text() and meta.locator(".step[aria-pressed=true]").inner_text().strip() == "Opened")
    meta.get_by_role("button", name="Worked through").click()
    expect(head).to_have_class("doc-head st-processed")
    meta.get_by_role("button", name="Understood").click()
    expect(head).to_have_class("doc-head st-understood")
    settle("mark", 2)
    marks = events("mark")
    check("marking is recorded as autodidactic, and the steps follow", [m["state"] for m in marks] == ["processed", "understood"]
          and all(m["kind"] == "autodidactic" and m["concept"] == "forms/stokes-theorem" for m in marks)
          and "3 of 3" in meta.locator(".you-blk .kind-row").inner_text())
    tree_link = p.locator(".tree .item a", has_text="Stokes' theorem")
    check("the tree sets an understood note's title in bold", "st-understood" in tree_link.get_attribute("class"))
    check("…and the details say it is in review", "In review: due tomorrow" in meta.inner_text(), meta.inner_text())
    meta.get_by_role("button", name="Opened").click()
    expect(head).to_have_class("doc-head st-discovered")
    check("choosing Opened takes it back down", True)

    # A past the reader has had: earlier days of study, a note marked two days
    # ago (so due for review), and one understood on an older version.
    now = datetime.now(timezone.utc)
    ago = lambda d: (now - timedelta(days=d)).isoformat().replace("+00:00", "Z")
    past = [{"event": "seen", "concept": f"manifolds/n{d}-{i}", "at": ago(d)} for d in range(1, 7) for i in range(3)]
    past += [{"event": "seen", "concept": c.relative_to(ROOT / "knowledge").with_suffix("").as_posix(), "at": ago(0)}
             for c in sorted((ROOT / "knowledge/riemannian").rglob("*.md"))[:12] if c.name != "index.md"]
    past += [{"event": "mark", "concept": "forms/differential-forms", "state": "processed", "kind": "autodidactic", "at": ago(2)},
             {"event": "mark", "concept": "forms/exterior-derivative", "state": "understood", "kind": "autodidactic", "hash": "an-older-version", "at": ago(1)}]
    with (record_dir() / "record.jsonl").open("a") as f:
        for i, e in enumerate(past):
            f.write(json.dumps({"id": f"01J{i:023d}", "device": "test", **e}) + "\n")

    p.goto(URL + "?nosw#/k/forms/exterior-derivative")
    p.wait_for_selector(".doc-head h1")
    p.reload()  # the record is read when the page loads
    head = p.locator(".doc-head")
    expect(head).to_have_class("doc-head st-understood changed")
    check("understood on an older version says it has changed since", "has changed meaningfully since you understood it" in p.locator("aside.meta .you-blk").inner_text())

    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Where you stand").wait_for()
    forms = p.locator(".coverage tr", has_text="Forms")
    check("coverage per folder, in words as well as a bar", "understood" in forms.inner_text() and forms.locator(".cov-bar span").count() >= 1, forms.inner_text())
    check("no single score anywhere", "%" not in p.locator(".coverage").inner_text())
    due = p.locator(".rows.due li")
    check("a note marked two days ago is due for review", due.count() >= 1 and "Differential forms" in p.locator(".rows.due").inner_text(), p.locator(".rows.due").inner_text() if due.count() else "none")
    check("a heavy day is noted once, quietly", "consolidation tends to work better after a break" in p.locator(".load-note").inner_text())
    p.get_by_role("link", name="Review them").click()
    check("Review them starts recall with what is due", p.locator(".practice-card h2").inner_text() in p.evaluate("() => 'Differential forms|Exterior derivative'"), p.locator(".practice-card h2").inner_text())

    # Hiding what is not reached.
    p.goto(URL + "?nosw#/k/forms/stokes-theorem")
    total = p.locator(".tree .item").count()
    p.locator(".tree .item").first.wait_for()
    total, folders = p.locator(".tree .item").count(), p.locator(".tree summary.dir").count()
    p.get_by_label("Hide what I have not reached").check()
    p.wait_for_timeout(300)
    shown, shown_folders = p.locator(".tree .item").count(), p.locator(".tree summary.dir").count()
    check("hiding leaves the reached notes and their frontier in the tree", (shown < total or shown_folders < folders)
          and p.locator(".tree .item a", has_text="Stokes' theorem").count() == 1, (shown, total, shown_folders, folders))
    check("…the frontier drawn faintly", p.locator(".tree .item a.frontier").count() >= 1)
    p.locator(".filter").fill("geodesic")
    p.wait_for_timeout(200)
    check("filtering still finds everything", p.locator(".tree .item").count() >= 1, p.locator(".tree .item").count())
    p.locator(".filter").fill("")
    # In a folder in focus, where the calmer map draws what is not reached (T62).
    p.goto(URL + "?nosw#/map/manifolds")
    p.wait_for_selector(".m-dir", timeout=20000)
    p.wait_for_timeout(800)
    drawn = lambda: p.locator(".m-place").count() + p.locator(".m-dir").count()
    hidden_places = drawn()
    check("the switch is shared with the map", p.get_by_label("Hide what I have not reached").is_checked())
    p.get_by_label("Hide what I have not reached").uncheck()
    p.wait_for_timeout(800)
    check("…which hides what is not reached too", drawn() > hidden_places, (hidden_places, drawn()))
    p.screenshot(path=str(OUT / "learn-coverage-map.png"))
    p.goto(URL + "?nosw#/map")
    p.wait_for_selector(".m-dir", timeout=20000)

    # ------------------------------------------------------------ the Atlas (T57)
    p.wait_for_function("() => (document.querySelector('.m-terrain .a-front')?.getAttribute('d') || '').length > 20", timeout=10000)
    check("the Atlas: the terrain of your understanding, reached ground lighter (calmer: no fog stipple, no hachures)",
          p.locator(".m-terrain .a-reached").count() == 1 and p.locator(".m-terrain .a-fog, .m-terrain .a-hach").count() == 0 and p.locator(".m-landfill").count() >= 1)
    heads = p.locator("text.m-head .count").evaluate_all("els => els.map(e => e.textContent)")
    check("…folders count the notes reached (14/18)", any("/" in t for t in heads), heads)
    check("…and the key is folded behind one button", not p.locator(".map-key").is_visible() and p.get_by_role("button", name="Show the key").is_visible())
    p.wait_for_function("() => document.querySelectorAll('.m-count').length > 0", timeout=10000)  # downhill routes come from the worker
    counts = p.locator(".m-count").evaluate_all("els => els.map(e => e.textContent)")
    check("…links as trunks between top-level folders, each with its count", len(counts) >= 1 and all(c.isdigit() for c in counts), counts)
    check("…a sentence on what is drawn", "trunk" in p.locator(".map-summary").inner_text(), p.locator(".map-summary").inner_text())
    check("…and north is later in the study order", p.locator(".atlas-north").is_visible())
    # Contour folders and downhill routes (T60), the defaults; circles and gates the options.
    p.wait_for_function("() => document.querySelector('.map-summary')?.textContent.includes('right angle')", timeout=10000)
    check("folders are contours of their contents, named above the outline",
          p.locator("text.m-head").count() >= 1 and p.locator("text.m-arc").count() == 0
          and "a" not in (p.locator(".m-dir.open").first.get_attribute("d") or "a").lower())
    check("…and routes cross outlines downhill, measured", "off a right angle" in p.locator(".map-summary").inner_text(), p.locator(".map-summary").inner_text())
    p.locator(".map-more > summary").click()
    p.get_by_role("group", name="Folders").get_by_role("button", name="Circles").click()
    p.get_by_role("group", name="Routes").get_by_role("button", name="Gates").click()
    p.wait_for_timeout(500)
    check("circles and gates instead: names on the arc, no right-angle measure",
          p.locator("text.m-arc").count() >= 1 and "right angle" not in p.locator(".map-summary").inner_text(), p.locator(".map-summary").inner_text())
    # The grid (T63): snapped at once, searched in the worker, then kept.
    p.get_by_role("group", name="Folders").get_by_role("button", name="Grid").click()
    p.wait_for_function("() => document.querySelector('.map-wrap')?.dataset.grid === 'convex'", timeout=30000)
    p.wait_for_function("() => document.querySelectorAll('.m-grid .g-route').length > 0", timeout=15000)  # routes come from the worker
    check("the grid Atlas: notes as blocks on cells, convex folders by default, routes along the cells",
          p.locator(".m-grid .grid-note").count() >= 20 and p.locator(".m-grid .g-floor").count() >= 5 and p.locator(".m-grid .g-route").count() >= 1,
          (p.locator(".m-grid .grid-note").count(), p.locator(".m-grid .g-floor").count(), p.locator(".m-grid .g-route").count()))
    p.get_by_role("group", name="Grid folders").get_by_role("button", name="Free").click()
    p.wait_for_function("() => document.querySelector('.map-wrap')?.dataset.grid === 'searched'", timeout=30000)
    kept = p.evaluate("() => JSON.parse(localStorage.getItem('rdstudio.grid.3') || 'null')")
    check("…free folders from a layout search, kept in the browser", bool(kept and kept.get("pos")))
    p.get_by_role("group", name="Grid folders").get_by_role("button", name="Convex").click()
    p.screenshot(path=str(OUT / "learn-atlas-grid.png"))
    gnote = p.locator(".m-grid .grid-note[data-ref]").first
    gnote.click()
    expect(p.locator(".atlas-card")).to_be_visible()
    expect(p.locator(".m-grid .grid-note.selected")).to_have_count(1)
    check("…a block selects like a marker", True)
    p.keyboard.press("Escape")
    p.get_by_role("group", name="Folders").get_by_role("button", name="Contours").click()
    p.get_by_role("group", name="Routes").get_by_role("button", name="Downhill").click()
    p.locator(".map-more > summary").click()
    place = p.locator(".m-place[data-ref]").first
    ref = place.get_attribute("data-ref")
    place.click()
    card = p.locator(".atlas-card")
    expect(card).to_be_visible()
    expect(p.locator(f'.m-place.selected[data-ref="{ref}"]')).to_have_count(1)
    check("clicking a note selects it: its card, and only its own links, in the blue pen",
          p.locator(".m-routes .m-link.trunk").count() == 0 and p.locator(".m-count").count() == 0
          and "build" in card.inner_text() and p.locator(f'.m-place.selected[data-ref="{ref}"]').count() == 1,
          (p.locator(".m-routes .m-link.trunk").count(), p.locator(".m-count").count(), card.inner_text().replace("\n", " / ")))
    p.screenshot(path=str(OUT / "learn-atlas-selected.png"))
    p.keyboard.press("Escape")
    expect(card).to_be_hidden()
    p.get_by_role("button", name="Links", exact=True).click()
    p.wait_for_timeout(300)
    check("the Links lens off: the terrain and the folders alone", p.locator(".m-routes .m-link").count() == 0
          and "Links are off" in p.locator(".map-summary").inner_text())
    p.get_by_role("button", name="Links", exact=True).click()
    place = p.locator(f'.m-place[data-ref="{ref}"]')
    place.click()
    card.get_by_role("link", name="Open the note").click()
    p.wait_for_url(f"**#/k/{ref}")
    check("…and Open the note opens it", True)
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Where you stand").wait_for()
    p.screenshot(path=str(OUT / "learn-tab.png"), full_page=True)

    # ------------------------------------------------------- explain-back (T28)
    p.goto(URL + "?nosw#/k/forms/orientation")
    box = p.locator("details.explain-back")
    box.locator("summary").click()
    p.wait_for_timeout(400)  # the visit is recorded meanwhile, which must not close it
    check("the explain-back section stays open while the visit is recorded", box.get_attribute("open") is not None)
    p.get_by_label("Your explanation").fill("A consistent choice of which bases count as positive, everywhere at once.")
    p.get_by_role("button", name="Save for marking").click()
    expect(box.locator(".edit-status")).to_contain_text("Saved")
    settle("explain", 1)
    answer = events("explain")[-1]
    check("an explanation is saved to the record, waiting for an agent", answer["concept"] == "forms/orientation" and answer["kind"] == "ai"
          and "waiting for marking" in box.locator(".explain-list").inner_text(), answer)
    with (record_dir() / "record.jsonl").open("a") as f:
        f.write(json.dumps({"id": "01J" + "M" * 23, "at": ago(0), "device": "test", "event": "explain_marked", "ref": answer["id"], "concept": "forms/orientation",
                            "hash": answer.get("hash"), "result": "partly", "feedback": "Right about consistency; say what positive means: an orientation of each tangent space.",
                            "gaps": ["orientation of a vector space"], "kind": "ai", "by": "agent/test"}) + "\n")
        f.write(json.dumps({"id": "01J" + "Q" * 23, "at": ago(0), "device": "test", "event": "question", "concept": "forms/stokes-theorem",
                            "question": "Why does the boundary appear in Stokes' theorem?", "kind": "ai", "by": "agent/test"}) + "\n")
    p.reload()
    box = p.locator("details.explain-back")
    box.locator("summary").click()
    check("an agent's marking shows under the note, with the gaps", "Partly" in box.locator(".explain-meta").first.inner_text()
          and "orientation of a vector space" in box.inner_text(), box.inner_text()[:300])
    p.goto(URL + "?nosw#/k/forms/stokes-theorem")
    box = p.locator("details.explain-back")
    expect(box).to_have_attribute("open", "")
    check("a question an agent set opens the section and is asked", "Why does the boundary appear" in box.locator(".explain-q").inner_text())
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Explain-back").wait_for()
    learn = p.locator(".page").inner_text()
    check("the Learn tab lists questions for you and marked answers", "Why does the boundary appear" in learn and "Right about consistency" in learn and "Nothing waiting for marking" in learn)

    # ------------------------------------------------------ catching up (T29)
    derham = ROOT / "knowledge/forms/de-rham-cohomology.md"
    derham.write_text(derham.read_text().rstrip("\n") + "\n\nA line added after you last looked.\n")
    with (record_dir() / "record.jsonl").open("a") as f:
        f.write(json.dumps({"id": "01J" + "L" * 23, "at": ago(3), "device": "test", "event": "seen", "concept": "forms/de-rham-cohomology", "hash": "the-version-you-saw"}) + "\n")
    time.sleep(1.5)  # the server rebuilds after the edit
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Changed since you looked").wait_for()
    check("the Learn tab lists a note changed since you looked", p.locator(".rows.changed-since", has_text="De Rham cohomology").count() == 1)
    p.locator(".rows.changed-since a", has_text="De Rham cohomology").click()
    banner = p.locator(".catch-up").first
    expect(banner).to_contain_text("Changed since you last looked (3 days ago)")
    banner.get_by_role("button", name="Show what changed").click()
    expect(banner.locator(".catch-diff")).to_be_visible(timeout=10000)
    check("…and what changed, from git: the added line, not yet committed",
          "A line added after you last looked." in banner.locator(".catch-diff .d-add").all_inner_texts()[-1]
          and "not committed yet" in banner.inner_text(), banner.inner_text()[:400])
    p.screenshot(path=str(OUT / "learn-catch-up.png"))
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Changed since you looked").wait_for()
    p.wait_for_timeout(300)
    check("opening it counts as looking", p.locator(".rows.changed-since", has_text="De Rham cohomology").count() == 0)

    # A prerequisite rewritten after you understood a note.
    p.goto(URL + "?nosw#/k/forms/stokes-theorem")
    p.locator("aside.meta").get_by_role("button", name="Understood").click()
    settle("mark", 4)
    time.sleep(1.1)
    ext = ROOT / "knowledge/forms/exterior-derivative.md"
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    import re as _re
    ext.write_text(_re.sub(r"(generated:\s*\n\s*by: [^\n]*\n\s*at: )[^\n]*", lambda m: m.group(1) + stamp, ext.read_text(), count=1))
    time.sleep(1.5)
    p.reload()
    shaken = p.locator(".catch-up", has_text="which it requires")
    expect(shaken).to_be_visible(timeout=10000)
    check("a note you understood says when a note it requires has changed since", "Exterior derivative" in shaken.inner_text(), shaken.inner_text())
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Changed since you looked").wait_for()
    check("…and the Learn tab lists it", p.locator(".rows.changed-since li", has_text="Stokes").count() >= 1)

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
    p.goto(URL + "?nosw#/practice/gap")
    expect(p.locator(".practice-card")).to_be_visible()
    check("exercises fit a phone with no sideways scrolling", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    p.locator(".practice-options button").first.tap()
    check("…and answer with a tap", p.locator(".practice-verdict").is_visible())
    p.screenshot(path=str(OUT / "learn-practice-phone.png"))

    browser.close()

server.terminate()
check("no errors in the browser console", not errors, errors[:5])
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
raise SystemExit(1 if failed else 0)
