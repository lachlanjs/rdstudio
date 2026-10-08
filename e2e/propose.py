"""End to end: Axis proposing changes from the Atlas (T101), in headless Chromium, on a fresh copy of the nanosim
test bed, with a fake OpenRouter that proposes as a model would. Run with: mise run e2e

The switch that lets it propose is off unless ticked, and the tools are offered only then. A change, a new note and a
move are each shown as a card and write nothing; one accepted is in the file with the model named in the stamp, one
rejected is not; the answer stays in view as the map reads the notes again. A kept question opened later still
offers what was not settled, and a change already made is refused, not made twice. Last, a note is marked as checked
(T105) from the Review page and from its own page.
"""
import json, os, socket, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-propose-"))
ROOT = TMP / "nanosim"
subprocess.run([sys.executable, str(REPO / "bench/nanosim.py"), str(ROOT)], check=True, stdout=subprocess.DEVNULL)
QUOTE = "It biases forces below ε and bounds the step-size needed for close passes."
REQS = []
class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        REQS.append(body)
        done = sum(1 for m in body["messages"] if m["role"] == "assistant")
        turns = [[("read_note", {"id": "/concepts/softening.md"})],
                 [("propose_change", {"id": "concepts/softening", "old": QUOTE, "new": QUOTE + " The cost is a force that is wrong at short range."}),
                  ("propose_note", {"id": "decisions/softening-length", "type": "Decision", "title": "Choosing the softening length", "description": "How ε is chosen.", "tags": ["gravity"],
                                    "body": "# Decision\n\nε is a fraction of the mean spacing. See [Gravitational softening](/concepts/softening.md).\n\n# Why\n\nSmaller values need smaller steps."}),
                  ("propose_move", {"from": "design/forces", "to": "design/force-model"}),
                  ("propose_note", {"id": "concepts/softening", "type": "X", "title": "T", "description": "D", "body": "B"})],
                 "<answer>\nI propose three things: a sentence on the cost, a decision note, and a clearer name.\n</answer>\n<used>\n- /concepts/softening.md | | \"" + QUOTE + "\"\n</used>"]
        if "no changes" in json.dumps(body["messages"][-1]) and done == 0: turns = ["<answer>\nNothing to change.\n</answer>"]
        turn = turns[min(done, len(turns) - 1)]
        self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.end_headers()
        if isinstance(turn, list):
            for k, (name, args) in enumerate(turn):
                self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'tool_calls': [{'index': k, 'id': f'call_{done}_{k}', 'function': {'name': name, 'arguments': json.dumps(args)}}]}}]})}\n\n".encode())
        else:
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': turn}}]})}\n\n".encode())
        self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 900, 'completion_tokens': 30, 'cost': 0.0011}})}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
