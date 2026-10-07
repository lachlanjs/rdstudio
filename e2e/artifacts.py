"""End to end: artifacts and pictures (T76), in headless Chromium, on a small
project made here. Run with: mise run e2e

An artifact is an HTML file beside the notes. A note links to it or shows it
in place; it runs in a sandbox, offline, as tall as its content, in the
app's colours; one that goes wrong says so in a line. Pictures are 80% of
the text's width, centred or at the left.
"""
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-artifacts-"))
ROOT = TMP / "project"
K = ROOT / "knowledge"
def put(rel, text):
    f = ROOT / rel
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(text)
put("rdstudio.toml", '[project]\ntitle = "Waves"\n\n[teacher]\nprofile = "topic"\n')
put("knowledge/index.md", '---\nokf_version: "0.2"\n---\n')
put("knowledge/design/waves.md", """---
type: Design
title: Waves
description: A standing wave, shown.
---

A standing wave, to play with:

![The standing wave](wave.html)

The same, [on its own page](wave.html "uses").

![A broken one](broken.html)

![One that needs the network](online.html)

![A dot at the left](dot.svg "left")

![A dot in the centre](dot.svg)
""")
put("knowledge/design/other.md", "---\ntype: Design\ntitle: Other\n---\n\nSee [the wave](/design/wave.html).\n")
put("knowledge/design/dot.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#246"/><circle cx="100" cy="50" r="30" fill="#fc6"/></svg>')
put("knowledge/design/wave.html", """<!doctype html>
<html><head><meta charset="utf-8"><title>A standing wave</title>
<meta name="description" content="Move the slider to change the mode.">
<link rel="stylesheet" href="vendor/katex/katex.min.css">
<script src="vendor/katex/katex.min.js"></script>
<style>body{margin:0;padding:12px;background:var(--surface,#fff);color:var(--text,#000);font:15px sans-serif}canvas{width:100%;height:180px;display:block}</style>
</head><body>
<p id="eq"></p>
<canvas id="c" width="600" height="180"></canvas>
<input id="n" type="range" min="1" max="6" value="2" aria-label="Mode">
<p style="height:120px">A linked note: <a href="/design/waves.md">Waves</a>.</p>
<script>
const out = window.__r = {katex: typeof katex === "object" || typeof katex === "function"};
try { katex.render("y = \\\\sin(n\\\\pi x)", document.getElementById("eq")); out.rendered = document.querySelectorAll(".katex").length > 0; } catch (e) { out.rendered = String(e); }
const c = document.getElementById("c"), g = c.getContext("2d"), n = document.getElementById("n");
function draw() { g.clearRect(0, 0, 600, 180); g.beginPath(); for (let x = 0; x <= 600; x++) g.lineTo(x, 90 - 70 * Math.sin(n.value * Math.PI * x / 600)); g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--text") || "#000"; g.stroke(); out.drawn = Number(n.value); }
n.addEventListener("input", draw); draw();
try { localStorage.setItem("a", "b"); out.storage = "READABLE"; } catch (e) { out.storage = "blocked"; }
try { out.parent = String(parent.document.title); } catch (e) { out.parent = "blocked"; }
fetch("https://example.com/").then(() => { out.network = "REACHED"; }, () => { out.network = "blocked"; });
fetch("/api/edit").then((r) => r.json()).then((j) => { out.api = "READ " + JSON.stringify(j).slice(0, 40); }, () => { out.api = "blocked"; });
</script></body></html>
""")
put("knowledge/design/broken.html", "<!doctype html><title>Broken</title><p>Half a figure.</p><script>undefinedFunction();</script>")
put("knowledge/design/online.html", '<!doctype html><title>Tiles</title><meta name="rdstudio:network" content="required"><p id="t">loaded</p>')
put("knowledge/design/cdn.html", '<!doctype html><title>From a CDN</title><script src="https://cdn.example.com/lib.js"></script><p>x</p>')

ENV = {**os.environ, "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
CLI = ["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT)]
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(CLI + ["serve", "--port", str(PORT)], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
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

# The lint.
lint = subprocess.run(CLI + ["check", "--warnings"], env=ENV, capture_output=True, text=True).stdout
check("rdstudio check: counts the artifacts, and warns of an address elsewhere and of one that needs the network",
      "4 artifacts" in lint and "design/cdn.html: loads https://cdn.example.com/lib.js" in lint and "design/online.html: needs the network" in lint and "0 errors" in lint, lint)

# As served: apart from the app, and never as it is written.
r = urllib.request.urlopen(URL + "a/design/wave.html")
body = r.read().decode()
check("an artifact is served sandboxed, with the no-network policy and the bridge in it", r.headers.get("Content-Security-Policy", "").startswith("sandbox allow-scripts") and "connect-src 'none'" in body and 'rdstudio:"artifact"' in body, dict(r.headers))
try:
    urllib.request.urlopen(URL + "data/k/design/wave.html"); raw = True
except Exception:
    raw = False
check("…and not as a plain file beside the notes", not raw)

errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 1000})
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(URL + "?nosw#/k/design/waves")
    embed = p.locator('.artifact-embed[data-artifact="design/wave.html"]')
    expect(embed.locator("iframe")).to_be_visible(timeout=15000)
    p.wait_for_function("() => document.querySelector('.artifact-embed[data-artifact=\"design/wave.html\"]').classList.contains('ready')", timeout=15000)
    frame = next(f for f in p.frames if f.url.endswith("/a/design/wave.html"))
    p.wait_for_timeout(1200)
    res = frame.evaluate("window.__r")
    check("an embed runs: a script draws on a canvas, and a library from rdstudio's own vendor folder loads and renders", res.get("katex") is True and res.get("rendered") is True and res.get("drawn") == 2, res)
    check("…in a sandbox: the app's storage, its page, its API and the internet are all out of reach", res.get("storage") == "blocked" and res.get("parent") == "blocked" and res.get("network") == "blocked" and res.get("api") == "blocked", res)
    h = embed.locator("iframe").evaluate("f => f.getBoundingClientRect().height")
    inner = frame.evaluate("document.documentElement.scrollHeight")
    check("…as tall as its content, with its caption under it", abs(h - inner) <= 4 and h > 300 and embed.locator(".artifact-caption").inner_text() == "The standing wave", (h, inner))
    same = frame.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()") == p.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()")
    check("…and in the app's colours", same)
    frame.locator("#n").fill("5")
    check("…and it responds: the slider redraws the wave", frame.evaluate("window.__r.drawn") == 5)

    bad = p.locator('.artifact-embed[data-artifact="design/broken.html"]')
    expect(bad.locator(".artifact-note")).to_contain_text("reported an error", timeout=15000)
    check("an embed that goes wrong says so in one line, and the note round it is whole", p.locator(".prose").inner_text().count("The same,") == 1 and bad.locator(".artifact-note a").get_attribute("href") == "#/a/design/broken.html")
    online = p.locator('.artifact-embed[data-artifact="design/online.html"]')
    check("one that needs the network is not loaded in a note until asked for", online.locator("iframe").count() == 0 and online.get_by_role("button", name="Load (it needs the network)").count() == 1)

    link = p.locator(".prose a.artifact-link")
    check("a link to an artifact goes to its page in the app", link.get_attribute("href") == "#/a/design/wave.html")
    w = p.locator(".prose").evaluate("e => e.getBoundingClientRect().width")
    pics = p.locator(".prose .pic img").evaluate_all("els => els.map(e => { const r = e.getBoundingClientRect(), b = e.closest('.prose').getBoundingClientRect(); return [r.width, r.left - b.left, b.right - r.right, e.closest('.pic').className]; })")
    left, centre = pics[0], pics[1]
    check("pictures are 80% of the text's width: one at the left, one in the centre", abs(left[0] - 0.8 * w) < 3 and left[1] < 3 and "left" in left[3] and abs(centre[0] - 0.8 * w) < 3 and abs(centre[1] - centre[2]) < 3, (w, pics))
    p.screenshot(path=str(OUT / "artifacts-note.png"), full_page=True)

    link.click()
    expect(p.locator(".report-bar strong")).to_have_text("A standing wave")
    cited = p.locator(".artifact-cited").inner_text()
    check("an artifact's page: its title, and the notes that cite it (the artifact's own link back is not read)", "Waves" in cited and "Other" in cited and p.locator(".artifact-page iframe").count() == 1, cited)
    p.goto(URL + "?nosw#/artifacts")
    p.wait_for_selector(".rows .title")
    p.wait_for_timeout(400)
    rows = p.locator(".rows .title").all_inner_texts()
    check("the Artifacts page lists them, where reports were", set(rows) == {"A standing wave", "Broken", "Tiles", "From a CDN"} or len(rows) == 4, rows)
    # On the Atlas (T77): an item of its folder, after the notes that cite it.
    p.goto(URL + "?nosw#/map/design")
    art = p.locator('svg.gridmap g.gn.art[aria-label="A standing wave"]')
    expect(art).to_have_count(1, timeout=20000)
    p.wait_for_timeout(800)
    lay = p.evaluate("""() => { const L = document.querySelector('.map-wrap').layout(); const at = (ref) => L.items.findIndex((n) => n.ref === ref);
      const a = at('design/wave.html'), w = at('design/waves'), o = at('design/other');
      return { arts: L.items.filter((n) => /\\.html$/.test(n.ref)).length, folder: L.items[L.items[a].parent].ref, joined: L.links.filter((l) => l.a === a).map((l) => l.b).sort(), notes: [w, o].sort(), out: L.links.filter((l) => l.b === a).length }; }""")
    check("on the Atlas an artifact is an item of its folder, joined to the notes that cite it, with nothing leading out of it",
          lay["arts"] == 4 and lay["folder"] == "design" and lay["joined"] == lay["notes"] and lay["out"] == 0, lay)
    art.click()
    card = p.locator(".atlas-card")
    expect(card).to_be_visible()
    check("…its card says what it is and who cites it, and opens it", "An artifact" in card.inner_text() and "Cited by 2 notes" in card.inner_text() and card.get_by_role("link", name="Open").get_attribute("href") == "#/a/design/wave.html", card.inner_text())
    check("…and the key names the kind", "Artifact" in p.locator(".map-legend.kinds").inner_text())
    p.screenshot(path=str(OUT / "artifacts-atlas.png"))
    concepts = json.load(urllib.request.urlopen(URL + "data/concepts.json"))
    waves = next(c for c in concepts if c["id"] == "design/waves")
    check("a note's links to notes are as they were: citing an artifact adds none, and an artifact adds none back", waves["links"] == [] and waves["backlinks"] == [] and len(waves["cites"]) == 6, waves)
    own = [e for e in errors if "undefinedFunction" not in e]  # the broken artifact's own error, inside its frame
    check("no errors in the app's own page", not own, own[:4])
    browser.close()

server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
