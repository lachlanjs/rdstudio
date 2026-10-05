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

    # The Atlas, in project mode, maps the code.
    p.goto(URL + "?nosw#/map")
    p.wait_for_selector(".m-dir", timeout=20000)
    p.wait_for_timeout(1500)
    names = p.locator("text.m-head .name, text.m-arc .name, text.m-text.territory").evaluate_all("els => els.map(e => e.textContent.trim())")
    check("in project mode the Atlas maps the code: its directories", any(n.startswith("src") for n in names) and any(n.startswith("python") for n in names), names[:20])
    check("…and says so: Map, Code", p.locator(".map-more").evaluate("d => { d.open = true; return d.querySelector('[aria-label=Map] [aria-pressed=true]')?.textContent }") == "Code")
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
    p.goto(URL + "?nosw#/map/src")
    p.wait_for_selector(".m-place", timeout=20000)
    p.wait_for_timeout(1200)
    place = p.locator(".m-place[data-ref]").first
    ref = place.get_attribute("data-ref")
    place.click()
    card = p.locator(".atlas-card")
    expect(card).to_be_visible()
    check("selecting a code item: its card, with Open", card.get_by_role("link", name="Open").count() == 1 and " in " in card.inner_text(), card.inner_text())

    # Notes instead.
    p.locator(".map-more > summary").click()
    p.get_by_role("group", name="Map").get_by_role("button", name="Notes").click()
    p.wait_for_timeout(1500)
    names = p.locator("text.m-head .name, text.m-arc .name, text.m-text.territory").evaluate_all("els => els.map(e => e.textContent.trim())")
    check("Notes from the panel: the knowledge base's folders", any(n.startswith("Design") or n.startswith("Decisions") for n in names), names[:20])

    # The index is quick.
    t0 = time.time()
    subprocess.run(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "__index-code"], check=True, stdout=subprocess.DEVNULL, env=ENV)
    check("indexing the code takes under two seconds (a child process, parsers and all)", time.time() - t0 < 2, round(time.time() - t0, 2))

    check("no errors in the browser console", not errors, errors[:5])
    browser.close()

server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