fake = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
threading.Thread(target=fake.serve_forever, daemon=True).start()
ENV = {**os.environ, "RDSTUDIO_OPENROUTER_URL": f"http://127.0.0.1:{fake.server_address[1]}", "OPENROUTER_API_KEY": "sk-or-v1-fake0123456789",
       "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
(TMP / "config/rdstudio").mkdir(parents=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:e2e"\n')
with socket.socket() as s:
    s.bind(("127.0.0.1", 0)); PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
srv = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(200):
    try: socket.create_connection(("127.0.0.1", PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
K = ROOT / "knowledge"
ok = True
def check(what, cond, got=""):
    global ok
    print(("ok   " if cond else "FAIL ") + what + (f"  [{got}]" if not cond else "")); ok = ok and bool(cond)
errors = []
def ask(p, panel, text):
    expect(panel.get_by_role("button", name="Ask", exact=True)).to_be_visible(timeout=15000)  # not while an answer is being written
    p.wait_for_timeout(300)
    panel.locator(".cm-content").click(); p.keyboard.press("Control+A"); p.keyboard.press("Delete"); p.keyboard.type(text); p.keyboard.press("Control+Enter")
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(); p = b.new_page(viewport={"width": 1440, "height": 900})
        p.on("pageerror", lambda e: errors.append(str(e))); p.on("console", lambda m: m.type == "error" and errors.append(m.text))
        p.goto(URL + "?nosw#/map")
        panel = p.locator(".axis-panel"); tab = panel.get_by_role("button", name="Axis", exact=True)
        expect(tab).to_be_visible(timeout=20000)
        if tab.get_attribute("aria-expanded") != "true": tab.click()
        box = panel.get_by_label("May propose changes")
        expect(box).to_be_visible()
        check("the switch is there, and off", not box.is_checked())
        ask(p, panel, "no changes: which softening is used?")
        expect(panel.locator(".aq-text")).to_contain_text("Nothing to change", timeout=15000)
        names = [t["function"]["name"] for t in REQS[0].get("tools", [])]
        check("not let: the proposing tools are not offered", "propose_note" not in names and "read_note" in names, names)
        check("no proposals are shown", panel.locator(".aq-prop").count() == 0)
        panel.get_by_role("button", name="Questions").click()
        box.check(); n = len(REQS)
        ask(p, panel, "Say what softening costs, record how its length is chosen, and give Forces a clearer name.")
        expect(panel.locator(".aq-prop")).to_have_count(3, timeout=15000)
        names = [t["function"]["name"] for t in REQS[n].get("tools", [])]
        check("let: the proposing tools are offered", {"propose_note", "propose_change", "propose_move"} <= set(names), names)
        check("the model is told that proposing writes nothing", "Proposing writes nothing" in json.dumps(REQS[n]["messages"]))
        check("asking wrote nothing", not (K / "decisions/softening-length.md").exists() and "wrong at short range" not in (K / "concepts/softening.md").read_text() and (K / "design/forces.md").exists())
        cards = panel.locator(".aq-prop")
        flat = lambda t: " ".join(t.split())
        check("a change shows what goes and what comes", QUOTE in flat(cards.nth(0).locator(".aq-old").inner_text()) and "wrong at short range" in cards.nth(0).locator(".aq-new").inner_text())
        check("a new note shows its place, type and text", "decisions/softening-length" in cards.nth(1).inner_text() and "Decision · gravity" in cards.nth(1).inner_text())
        check("a move shows from and to, and the links it rewrites", "design/forces" in cards.nth(2).inner_text() and "design/force-model" in cards.nth(2).inner_text() and "link" in cards.nth(2).inner_text(), cards.nth(2).inner_text())
        panel.locator(".aq-looked summary").click()
        check("the refused proposal is among the steps, not the cards", "already exists" in panel.locator(".aq-looked").inner_text(), panel.locator(".aq-looked").inner_text())
        p.screenshot(path=str(OUT / "propose-1.png"))
        cards.nth(0).get_by_role("button", name="Accept").click()
        expect(cards.nth(0)).to_contain_text("Changed.", timeout=10000)
        text = (K / "concepts/softening.md").read_text()
        check("accepted: the change is in the file, with the model named", "wrong at short range" in text and " with openrouter/" in text, text[:400])
        expect(panel.locator(".aq-prop")).to_have_count(3)  # the answer is still shown after the notes are read again
        cards.nth(1).get_by_role("button", name="Accept").click()
        expect(cards.nth(1)).to_contain_text("Written.", timeout=10000)
        made = (K / "decisions/softening-length.md").read_text()
        check("accepted: the note is written, typed and stamped", "type: Decision" in made and "title: Choosing the softening length" in made and "with openrouter/" in made and "Smaller values need smaller steps." in made, made[:300])
        cards.nth(2).get_by_role("button", name="Reject").click()
        expect(cards.nth(2)).to_contain_text("Rejected: nothing was written.")
        check("rejected: the note is where it was", (K / "design/forces.md").exists() and not (K / "design/force-model.md").exists())
        expect(panel.locator(".aq-also").first).to_contain_text("All settled.")
        p.wait_for_timeout(2500)
        check("the answer is still shown after the map has read the notes again", panel.locator(".aq-prop").count() == 3)
        check("the new note is on the map", p.locator('.gn[aria-label="Choosing the softening length"]').count() > 0)
        p.screenshot(path=str(OUT / "propose-2.png"))
        # Kept: opened again, the proposals are there, and one already made is refused with why.
        panel.get_by_role("button", name="Questions").click()
        panel.locator(".aq-ask").first.click()
        expect(panel.locator(".aq-prop")).to_have_count(3, timeout=15000)
        panel.locator(".aq-prop").nth(0).get_by_role("button", name="Accept").click()
        expect(panel.locator(".aq-prop").nth(0).locator(".aq-error")).to_contain_text("already made", timeout=10000)
        panel.locator(".aq-prop").nth(2).get_by_role("button", name="Accept").click()
        expect(panel.locator(".aq-prop").nth(2)).to_contain_text("Moved.", timeout=10000)
        left = [str(f) for f in K.rglob("*.md") if f.name != "index.md" and "/design/forces.md" in f.read_text()]
        check("a move accepted later: moved, and links rewritten", (K / "design/force-model.md").exists() and not (K / "design/forces.md").exists() and not left, left)
        lint = subprocess.run(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "check"], capture_output=True, text=True, env=ENV).stdout.strip()
        check("the base still checks clean", " 0 errors" in lint, lint)
        p.screenshot(path=str(OUT / "propose-3.png"))
        # Marking a note as checked, from the app (T105): on the Review page, and on the note's own page.
        import re
        p.goto(URL + "?nosw#/review")
        marks = p.get_by_role("button", name=re.compile(r"^Mark .* as checked$"))
        expect(marks.first).to_be_visible(timeout=15000)
        n = marks.count()
        which = marks.first.get_attribute("aria-label")[5:-11]
        marks.first.click()
        expect(marks).to_have_count(n - 1, timeout=10000)
        files = [f for f in K.rglob("*.md") if f"title: {which}" in f.read_text() or f'title: "{which}"' in f.read_text()]
        check("checked on the Review page: it leaves the list, and the file says who checked it", len(files) == 1 and "- by: human:" in files[0].read_text().split("verified:", 1)[-1], which)
        p.goto(URL + "?nosw#/k/design/integrators")
        mark = p.get_by_role("button", name="Mark as checked", exact=True)
        expect(mark).to_be_visible(timeout=15000)
        mark.click()
        expect(p.locator(".meta.companion")).to_contain_text("Reviewed by a person.", timeout=10000)
        expect(mark).to_have_count(0)
        check("checked on the note's page: it says a person reviewed it, and the button goes", "- by: human:" in (K / "design/integrators.md").read_text().split("verified:", 1)[-1])
        # The one refusal above is logged by the browser as a failed request; nothing else is.
        check("no page errors", [e for e in errors if "400" not in e] == [] and len(errors) <= 1, errors)
        b.close()
finally:
    srv.terminate()
sys.exit(0 if ok else 1)
