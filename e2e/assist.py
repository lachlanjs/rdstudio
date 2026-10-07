"""End to end: an agent in the editor (T74), in headless Chromium, on a fresh
copy of the nanosim test bed, with a fake OpenRouter in place of the model.
Run with: mise run e2e

While a note is edited: ask about a selected passage (an answer beside the
note, nothing changed); have text written at the cursor (a suggestion in the
note, accepted or rejected); the model is given the note, the notes it links
to and the code named; and a saved note's stamp names the model.
"""
import json, os, re, shutil, socket, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-assist-"))
ROOT = TMP / "nanosim"
subprocess.run([sys.executable, str(REPO / "bench/nanosim.py"), str(ROOT)], check=True, stdout=subprocess.DEVNULL)
NOTE = ROOT / "knowledge/design/forces.md"

CODE = "```cpp\nVec3 minimum_image(Vec3 d, double box);\n```"
FAKE_REQUESTS = []
class FakeOpenRouter(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FAKE_REQUESTS.append(body)
        said = "\n".join(part["text"] for m in body["messages"] for part in (m["content"] if isinstance(m["content"], list) else [{"text": m["content"] or ""}]))
        # As a model that looks things up would (T84): on the first turn of a question or of a request for code it
        # calls tools, and replies once their results are in the conversation.
        want = said.split("## What to do")[-1]
        first = body.get("tools") and not any(m["role"] == "tool" for m in body["messages"])
        calls = [("search_notes", {"query": "softened gravity close pairs"}), ("read_note", {"id": "/design/particle-system.md"})] if first and "Why is this so?" in want \
            else [("search_code", {"text": "minimum_image"}), ("read_code", {"path": "src/nanosim/core/vec3.hpp", "from": 1, "to": 60})] if first and "minimum_image" in want else []
        if calls:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': 'Let me look.'}}]})}\n\n".encode())
            for k, (name, args) in enumerate(calls):
                self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'tool_calls': [{'index': k, 'id': f'call_{k}', 'function': {'name': name, 'arguments': ''}}]}}]})}\n\n".encode())
                self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'tool_calls': [{'index': k, 'function': {'arguments': json.dumps(args)}}]}}]})}\n\n".encode())
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 900, 'completion_tokens': 30, 'cost': 0.0011}})}\n\n".encode())
            self.wfile.write(b"data: [DONE]\n\n")
            return
        if "You are writing an artifact" in said:
            good = "<!doctype html><html><head><title>Softening</title><meta name='description' content='The softened force.'></head><body style='margin:0;padding:8px;color:var(--text,#000)'><input id='e' type='range' min='1' max='9' value='3' aria-label='Softening'><canvas id='c' width='300' height='120' style='display:block'></canvas><script>const c=document.getElementById('c').getContext('2d'),e=document.getElementById('e');function d(){c.clearRect(0,0,300,120);c.beginPath();for(let x=1;x<300;x++)c.lineTo(x,110-900/(x*x/90+e.value*e.value));c.stroke();window.__drawn=+e.value}e.oninput=d;d();</scr" + "ipt></body></html>"
            wrong = good.replace("d();</scr", "d();undefinedHelper();</scr")
            spins = good.replace("d();</scr", "d();(function f(){requestAnimationFrame(f)})();</scr")
            ask = said.split("## What to do")[-1]
            html = spins if "spin" in ask else good if "is not good enough to offer" in ask else wrong
            reply = f"<title>Softened gravity</title>\n<caption>Move the slider to change the softening.</caption>\n<artifact>\n{html}\n</artifact>\n<why>\nDrawn from the formula in the note.\n</why>"
        elif "Write the text to go at the marked place" in said:
            reply = f"<insert>\nFrom `src/nanosim/core/vec3.hpp`:\n\n{CODE}\n</insert>\n<why>\nThe declaration of `minimum_image`, copied from the header.\n</why>" if "minimum_image" in said.split("## What to do")[-1] \
                else "<insert>softened at short range</insert>\n<why>Shorter, and says the same.</why>"
        else:
            reply = "It is **softened** so that close pairs do not blow up. See [The particle system](/design/particle-system.md)."
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i in range(0, len(reply), 9):
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': reply[i:i + 9]}}]})}\n\n".encode())
            self.wfile.flush()
        self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 2000, 'completion_tokens': 60, 'cost': 0.0031}})}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
