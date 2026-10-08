"""End to end: Axis beside a note being edited (T74, T96, T97, T98), in headless
Chromium, on a fresh copy of the nanosim test bed, with a fake OpenRouter in
place of the model. Run with: mise run e2e

While a note is edited, Axis is in a panel to the right of the note or below
it, which folds and is resized by a drag; the note's details are in a
dropdown under its title. A chat there: a question about a marked passage (an
answer, nothing changed); a follow-up that may change the passage (a
suggestion, rejected); text for a place set apart from the passage
(accepted, saved, the stamp names the model); changes anywhere in the note,
several at once; what each turn cost, in view; chats kept, opened again, gone
on from and deleted; a figure; and the same on a phone.
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
            html = spins if "spin" in want else good if "is not good enough to offer" in want else wrong
            reply = f"<title>Softened gravity</title>\n<caption>Move the slider to change the softening.</caption>\n<artifact>\n{html}\n</artifact>\n<why>\nDrawn from the formula in the note.\n</why>"
        elif "minimum_image" in want:
            reply = f"<answer>\nThe declaration of `minimum_image`, copied from the header.\n</answer>\n<insert>\nFrom `src/nanosim/core/vec3.hpp`:\n\n{CODE}\n</insert>"
        elif "Make it shorter" in want:
            reply = "<answer>\nShorter, and says the same.\n</answer>\n<passage>\n- **Lennard-Jones**: cut at 2.5σ.\n</passage>"
        elif "Tidy the note" in want:
            # Three changes, chosen by itself: a phrase reworded, text added after a line, and one that is not in the note.
            reply = ("<answer>\nGravity's cost is spelled out, and a line on units added.\n</answer>\n"
                     "<change>\n<old>\nO(N²)\n</old>\n<new>\nquadratic in the number of particles\n</new>\n</change>\n"
                     "<change>\n<old>\n[cell list](/design/cell-lists.md \"requires\").\n</old>\n<new>\n[cell list](/design/cell-lists.md \"requires\").\n- **Units**: reduced units throughout.\n</new>\n</change>\n"
                     "<change>\n<old>\nA line that is not there.\n</old>\n<new>\nx\n</new>\n</change>")
        elif "Why is this so?" in want:
            # It also tries to rewrite the passage, which it was not let do.
            reply = "<answer>\nIt is **softened** so that close pairs do not blow up. See [The particle system](/design/particle-system.md).\n</answer>\n<passage>\nRewritten without leave.\n</passage>"
        else:
            reply = "<answer>\nIn short: yes.\n</answer>"
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i in range(0, len(reply), 9):
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': reply[i:i + 9]}}]})}\n\n".encode())
            self.wfile.flush()
        self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 2000, 'completion_tokens': 60, 'cost': 0.0031, 'prompt_tokens_details': {'cached_tokens': 800}}})}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
fake = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenRouter)
threading.Thread(target=fake.serve_forever, daemon=True).start()

ENV = {**os.environ, "RDSTUDIO_OPENROUTER_URL": f"http://127.0.0.1:{fake.server_address[1]}", "OPENROUTER_API_KEY": "sk-or-v1-fake0123456789",
       "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
# The learner record is on, so that chats are kept (T97).
(TMP / "config/rdstudio").mkdir(parents=True, exist_ok=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:e2e"\n')
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
CHATS = TMP / "data/rdstudio/learners"
def kept_chats():
    return sorted(CHATS.glob("*/assist/chats/*.json"))
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 900})
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    before = NOTE.read_text()

    p.goto(URL + "?nosw#/k/design/forces")
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    axis = p.locator(".note-axis")
    doc = p.locator("article.doc.editing")
    note = doc.locator(".editor .cm-content")
    button = p.locator(".edit-bar").get_by_role("button", name="Axis")
    expect(button).to_be_visible()

    # ------------------------------------------------- the layout (T96)
    check("the note's title heads the page, with its details in a dropdown under it, closed, and no details column beside the note",
          doc.locator(".edit-head h1").inner_text() == "Forces" and p.locator("details#edit-details").get_attribute("open") is None and p.locator("aside.meta").count() == 0 and not p.get_by_label("Description").is_visible())
    p.locator("#edit-details summary").click()
    check("…opened, the dropdown holds the title, description, type, tags and status", all(p.locator("#edit-details").get_by_label(l).is_visible() for l in ["Title", "Description", "Type", "Tags", "Status"]))
    p.locator("#edit-details").get_by_label("Title", exact=True).fill("Forces, in brief")
    check("…and a title changed there is the heading's, and an unsaved change", doc.locator(".edit-head h1").inner_text() == "Forces, in brief" and p.locator(".edit-status").inner_text() == "Unsaved changes")
    p.locator("#edit-details").get_by_label("Title", exact=True).fill("Forces")
    p.locator("#edit-details summary").click()
    check("Axis is folded until asked for: a button on the editing bar, and no bar to ask from over the note", button.get_attribute("aria-expanded") == "false" and not axis.is_visible() and p.locator(".assist-bar").count() == 0)
    button.click()
    expect(axis).to_be_visible()
    a, d = axis.bounding_box(), doc.bounding_box()
    check("opened on a wide screen, the panel is to the right of the note, the full height of the window under the bar",
          abs(a["x"] - (d["x"] + d["width"])) < 2 and abs(a["x"] + a["width"] - 1280) < 2 and a["width"] == 400 and abs(a["y"] + a["height"] - 900) < 2, (a, d))
    ask_form = axis.locator("form.note-ask")
    q = ask_form.locator(".cm-content")
    expect(q).to_be_visible()
    go = ask_form.get_by_role("button", name="Ask")
    check("…with the place to ask at its foot: an editor like the note's, and nothing to send yet", go.is_disabled() and ask_form.get_by_role("button", name="Figure").is_disabled() and a["y"] + a["height"] - (ask_form.bounding_box()["y"] + ask_form.bounding_box()["height"]) < 2)
    grip = axis.locator(".axis-grip").bounding_box()
    p.mouse.move(grip["x"] + grip["width"] / 2, 400); p.mouse.down(); p.mouse.move(grip["x"] + grip["width"] / 2 - 120, 400, steps=4); p.mouse.up()
    wide = axis.bounding_box()["width"]
    check("dragging its edge resizes it, and the note takes what is left", abs(wide - 520) < 4 and abs(doc.bounding_box()["width"] - (d["width"] - (wide - 400))) < 4, wide)
    p.screenshot(path=str(OUT / "assist-panel.png"))
    # Source view, so that offsets on screen are the text's.
    p.get_by_role("button", name="Source").click()

    # ------------------------------------------------- a question about a marked passage
    first = doc.locator(".cm-line", has_text=re.compile(r"\w{4,}")).nth(1)
    first.click(click_count=3)
    chip = ask_form.locator(".nx-chip").first
    expect(chip).to_contain_text("Lennard-Jones")
    check("text selected in the note is marked as what the question is about, in the note and in the panel", doc.locator(".cm-axis-passage").count() >= 1 and not ask_form.get_by_label("Axis may change it").is_checked())
    q.click()
    p.keyboard.type("Why is this so? Is $r^2$ right?")
    p.keyboard.press("Enter")
    p.keyboard.type("Say briefly.")
    expect(q.locator(".cm-lp-imaths .katex")).to_have_count(1)
    check("the question is written as a note is: its maths is typeset as it is typed", True)
    check("…and with the cursor in the question, the passage is still marked in the note", doc.locator(".cm-axis-passage").count() >= 1)
    p.keyboard.press("Control+Enter")
    turn = axis.locator(".nx-turn").first
    expect(turn.locator(".aq-text")).to_contain_text("softened", timeout=15000)
    quote = turn.locator("blockquote.aq-question")
    check("Ask: the question is a quotation, with its maths, and says which passage it was about", quote.locator(".katex").count() >= 1 and "Lennard-Jones" in quote.locator(".nx-about").inner_text() and axis.locator("h1, h2, h3").count() == 0, quote.inner_text())
    check("…the answer is beside the note, with a link to a note", turn.locator(".aq-text a", has_text="The particle system").count() == 1)
    check("…what it drew on is what it opened itself: the one note it read", turn.locator(".aq-also a").all_inner_texts() == ["The particle system"], turn.inner_text())
    turn.locator(".aq-looked summary").click()
    steps = turn.locator(".aq-looked li").all_inner_texts()
    check("…what it looked up is listed in order: a search, then a note read", len(steps) == 2 and steps[0].startswith('Searched the notes for "softened gravity close pairs"') and steps[1].startswith("Read The particle system"), steps)
    said = sent(FAKE_REQUESTS[-1])
    start = sent(FAKE_REQUESTS[-2])
    check("…the model was given the note with the passage marked and how to look things up, and told it may change nothing",
          "⟦" in start and "⟧" in start and "⟦HERE⟧" not in start.split("## The note being written")[-1] and "## Looking things up" in start and "Why is this so?" in start and "You may not change the note in this turn" in start, start[-700:])
    check("…its lookups were run and answered: the search's finds and the note's text went back to it", [m["role"] for m in FAKE_REQUESTS[-1]["messages"]][-3:] == ["assistant", "tool", "tool"] and "/design/particle-system.md" in said, said[-600:])
    check("…it tried to rewrite the passage all the same: that is not offered, and it is said", "which it was not let change" in turn.inner_text() and doc.locator(".cm-suggest").count() == 0 and p.locator(".edit-status").inner_text() == "No changes", turn.inner_text())
    cost = axis.locator("details.axis-cost")
    summary = cost.locator("summary").inner_text()
    check("what it cost is below the chat, outside what scrolls: the price, the tokens in and out, the tier and the model",
          "0.42¢" in summary and "2,900 in · 90 out" in summary and "mid · anthropic/claude-sonnet-5.5" in summary and cost.evaluate("e => !e.closest('.axis-body')"), summary)
    cost.locator("summary").click()
    rows = dict(zip(cost.locator("dt").all_inner_texts(), cost.locator("dd").all_inner_texts()))
    check("…opened, it says how that came about: tokens sent and read from the cache, calls, searches, notes read, and the chat so far",
          rows.get("Sent to the model") == "2,900 tokens, 800 of them read from its cache" and rows.get("Calls to the model") == "2" and rows.get("Searches of words") == "1" and rows.get("Notes read") == "1" and rows.get("This chat so far") == "0.42¢ over 1 turn", rows)
    cost.locator("summary").click()
    check("…asked at the usual tier for a chat, mid", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-sonnet-5.5", FAKE_REQUESTS[-1]["model"])
    check("the passage's mark is taken away once the turn is answered", doc.locator(".cm-axis-passage").count() == 0 and ask_form.locator(".nx-chip").count() == 0)
    kept = kept_chats()
    check("the chat is kept in the learner record, not in the repository", len(kept) == 1 and json.loads(kept[0].read_text())["note"] == "design/forces" and not list(ROOT.rglob("chats")), kept)
    p.screenshot(path=str(OUT / "assist-ask.png"))

    # ------------------------------------------------- a follow-up that may change the passage
    pick = ask_form.get_by_label("How strong a model to ask")
    check("the panel offers how strong a model to ask: the usual, or low, mid or max, each naming its model",
          [o.strip() for o in pick.locator("option").all_inner_texts()] == ["Usual", "Low · claude-haiku-4.5", "Mid · claude-sonnet-5.5", "Max · claude-opus-5.5"], pick.locator("option").all_inner_texts())
    pick.select_option("low")
    first.click(click_count=3)
    old = p.evaluate("getSelection().toString()").strip()
    ask_form.get_by_label("Axis may change it").check()
    q.click()
    p.keyboard.type("Make it shorter.")
    go.click()
    sg = doc.locator(".cm-suggest")
    expect(sg).to_contain_text("cut at 2.5σ", timeout=15000)
    roles = [m["role"] for m in FAKE_REQUESTS[-1]["messages"]]
    again = sent(FAKE_REQUESTS[-1])
    check("a follow-up goes on from the turns before: the earlier question and answer are sent, then the note as it is now",
          roles == ["system", "user", "assistant", "user"] and "Why is this so?" in FAKE_REQUESTS[-1]["messages"][1]["content"] and "close pairs do not blow up" in FAKE_REQUESTS[-1]["messages"][2]["content"] and "Their next question" in again, roles)
    check("…let change the passage, it is told the form for that and no other", "<passage>" in again and "<change>" not in again and "<insert>" not in again)
    check("the proposed text is a suggestion in the note: the passage struck through, the new text beside it", doc.locator(".cm-suggest-old").count() >= 1 and sg.get_by_role("button", name="Accept").count() == 1)
    two = axis.locator(".nx-turn").nth(1)
    edit = two.locator(".nx-edits li")
    check("…and is listed in the panel as a change to that line, to accept or reject there too", edit.count() == 1 and edit.locator(".nx-kind").inner_text().startswith("Replace · line") and "Lennard-Jones" in edit.locator("del").inner_text() and "cut at 2.5σ" in edit.locator("ins").inner_text() and edit.get_by_role("button", name="Accept").count() == 1, two.inner_text())
    p.screenshot(path=str(OUT / "assist-rewrite.png"))
    check("…asked at Low, it went to the low tier's model, which the cost names", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-haiku-4.5" and p.evaluate("localStorage.getItem('rdstudio.assist.tier')") == "low" and "low · anthropic/claude-haiku-4.5" in cost.locator("summary").inner_text(), cost.locator("summary").inner_text())
    pick.select_option("")
    edit.get_by_role("button", name="Reject").click()
    check("Reject, from the panel: the suggestion goes, the note is as it was, and the panel says so", doc.locator(".cm-suggest").count() == 0 and p.locator(".edit-status").inner_text() == "No changes" and old[:20] in note.inner_text() and "Rejected" in edit.inner_text(), edit.inner_text())

    # ------------------------------------------------- a place for new text, apart from the passage
    first.click(click_count=3)
    doc.locator(".cm-line").last.click()
    p.keyboard.press("Control+End")
    check("the passage stays marked when the cursor moves on", doc.locator(".cm-axis-passage").count() >= 1 and "Lennard-Jones" in ask_form.locator(".nx-chip").first.inner_text())
    ask_form.get_by_role("button", name="Put new text at the cursor").click()
    here = ask_form.locator(".nx-chip.here")
    expect(here).to_contain_text("New text at line")
    check("a place for new text is set at the cursor, apart from the passage, and shown in the note", doc.locator(".cm-axis-here").count() == 1 and doc.locator(".cm-axis-passage").count() >= 1)
    p.screenshot(path=str(OUT / "assist-places.png"))
    q.click()
    p.keyboard.type("Insert the declaration of `minimum_image` here.")
    p.keyboard.press("Control+Enter")
    expect(sg).to_contain_text("minimum_image(Vec3 d, double box)", timeout=15000)
    said = sent(FAKE_REQUESTS[-1])
    written = said.split("## The note being written")[-1].split("## What to do")[0]
    tools = [m["content"] for m in FAKE_REQUESTS[-1]["messages"] if m["role"] == "tool"]
    check("the model was given both: the passage between its marks, and the place (⟦HERE⟧) at the end of the note",
          written.count("⟦HERE⟧") == 1 and written.index("⟦- **Lennard") < written.index("⟧") < written.index("⟦HERE⟧") and written.rstrip().endswith("⟦HERE⟧"), written)
    check("…told that the passage is to be read and not changed, and the one form it may use", "is there to be read: do not change it" in said and "<insert>" in said and "<passage>" not in said and "<change>" not in said)
    check("…and found the code named for itself in the repository", len(tools) == 2 and "vec3.hpp" in tools[0] and "minimum_image" in tools[1], tools)
    three = axis.locator(".nx-turn").nth(2)
    check("the turn says where the text was for, why it was written, and the file it drew on",
          "new text at line" in three.locator("blockquote").inner_text().lower() and "copied from the header" in three.inner_text() and "vec3.hpp" in three.locator(".aq-also", has_text="Drew on").inner_text() and three.locator(".nx-kind").inner_text().startswith("Add · line"), three.inner_text())
    check("…the suggestion is at the place set, not at the passage, which is untouched", doc.locator(".cm-suggest-old").count() == 0 and old[:20] in note.inner_text())
    p.screenshot(path=str(OUT / "assist-write.png"))
    note.click()
    p.keyboard.press("Control+Enter")
    check("Accept (Ctrl+Enter in the note): the text is in the note, which now has unsaved changes, and the panel says it was accepted",
          doc.locator(".cm-suggest").count() == 0 and "minimum_image(Vec3 d, double box)" in note.inner_text() and p.locator(".edit-status").inner_text() == "Unsaved changes" and "Accepted" in three.locator(".nx-edits").inner_text())
    check("…and nothing was written until it is saved", NOTE.read_text() == before)
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_have_text("Saved")
    after = NOTE.read_text()
    check("Saved: the note holds the text, and its stamp names the model beside the person", "minimum_image(Vec3 d, double box)" in after and re.search(r"by: .*human:\S+ with openrouter/", after) is not None, after[:400])

    # ------------------------------------------------- changes anywhere in the note, chosen by the model (T98)
    ask_form.get_by_label("Axis may edit anywhere in the note").check()
    q.click()
    p.keyboard.type("Tidy the note.")
    go.click()
    expect(sg).to_have_count(2, timeout=15000)
    said = sent(FAKE_REQUESTS[-1])
    check("let edit anywhere, it is given the whole note with nothing marked, and the form for changes of its own choosing", "<change>" in said and "Choose the places yourself" in said and "⟦" not in said.split("## The note being written")[-1].split("## What to do")[0])
    four = axis.locator(".nx-turn").nth(3)
    kinds = four.locator(".nx-kind").all_inner_texts()
    check("it proposed changes in two places of its choosing, each a suggestion in the note and a row in the panel", four.locator("h4").first.inner_text() == "Proposed changes (2)" and len(kinds) == 2 and all(k.startswith("Replace · line") for k in kinds) and doc.locator(".cm-suggest-old").count() >= 2, four.inner_text())
    check("…and one that names text not in the note is not offered, and why is said", "“A line that is not there.” is not in the note" in four.inner_text())
    p.screenshot(path=str(OUT / "assist-edits.png"))
    four.get_by_role("button", name="Accept all").click()
    text = note.inner_text()
    check("Accept all: every change is in the note at once", doc.locator(".cm-suggest").count() == 0 and "quadratic in the number of particles" in text and "O(N²)" not in text and "**Units**: reduced units throughout." in text and four.locator(".nx-said").all_inner_texts() == ["Accepted", "Accepted"], text)
    p.keyboard.press("Control+z") if False else None
    rows = {}
    cost.locator("summary").click()
    rows = dict(zip(cost.locator("dt").all_inner_texts(), cost.locator("dd").all_inner_texts()))
    cost.locator("summary").click()
    check("the cost below is the last turn's, with the chat's total over its four turns", rows.get("Calls to the model") == "1" and rows.get("This chat so far", "").endswith("over 4 turns"), rows)
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_have_text("Saved")

    # ------------------------------------------------- chats kept, opened again, gone on from, and deleted (T97)
    one = json.loads(kept_chats()[0].read_text())
    check("the chat's four turns are in one file in the record, each with what was marked, what it was let change, the changes and the cost",
          len(kept_chats()) == 1 and len(one["turns"]) == 4 and one["turns"][1]["may"] == {"passage": True, "note": False} and one["turns"][1]["edits"][0]["new"] == "- **Lennard-Jones**: cut at 2.5σ."
          and one["turns"][2]["here"]["line"] >= 3 and one["turns"][3]["may"]["note"] is True and len(one["turns"][3]["edits"]) == 2 and one["turns"][0]["spent"]["calls"] == 2, one["turns"][1])
    axis.get_by_role("button", name="Chats").click()
    listed = axis.locator(".aq-asked li")
    expect(listed).to_have_count(1)
    check("Chats: the chats about this note are listed, each by its first question (maths typeset), its turns and its cost", listed.locator(".katex").count() >= 1 and "4 turns" in listed.inner_text() and "$0.01" in listed.inner_text(), listed.inner_text())
    check("…and the place to ask is still there, for a new chat", q.is_visible() and not cost.is_visible())
    q.click()
    p.keyboard.type("A new chat?")
    p.keyboard.press("Control+Enter")
    expect(axis.locator(".nx-turn .aq-text")).to_contain_text("In short: yes.", timeout=15000)
    expect(go).to_be_visible()  # "Ask" again, not "Stop": the turn is whole, and kept
    check("a question asked from the list starts a new chat, sent with no earlier turns", [m["role"] for m in FAKE_REQUESTS[-1]["messages"]] == ["system", "user"] and len(kept_chats()) == 2)
    axis.get_by_role("button", name="Chats").click()
    expect(listed).to_have_count(2)
    check("…listed first, as the one last added to", "A new chat?" in listed.first.inner_text() and "1 turn" in listed.first.inner_text())
    p.reload()
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    expect(axis).to_be_visible()
    check("after a reload the panel is open as it was left, and as wide", abs(axis.bounding_box()["width"] - 520) < 4)
    expect(listed).to_have_count(2)
    listed.nth(1).locator(".aq-ask").click()
    expect(axis.locator(".nx-turn")).to_have_count(4)
    old_turn = axis.locator(".nx-turn").nth(1)
    check("an earlier chat opens with its turns as they were: when each was asked, the answer, and the changes proposed, to read",
          old_turn.locator(".aq-label").inner_text().upper().startswith("ASKED ") and "cut at 2.5σ" in old_turn.locator("ins").inner_text() and old_turn.get_by_role("button", name="Accept").count() == 0 and "0.31¢" in cost.locator("summary").inner_text(), old_turn.inner_text())
    p.screenshot(path=str(OUT / "assist-kept.png"))
    q.click()
    p.keyboard.type("And is that all?")
    p.keyboard.press("Control+Enter")
    expect(axis.locator(".nx-turn").nth(4).locator(".aq-text")).to_contain_text("In short: yes.", timeout=15000)
    expect(ask_form.get_by_role("button", name="Ask")).to_be_visible()
    roles = [m["role"] for m in FAKE_REQUESTS[-1]["messages"]]
    check("a question asked there goes on from it: its four turns are sent first, and the answer is added to the same chat in the record",
          roles == ["system"] + ["user", "assistant"] * 4 + ["user"] and len(kept_chats()) == 2 and len(json.loads(kept_chats()[0].read_text())["turns"]) == 5, roles)
    axis.get_by_role("button", name="Chats").click()
    expect(listed).to_have_count(2)
    p.once("dialog", lambda d: d.dismiss())
    listed.first.locator(".aq-drop").click()
    time.sleep(0.3)
    check("deleting a chat asks first; refused, nothing is deleted", listed.count() == 2 and len(kept_chats()) == 2)
    gone = listed.first.inner_text()
    p.once("dialog", lambda d: d.accept())
    listed.first.locator(".aq-drop").click()
    expect(listed).to_have_count(1)
    check("…accepted, the chat is gone from the list and from the record", gone not in axis.inner_text() and len(kept_chats()) == 1)

    # ------------------------------------------------- a figure (T78)
    # Written, checked out of sight, put right once, shown, and saved only when accepted.
    p.get_by_role("button", name="Source").click() if p.get_by_role("button", name="Source").get_attribute("aria-pressed") != "true" else None
    before_n = len(FAKE_REQUESTS)
    first = doc.locator(".cm-line", has_text=re.compile(r"Gravity")).first
    first.click(click_count=3)
    ask_form.get_by_role("button", name="Figure").click()
    fig = axis.locator(".assist-figure iframe")
    expect(fig).to_be_visible(timeout=40000)
    card = axis.locator(".nx-figure")
    asked = [sent(r) for r in FAKE_REQUESTS[before_n:]]
    check("Figure: the first try raised an error when loaded out of sight, so it went back to the model with what was wrong",
          len(asked) == 2 and "undefinedHelper" in asked[1].split("## What to do")[-1] and "The artifact you wrote before" in asked[1], [a[-300:] for a in asked])
    check("…the one put right is shown in the panel, checked, with nothing saved yet", "Checked: it loads without error" in card.inner_text() and not (ROOT / "knowledge/design/softened-gravity.html").exists())
    inner = next(f for f in p.frames if "/p/" in f.url)
    inner.locator("#e").fill("7")
    check("…and it works in the preview: the slider redraws it", inner.evaluate("window.__drawn") == 7)
    p.screenshot(path=str(OUT / "assist-figure.png"))
    card.get_by_role("button", name="Put it in the note").click()
    expect(card).to_contain_text("Saved as design/softened-gravity.html", timeout=15000)
    made = (ROOT / "knowledge/design/softened-gravity.html").read_text()
    check("Put it in the note: the file is written beside the note, stamped with the model and the date",
          "<canvas" in made and 'rdstudio:author" content="openrouter/' in made and 'rdstudio:date"' in made, made[:300])
    p.get_by_role("button", name="Source").click()  # back to the live preview
    expect(doc.locator(".cm-lp-figure iframe")).to_have_count(1, timeout=15000)
    check("…and its embed is in the note below the passage, shown in the preview", True)
    p.get_by_role("button", name="Source").click()
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_have_text("Saved")
    check("…saved with the note", "(softened-gravity.html)" in NOTE.read_text())

    # One that cannot be put right is not offered.
    doc.locator(".cm-line", has_text=re.compile(r"Lennard")).first.click(click_count=3)
    q.click()
    p.keyboard.type("Make it spin.")
    before_n = len(FAKE_REQUESTS)
    ask_form.get_by_role("button", name="Figure").click()
    expect(axis).to_contain_text("not good enough to offer", timeout=60000)
    check("a figure that keeps animating while untouched is sent back twice, then not offered, and why is said",
          len(FAKE_REQUESTS) - before_n == 3 and "kept animating" in axis.inner_text() and axis.locator(".assist-figure").count() == 0 and not (ROOT / "knowledge/design/softened-gravity-2.html").exists(), axis.inner_text())
    check("…a figure is asked at max unless told otherwise", FAKE_REQUESTS[-1]["model"] == "anthropic/claude-opus-5.5", FAKE_REQUESTS[-1]["model"])

    # ------------------------------------------------- folded again; and the Station theme
    axis.get_by_role("button", name="Axis").click()
    check("the panel's own Axis button folds it away: the note has the width again, and nothing is marked for it", not axis.is_visible() and button.get_attribute("aria-expanded") == "false" and abs(doc.bounding_box()["width"] - (d["width"] + 400)) < 2 and doc.locator(".cm-axis-passage").count() == 0, doc.bounding_box())
    button.click()
    p.evaluate("() => { document.documentElement.dataset.theme = 'station'; }")
    time.sleep(0.3)
    sb = axis.bounding_box()
    check("in the Station theme the panel stops above the status line", abs(sb["y"] + sb["height"] - (900 - 30)) < 2, sb)
    p.screenshot(path=str(OUT / "assist-station.png"))
    p.evaluate("() => { delete document.documentElement.dataset.theme; }")

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

    # ------------------------------------------------- a phone, upright: the panel is below the note
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m = ctx.new_page()
    m.on("pageerror", lambda e: errors.append(str(e)))
    m.goto(URL + "?nosw#/k/design/forces")
    m.get_by_role("button", name="Edit").tap()
    m.wait_for_selector(".cm-content")
    maxis = m.locator(".note-axis")
    mbutton = m.locator(".edit-bar").get_by_role("button", name="Axis")
    expect(mbutton).to_be_visible()
    check("phone: Axis is folded, a button on the editing bar, and the details are the dropdown under the title", not maxis.is_visible() and m.locator("#edit-details summary").is_visible() and m.get_by_role("button", name="Details").count() == 0)
    mbutton.tap()
    expect(maxis).to_be_visible()
    time.sleep(0.3)
    mb, fb = maxis.bounding_box(), m.get_by_role("toolbar", name="Formatting").bounding_box()
    check("phone: opened, the panel is below the note, across the screen, above the formatting bar",
          mb["x"] == 0 and mb["width"] == 390 and mb["y"] > 250 and mb["y"] + mb["height"] <= fb["y"] + 4 and m.evaluate("document.documentElement.scrollWidth") <= 390, (mb, fb))
    m.locator("form.note-ask .cm-content").tap()
    m.keyboard.type("Is this right?")
    m.locator("form.note-ask").get_by_role("button", name="Ask").tap()
    expect(maxis.locator(".nx-turn .aq-text")).to_contain_text("In short: yes.", timeout=15000)
    cb = maxis.locator("details.axis-cost").bounding_box()
    check("phone: the answer is in the panel, with what it cost in view under it", cb is not None and cb["y"] + cb["height"] <= mb["y"] + mb["height"] and cb["y"] > mb["y"], cb)
    m.screenshot(path=str(OUT / "assist-phone.png"))
    ctx.close()

    # No account: the panel says how to connect one.
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
    p.locator(".edit-bar").get_by_role("button", name="Axis").click()
    off = p.locator(".note-axis .aq-also a")
    expect(off).to_be_visible()
    check("with no model account, the panel says how to connect one and offers nothing to ask", p.locator("form.note-ask").count() == 0 and off.get_attribute("href") == "#/teacher")
    browser.close()

own = [e for e in errors if "undefinedHelper" not in e and "400 (Bad Request)" not in e]  # the refused model id is a 400  # the first figure's own error, inside the frame it was checked in
check("no errors in the browser console", not own, own[:5])
server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
