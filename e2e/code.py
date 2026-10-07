"""End to end: the code map (T66) in headless Chromium, on a fresh copy of the
nanosim test bed (bench/nanosim.py: a nanobind particle simulation, a
codebase, so project mode). Run with: mise run e2e

The Atlas in project mode maps the code: directories, files, classes,
functions. A class's page: what binds it to Python, what tests it, the note
about it, its source. A Python function calls the C++ class it reaches
through the binding. Notes or Code from the panel.
"""
import os, shutil, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-code-"))
ROOT = TMP / "nanosim"
subprocess.run([sys.executable, str(REPO / "bench/nanosim.py"), str(ROOT)], check=True, stdout=subprocess.DEVNULL)
ENV = {**os.environ, "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}

with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)],
                          env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(200):
    try:
        socket.create_connection(("127.0.0.1", PORT), 0.2).close()
        break
    except OSError:
        time.sleep(0.1)

results = []
def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))

errors = []
code = lambda item: URL + "?nosw#/code/" + item.replace("#", "@")
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1440, "height": 900})
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))

    # The Atlas maps the knowledge base; the code when asked for (Map: Code), which this browser then keeps.
    p.goto(URL + "?nosw#/map")
    p.wait_for_selector(".g-title", timeout=20000)
    p.wait_for_timeout(1200)
    names = p.locator(".g-title").evaluate_all("els => els.map(e => e.textContent.trim().toLowerCase())")
    check("the Atlas maps the notes by default, in project mode too", any(n.startswith("design") or n.startswith("decisions") for n in names), names[:20])
    p.locator(".map-more > summary").click()
    p.get_by_role("group", name="Map").get_by_role("button", name="Code").click()
    p.wait_for_timeout(2500)
    names = p.locator(".g-title").evaluate_all("els => els.map(e => e.textContent.trim().toLowerCase())")
    check("Code from the panel: the Atlas maps the code, its directories", any(n.startswith("src") for n in names) and any(n.startswith("python") for n in names), names[:20])
    check("…each folder a layered DAG, with trunks between them", len(p.evaluate("() => document.querySelector('.map-wrap').routes()")) >= 3)
    check("…and says so: Map, Code", p.locator(".map-more").evaluate("d => { d.open = true; return d.querySelector('[aria-label=Map] [aria-pressed=true]')?.textContent }") == "Code")
    # Folderless (T71): the whole map as one layout, each item with its folder's colour.
    p.get_by_role("group", name="Folders").get_by_role("button", name="None").click()
    p.wait_for_function("() => document.querySelectorAll('svg.gridmap .gn-folder').length > 20 && !document.querySelector('svg.gridmap .g-wall')", timeout=15000)
    check("Folders: None: one layout with no folders, a colour on each item for its folder, and the folders named", p.locator(".map-folders li").count() >= 4 and p.locator(".map-folders li").first.is_visible(), p.locator(".map-folders li").count())
    p.locator(".map-folders > summary").click()
    check("…the list of folders folds away", not p.locator(".map-folders li").first.is_visible())
    p.locator(".map-folders > summary").click()
    p.screenshot(path=str(OUT / "code-atlas-flat.png"))
    p.get_by_role("group", name="Folders").get_by_role("button", name="Shown").click()
    p.wait_for_selector("svg.gridmap .g-wall", timeout=15000)
    # The panel folds to a bar.
    p.locator(".graph-options > summary").click()
    check("the Atlas's settings fold away, and come back", not p.locator(".map-legend.kinds").is_visible())
    p.locator(".graph-options > summary").click()
    check("…with code's kinds in the key", "Class" in p.locator(".map-legend.kinds").inner_text() and "Method" in p.locator(".map-legend.kinds").inner_text())
    p.screenshot(path=str(OUT / "code-atlas.png"))

    # A class's page.
    p.goto(code("src/nanosim/core/system.hpp#nanosim::ParticleSystem"))
    p.get_by_role("heading", name="ParticleSystem").wait_for(timeout=20000)
    body = p.locator(".code-page").inner_text()
    check("a class's page: where it is, and that it is bound to Python", "src/nanosim/core/system.hpp:" in body and "bound to Python as ParticleSystem" in body, body[:300])
    check("…what it defines: methods and fields", p.locator(".code-kids li", has_text="compute_forces").count() == 1 and p.locator(".code-kids li", has_text="particles_").count() == 1)
    links = p.locator(".code-links").inner_text()
    check("…its links: bound by, called by, tested by", "Bound by" in links and "Called by" in links and "Tested by" in links, links)
    check("…the note about it", p.locator(".code-page .rows a.title", has_text="The particle system").count() == 1)
    check("…and its source", "compute_forces" in p.locator(".code-page pre").last.inner_text())
    p.screenshot(path=str(OUT / "code-class.png"), full_page=True)

    # Across the binding: Python calling C++.
    p.goto(code("python/nanosim/presets.py#two_body"))
    p.get_by_role("heading", name="two_body").wait_for()
    links = p.locator(".code-links").inner_text()
    check("a Python function calls the C++ classes it reaches through the binding", "nanosim::Gravity" in links and "nanosim::ParticleSystem" in links, links)
    p.get_by_role("link", name="nanosim::Gravity").click()
    p.get_by_role("heading", name="Gravity").wait_for()
    check("…and a link goes to the C++ class's page", "src/nanosim/forces/gravity.hpp" in p.locator(".code-page").inner_text())

    # A code item on the Atlas: its card.
    p.goto(URL + "?nosw#/map/src/nanosim/core/")
    p.wait_for_selector("svg.gridmap g.gn", timeout=20000)
    p.wait_for_timeout(1200)
    check("…a link may end on a file or a class: trunks inside src/nanosim/core", len(p.evaluate("() => document.querySelector('.map-wrap').routes()")) >= 3)
    check("…and feeders: inside a folder, branches from its items to the foot of each trunk", p.locator("svg.gridmap .g-routes g.feed").count() >= 5, p.locator("svg.gridmap .g-routes g.feed").count())
    p.locator("svg.gridmap g.gn").first.click()
    card = p.locator(".atlas-card")
    expect(card).to_be_visible()
    check("selecting a code item: its card, with Open", card.get_by_role("link", name="Open").count() == 1 and " in " in card.inner_text(), card.inner_text())

    # Notes instead.
    p.locator(".map-more > summary").click()
    p.get_by_role("group", name="Map").get_by_role("button", name="Notes").click()
    p.wait_for_timeout(1500)
    names = p.locator(".g-title").evaluate_all("els => els.map(e => e.textContent.trim().toLowerCase())")
    check("Notes from the panel: the knowledge base's folders", any(n.startswith("design") or n.startswith("decisions") for n in names), names[:20])

    # The index is quick.
    t0 = time.time()
    subprocess.run(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "__index-code"], check=True, stdout=subprocess.DEVNULL, env=ENV)
    check("indexing the code takes under two seconds (a child process, parsers and all)", time.time() - t0 < 2, round(time.time() - t0, 2))

    # The mode is switched from the tag beside the project's name (T75), and is the project's: rdstudio.toml.
    p.goto(URL + "?nosw#/")
    tag = p.locator(".mode-tag")
    expect(tag).to_have_text("Project")
    tag.click()
    expect(tag).to_have_text("Learning")
    toml = (ROOT / "rdstudio.toml").read_text()
    check("the mode tag switches the project to Learning: Practice takes the Project space's place, and rdstudio.toml says topic",
          p.locator('nav.tabs a[data-tab="practice"]').count() == 1 and p.locator('nav.tabs a[data-tab="project"]').count() == 0 and 'profile = "topic"' in toml, toml)
    p.goto(URL + "?nosw#/settings")
    p.get_by_role("radiogroup", name="This project's mode").get_by_role("radio", name="Project").click()
    expect(tag).to_have_text("Project")
    check("…and Settings switches it back: the profile is a codebase again", 'profile = "codebase"' in (ROOT / "rdstudio.toml").read_text() and p.locator('nav.tabs a[data-tab="project"]').count() == 1)

    check("no errors in the browser console", not errors, errors[:5])
    browser.close()

server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