fake = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenRouter)
threading.Thread(target=fake.serve_forever, daemon=True).start()

ENV = {**os.environ, "RDSTUDIO_OPENROUTER_URL": f"http://127.0.0.1:{fake.server_address[1]}", "OPENROUTER_API_KEY": "sk-or-v1-fake0123456789",
       "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
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
def sent(body):
    return "\n".join(part["text"] for m in body["messages"] for part in (m["content"] if isinstance(m["content"], list) else [{"text": m["content"] or ""}]))

errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 900})
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    before = NOTE.read_text()

    p.goto(URL + "?nosw#/k/design/forces")
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    bar = p.locator(".assist-bar")
    expect(bar).to_be_visible()
    check("with a model account connected, the editor has a bar to ask from", bar.get_by_role("button", name="Ask").is_disabled() and bar.get_by_role("button", name="Write here").is_disabled())
    # Source view, so that offsets on screen are the text's.
    p.get_by_role("button", name="Source").click()

    # Ask about a selected passage.
    first = p.locator(".cm-line", has_text=re.compile(r"\w{4,}")).nth(1)
    first.click(click_count=3)
    expect(bar.get_by_role("button", name="Rewrite")).to_be_visible()
    bar.get_by_role("textbox").fill("Why is this so?")
    bar.get_by_role("button", name="Ask").click()
    panel = p.locator(".assist-reply")
    expect(panel.locator(".assist-answer")).to_contain_text("softened", timeout=15000)
    check("Ask: an answer beside the note, with a link to a note, the model and the cost", panel.locator(".assist-answer a", has_text="The particle system").count() == 1 and "$" in panel.locator(".assist-meta").inner_text() or "¢" in panel.locator(".assist-meta").inner_text(), panel.inner_text())
    check("…and what it drew on is what it opened itself: the one note it read", panel.locator(".assist-sources a").all_inner_texts() == ["The particle system"], panel.inner_text())
    panel.locator(".assist-looked summary").click()
    steps = panel.locator(".assist-looked li").all_inner_texts()
    check("…what it looked up is listed in order: a search, then a note read", len(steps) == 2 and steps[0].startswith('Searched the notes for "softened gravity close pairs"') and steps[1].startswith("Read The particle system"), steps)
    said = sent(FAKE_REQUESTS[-1])
    start = sent(FAKE_REQUESTS[-2])
    check("…the model was given the note with the passage marked and how to look things up, and nothing gathered for it",
          "⟦" in start and "⟧" in start and "## Looking things up" in start and "Why is this so?" in start and "## Notes found by searching" not in start and "## Code from the repository" not in start, start[-600:])
    check("…its lookups were run and answered: the search's finds and the note's text went back to it", [m["role"] for m in FAKE_REQUESTS[-1]["messages"]][-3:] == ["assistant", "tool", "tool"] and "/design/particle-system.md" in said, said[-600:])
    check("…asked at the usual tier for a question, mid, whose model the reply names", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-sonnet-5.5" and panel.locator(".assist-meta").inner_text().startswith("mid · "), (FAKE_REQUESTS[-1]["model"], panel.locator(".assist-meta").inner_text()))
    check("…and nothing in the note changed", p.locator(".edit-status").inner_text() == "No changes" and p.locator(".cm-suggest").count() == 0)
    panel.get_by_role("button", name="Close the reply").click()

    # A tier chosen on the bar (T83): the request goes to that tier's model, and the choice is remembered.
    pick = bar.get_by_label("How strong a model to ask")
    check("the bar offers how strong a model to ask: the usual, or low, mid or max, each naming its model",
          [o.strip() for o in pick.locator("option").all_inner_texts()] == ["Usual", "Low · claude-haiku-4.5", "Mid · claude-sonnet-5.5", "Max · claude-opus-5.5"], pick.locator("option").all_inner_texts())
    pick.select_option("low")

    # Rewrite the selection: a suggestion, rejected.
    first.click(click_count=3)
    old = p.evaluate("getSelection().toString()").strip()
    bar.get_by_role("button", name="Rewrite").click()
    sg = p.locator(".cm-suggest")
    expect(sg).to_contain_text("softened at short range", timeout=15000)
    check("Rewrite: the passage struck through and the proposed text beside it, to accept or reject", p.locator(".cm-suggest-old").count() >= 1 and sg.get_by_role("button", name="Accept").count() == 1)
    p.screenshot(path=str(OUT / "assist-rewrite.png"))
    check("…asked at Low, the rewrite went to the low tier's model", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-haiku-4.5" and p.evaluate("localStorage.getItem('rdstudio.assist.tier')") == "low", FAKE_REQUESTS[-1]["model"])
    pick.select_option("")
    sg.get_by_role("button", name="Reject").click()
    check("Reject: the suggestion goes and the note is as it was", p.locator(".cm-suggest").count() == 0 and p.locator(".edit-status").inner_text() == "No changes" and old[:20] in p.inner_text(".cm-content"))

    # Write at the cursor: code found by name, accepted.
    p.locator(".cm-line").last.click()
    p.keyboard.press("Control+End")
    bar.get_by_role("textbox").fill("Insert the declaration of `minimum_image` here.")
    bar.get_by_role("button", name="Write here").click()
    expect(sg).to_contain_text("minimum_image(Vec3 d, double box)", timeout=15000)
    said = sent(FAKE_REQUESTS[-1])
    tools = [m["content"] for m in FAKE_REQUESTS[-1]["messages"] if m["role"] == "tool"]
    check("Write here: the model was given the place (⟦HERE⟧), and found the code named for itself in the repository", "⟦HERE⟧" in said and len(tools) == 2 and "vec3.hpp" in tools[0] and "minimum_image" in tools[1], tools)
    check("…the reply says why, and lists the file it drew on", "copied from the header" in panel.inner_text() and "vec3.hpp" in panel.locator(".assist-sources").inner_text(), panel.inner_text())
    p.screenshot(path=str(OUT / "assist-write.png"))
    p.keyboard.press("Control+Enter")
    check("Accept (Ctrl+Enter): the text is in the note, which now has unsaved changes", p.locator(".cm-suggest").count() == 0 and "minimum_image(Vec3 d, double box)" in p.inner_text(".cm-content") and p.locator(".edit-status").inner_text() == "Unsaved changes")
    check("…and nothing was written until it is saved", NOTE.read_text() == before)
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_have_text("Saved")
    after = NOTE.read_text()
    check("Saved: the note holds the text, and its stamp names the model beside the person", "minimum_image(Vec3 d, double box)" in after and re.search(r"by: .*human:\S+ with openrouter/", after) is not None, after[:400])

    # Make a figure (T78): written, checked out of sight, put right once, shown, and saved only when accepted.
    p.get_by_role("button", name="Edit").click() if p.locator(".cm-content").count() == 0 else None
    p.wait_for_selector(".cm-content")
    before_n = len(FAKE_REQUESTS)
    first = p.locator(".cm-line", has_text=re.compile(r"Gravity")).first
    first.click(click_count=3)
    bar.get_by_role("button", name="Figure").click()
    fig = p.locator(".assist-figure iframe")
    expect(fig).to_be_visible(timeout=40000)
    asked = [sent(r) for r in FAKE_REQUESTS[before_n:]]
    check("Figure: the first try raised an error when loaded out of sight, so it went back to the model with what was wrong",
          len(asked) == 2 and "undefinedHelper" in asked[1].split("## What to do")[-1] and "The artifact you wrote before" in asked[1], [a[-300:] for a in asked])
    check("…the one put right is shown, checked, with nothing saved yet", "Checked: it loads without error" in panel.inner_text() and not (ROOT / "knowledge/design/softened-gravity.html").exists())
    inner = next(f for f in p.frames if "/p/" in f.url)
    inner.locator("#e").fill("7")
    check("…and it works in the preview: the slider redraws it", inner.evaluate("window.__drawn") == 7)
    p.screenshot(path=str(OUT / "assist-figure.png"))
    panel.get_by_role("button", name="Put it in the note").click()
    expect(panel).to_contain_text("Saved as design/softened-gravity.html", timeout=15000)
    made = (ROOT / "knowledge/design/softened-gravity.html").read_text()
    check("Put it in the note: the file is written beside the note, stamped with the model and the date",
          "<canvas" in made and 'rdstudio:author" content="openrouter/' in made and 'rdstudio:date"' in made, made[:300])
    p.get_by_role("button", name="Source").click()  # back to the live preview
    expect(p.locator(".cm-lp-figure iframe")).to_have_count(1, timeout=15000)
    check("…and its embed is in the note below the passage, shown in the preview", True)
    p.get_by_role("button", name="Source").click()
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_have_text("Saved")
    check("…saved with the note", "(softened-gravity.html)" in NOTE.read_text())

    # One that cannot be put right is not offered.
    p.locator(".cm-line", has_text=re.compile(r"Lennard")).first.click(click_count=3)
    bar.get_by_role("textbox").fill("Make it spin.")
    before_n = len(FAKE_REQUESTS)
    bar.get_by_role("button", name="Figure").click()
    expect(panel).to_contain_text("not good enough to offer", timeout=60000)
    check("a figure that keeps animating while untouched is sent back twice, then not offered, and why is said",
          len(FAKE_REQUESTS) - before_n == 3 and "kept animating" in panel.inner_text() and p.locator(".assist-figure").count() == 0 and not (ROOT / "knowledge/design/softened-gravity-2.html").exists(), panel.inner_text())

    check("…a figure is asked at max unless told otherwise", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-opus-5.5", FAKE_REQUESTS[-1]["model"])

    # The tiers' models are set on the Axis page (T83), into the user config.
    p.once("dialog", lambda d: d.accept())
    p.goto(URL + "?nosw#/teacher")
    low = p.get_by_label("Low", exact=True)
    expect(low).to_have_value("anthropic/claude-haiku-4.5", timeout=15000)
    save = p.get_by_role("button", name="Save the models")
    was_off = save.is_disabled()
    low.fill("google/gemini-3.8-flash")
    save.click()
    expect(p.locator(".edit-status", has_text="The editor's models are set.")).to_be_visible()
    conf = (TMP / "config/rdstudio/config.toml").read_text()
    check("the Axis page sets which model each tier is, written to the user config", was_off and '[teacher.tiers]\nlow = "google/gemini-3.8-flash"' in conf, conf)
    low.fill("not a model")
    save.click()
    expect(p.locator(".edit-status", has_text="not a model's id")).to_be_visible()
    check("…and refuses what is not a model's id, saying how one is written", "written as OpenRouter lists it" in p.locator(".edit-status", has_text="not a model's id").inner_text() and "not a model" not in (TMP / "config/rdstudio/config.toml").read_text())
    p.screenshot(path=str(OUT / "assist-tiers.png"), full_page=True)

    # No account: the bar says how to connect one.
    browser.close()

server.terminate()
ENV2 = {k: v for k, v in ENV.items() if k != "OPENROUTER_API_KEY"}
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)], env=ENV2, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(200):
    try:
        socket.create_connection(("127.0.0.1", PORT), 0.2).close()
        break
    except OSError:
        time.sleep(0.1)
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 900})
    p.goto(URL + "?nosw#/k/design/forces")
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    expect(p.locator(".assist-off")).to_be_visible()
    check("with no model account, the editor says how to connect one and offers nothing to ask", p.locator(".assist-bar").count() == 0 and p.locator(".assist-off a").get_attribute("href") == "#/teacher")
    browser.close()

own = [e for e in errors if "undefinedHelper" not in e and "400 (Bad Request)" not in e]  # the refused model id is a 400  # the first figure's own error, inside the frame it was checked in
check("no errors in the browser console", not own, own[:5])
server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
