"""End to end: Ask Atlas (T85) in the Axis panel (T93), with the questions kept (T94), in headless Chromium, on a fresh copy of the
nanosim test bed, with a fake OpenRouter that looks things up as a model would.
Run with: mise run e2e

A question asked on the map is answered beside it; the notes the answer rests
on are marked on the map, each with a passage beside it; the links followed
from one note to the next are drawn; and how each note was reached shows. The
panel is beside the map or below it, folds and resizes; a question is kept and
played again, unless the notes it used have gone.
"""
import json, os, shutil, socket, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-ask-"))
ROOT = TMP / "nanosim"
subprocess.run([sys.executable, str(REPO / "bench/nanosim.py"), str(ROOT)], check=True, stdout=subprocess.DEVNULL)

QUOTE = "It biases forces below ε and bounds the step-size needed for close passes."
FINAL = ("<answer>\nSo that close encounters stay finite: see [Gravitational softening](/concepts/softening.md). "
         "It is applied to **gravity** over all pairs.\n</answer>\n<used>\n"
         f"- /concepts/softening.md | | \"{QUOTE}\"\n"
         "- /design/forces.md | | \"Gravity is softened because the authors liked it.\"\n"
         "- /design/integrators.md | | \"Never opened.\"\n</used>")
FAKE_REQUESTS = []
class FakeOpenRouter(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FAKE_REQUESTS.append(body)
        said = "\n".join(part["text"] for m in body["messages"] if m["role"] != "tool" for part in (m["content"] if isinstance(m["content"], list) else [{"text": m["content"] or ""}]))
        question = said.split("## Their question")[-1]
        done = sum(1 for m in body["messages"] if m["role"] == "assistant")
        if "in other words" in question:  # found by meaning, where the model for it is installed (T89, T90)
            turns = [[("find_similar", {"text": "how are near collisions between two bodies kept from giving huge forces?"})], [("read_note", {"id": "/concepts/softening.md"})],
                     "<answer>\nBy [Gravitational softening](/concepts/softening.md).\n</answer>"]
        elif "nearest image" in question:  # code, found by what it is for and not by its name (T86)
            turns = [[("search_symbols", {"query": "nearest periodic image displacement"}), ("outline_code", {"path": "src/nanosim/core"})], "<answer>\nIn `minimum_image`.\n</answer>"]
        elif "from here" in question:  # asked from a selected note: one link followed, then the answer
            turns = [[("read_note", {"id": "/concepts/softening.md"})], "<answer>\nOn [Gravitational softening](/concepts/softening.md).\n</answer>"]
        else:
            turns = [[("search_notes", {"query": "softened gravity"})], [("read_note", {"id": "/design/forces.md"})],
                     [("read_note", {"id": "/concepts/softening.md"}), ("outline_note", {"id": "design/cell-lists"}), ("read_code", {"path": "README.md", "from": 1, "to": 5})], FINAL]
        turn = turns[min(done, len(turns) - 1)]
        time.sleep(0.35)  # long enough for each step to be seen arriving
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        if isinstance(turn, list):
            for k, (name, args) in enumerate(turn):
                self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'tool_calls': [{'index': k, 'id': f'call_{done}_{k}', 'function': {'name': name, 'arguments': json.dumps(args)}}]}}]})}\n\n".encode())
        else:
            for i in range(0, len(turn), 16):
                self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': turn[i:i + 16]}}]})}\n\n".encode())
                self.wfile.flush()
                time.sleep(0.01)
        self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 900, 'completion_tokens': 30, 'cost': 0.0011}})}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
fake = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenRouter)
threading.Thread(target=fake.serve_forever, daemon=True).start()

ENV = {**os.environ, "RDSTUDIO_OPENROUTER_URL": f"http://127.0.0.1:{fake.server_address[1]}", "OPENROUTER_API_KEY": "sk-or-v1-fake0123456789",
       "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
# The learner record is on, so that questions are kept (T94).
(TMP / "config/rdstudio").mkdir(parents=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:e2e"\n')
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
def serve(env):
    proc = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for _ in range(200):
        try:
            socket.create_connection(("127.0.0.1", PORT), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return proc
# Search by meaning (T89) is offered where its model is installed; the notes are embedded first, so that it is ready.
MEANING = (REPO / "packages/cli/models/bge-small-en-v1.5/model.onnx").exists()
if MEANING:
    subprocess.run(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "__embed"], env=ENV, check=True, stdout=subprocess.DEVNULL)
server = serve(ENV)
status = lambda: subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout
STATUS = status()

results = []
def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
def sent(body):
    return "\n".join(part["text"] for m in body["messages"] for part in (m["content"] if isinstance(m["content"], list) else [{"text": m["content"] or ""}]))
note = lambda p, title: p.locator(f'.gn[aria-label="{title}"]')

errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1440, "height": 900})
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    p.goto(URL + "?nosw#/map")
    shell, panel, wrap = p.locator(".atlas-shell"), p.locator(".axis-panel"), p.locator(".gridmap-wrap")
    tab = panel.get_by_role("button", name="Axis", exact=True)
    expect(tab).to_be_visible(timeout=15000)
    expect(note(p, "Forces")).to_be_visible()
    whole = shell.bounding_box()
    check("the Axis panel is folded to a button, and the map has the whole frame", "folded" in panel.get_attribute("class") and abs(wrap.bounding_box()["width"] - whole["width"]) < 1 and panel.locator(".atlas-ask:visible").count() == 0)
    tab.click()
    form = panel.locator(".atlas-ask")
    box = form.get_by_role("textbox")
    expect(box).to_be_visible(timeout=15000)
    p.wait_for_timeout(300)
    mb, pb = wrap.bounding_box(), panel.bounding_box()
    check("opened on a wide screen it is to the right of the map, which has the rest and is not covered",
          abs(mb["x"] + mb["width"] - pb["x"]) < 2 and abs(pb["x"] + pb["width"] - (whole["x"] + whole["width"])) < 2 and abs(pb["height"] - whole["height"]) < 2, f"{mb} {pb}")
    where = panel.locator(".axis-where")
    check("it says what a question is about", where.inner_text() == "About this project", where.inner_text())
    # Resized by a drag of its edge; the size is kept.
    grip = panel.locator(".axis-grip").bounding_box()
    p.mouse.move(grip["x"] + grip["width"] / 2, grip["y"] + 200)
    p.mouse.down()
    p.mouse.move(grip["x"] + grip["width"] / 2 - 160, grip["y"] + 210, steps=6)
    p.mouse.up()
    p.wait_for_timeout(300)
    wider = panel.bounding_box()
    check("dragging its edge resizes it, and the map with it", abs(wider["width"] - pb["width"] - 160) < 4 and abs(wrap.bounding_box()["width"] - (mb["width"] - 160)) < 4, f"{pb['width']} -> {wider['width']}")
    p.reload()
    expect(box).to_be_visible(timeout=15000)
    p.wait_for_timeout(300)
    check("open, and the size, are kept on the device", abs(panel.bounding_box()["width"] - wider["width"]) < 2, str(panel.bounding_box()))
    expect(note(p, "Forces")).to_be_visible()
    p.screenshot(path=str(OUT / "ask-box.png"))

    # The question is written as a note is: maths is typeset as it is written.
    box.click()
    p.keyboard.type("Is $x^2$ here?")
    p.keyboard.press("Enter")
    p.keyboard.type("next line")
    expect(form.locator(".cm-lp-imaths .katex")).to_have_count(1)
    check("the question is written in the note editor's live preview: maths is typeset as it is written, and Enter makes a line", "next line" in box.inner_text())
    p.keyboard.press("Control+a")
    p.keyboard.type("Why is gravity softened, given $r^2 + \\epsilon^2$?")
    p.keyboard.press("Control+Enter")
    card = panel.locator(".axis-body")
    expect(card.locator(".aq-steps li", has_text="Searched the notes")).to_be_visible(timeout=15000)
    check("each lookup is listed as it is made, and the notes a search named are marked while it works",
          form.get_by_role("button", name="Stop").count() == 1 and p.locator(".aq-ring.search").count() >= 2, str(p.locator(".aq-ring.search").count()))
    expect(card.locator(".aq-used li")).to_have_count(2, timeout=20000)
    text = card.inner_text()
    quote = card.locator("blockquote.aq-question")
    check("the question asked is shown as a quotation, its maths typeset, and not as a heading",
          "Why is gravity softened" in quote.inner_text() and quote.locator(".katex").count() == 1 and card.locator("h3").count() == 0, quote.inner_text())
    check("the answer is shown beside the map, with its link to the note", "So that close encounters stay finite" in text and card.locator('.aq-text a[href="#/k/concepts/softening"]').count() == 1, text)
    used = card.locator(".aq-used li")
    check("it lists the notes it rests on, and a sentence of each that is in the note, word for word",
          "Gravitational softening" in used.nth(0).inner_text() and f"“{QUOTE}”" in used.nth(0).inner_text() and used.nth(0).locator("blockquote.unchecked").count() == 0, used.nth(0).inner_text())
    check("…a sentence that is not in the note is not shown as one: what was read is, marked as such; a note never opened is left out",
          "Forces" in used.nth(1).inner_text() and "authors liked it" not in text and used.nth(1).locator("blockquote.unchecked").count() == 1 and "Integrators" not in text, used.nth(1).inner_text())
    check("…and what it opened and did not use, and the code it read", "Also opened, not used: Cell lists" in text and "Code read: README.md:1" in text and "Looked up 5 things" in text, text)
    # What it cost stays in view, wherever the answer is scrolled to.
    cost = panel.locator(".axis-cost")
    said = cost.locator("summary").inner_text()
    check("the cost, the tokens in and out, the tier and the model are said", "0.44¢" in said and "3,600 in · 120 out" in said and "mid · anthropic/claude-sonnet-5.5" in said, said)
    def in_view():
        c, v = cost.bounding_box(), panel.bounding_box()
        return c["y"] >= v["y"] and c["y"] + c["height"] <= v["y"] + v["height"] + 1 and c["y"] + c["height"] <= 560
    p.set_viewport_size({"width": 1440, "height": 560})  # short, so that the answer is longer than its room
    p.wait_for_timeout(300)
    seen = []
    for top in (0, 120, 100000):
        card.evaluate("(el, top) => { el.scrollTop = top; }", top)
        seen.append(in_view())
    check("the cost cannot be scrolled away from: it is below the answer, outside what scrolls", all(seen) and card.evaluate("el => el.scrollHeight > el.clientHeight"), str(seen))
    cost.locator("summary").click()
    more = cost.locator("dl").inner_text()
    check("opened, it says how the cost came about: calls to the model, and what was looked up by kind",
          "Calls to the model\n4" in more and "Searches of words\n1" in more and "Notes read\n3, 2 by a link" in more and "Code looked up\n1" in more, more)
    cost.locator("summary").click()
    card.evaluate("el => { el.scrollTop = 0; }")
    p.set_viewport_size({"width": 1440, "height": 900})
    p.wait_for_timeout(300)

    # On the map.
    p.wait_for_timeout(900)  # the view settles on what was opened
    cls = lambda title: note(p, title).get_attribute("class")
    check("the notes the answer rests on are marked on the map, by how each was reached: by a search, or by a link",
          "aq-cited" in cls("Forces") and "aq-search" in cls("Forces") and "aq-cited" in cls("Gravitational softening") and "aq-link" in cls("Gravitational softening"), cls("Forces") + " | " + cls("Gravitational softening"))
    check("…a note opened and not used is marked fainter, and one a search only named is not marked as opened",
          "aq-unused" in cls("Cell lists") and "aq-link" in cls("Cell lists") and p.locator(".gn.aq-search:not(.aq-open)").count() >= 1, cls("Cell lists"))
    check("the links followed are drawn along the way between the notes", p.locator(".aq-rt").count() == 2, str(p.locator(".aq-rt").count()))
    previews = p.locator(".aq-preview:visible")
    boxes = [previews.nth(k).bounding_box() for k in range(previews.count())]
    apart = len(boxes) == 2 and (boxes[0]["x"] + boxes[0]["width"] <= boxes[1]["x"] or boxes[1]["x"] + boxes[1]["width"] <= boxes[0]["x"] or boxes[0]["y"] + boxes[0]["height"] <= boxes[1]["y"] or boxes[1]["y"] + boxes[1]["height"] <= boxes[0]["y"])
    nb = note(p, "Gravitational softening").bounding_box()
    clear = all(b["x"] + b["width"] <= nb["x"] + 4 or nb["x"] + nb["width"] <= b["x"] + 4 or b["y"] + b["height"] <= nb["y"] + 4 or nb["y"] + nb["height"] <= b["y"] + 4 for b in boxes)
    check("a passage sits beside each note the answer rests on, joined to it by a dotted line, numbered as the answer lists them",
          previews.count() == 2 and p.locator(".aq-lead").count() == 2 and QUOTE[:30] in previews.nth(0).inner_text() and previews.nth(0).locator(".aq-n").inner_text() == "1" and p.locator(".m-step").count() == 2, str(previews.count()))
    check("…the passages cover neither each other nor the note", apart and clear, str(boxes))
    p.screenshot(path=str(OUT / "ask-answer.png"))

    # The request: where the asker was, the tools, and nothing looked up beforehand.
    first = FAKE_REQUESTS[0]
    check("the model is told where the asker is and given the lookup tools; nothing is looked up for it",
          "They are looking at the whole map" in sent(first) and {"search_notes", "outline_note", "read_note", "search_symbols"} <= {t["function"]["name"] for t in first["tools"]} and "It biases forces" not in sent(first), sent(first)[-600:])

    def ask(question):
        box.click()
        p.keyboard.press("Control+a")
        p.keyboard.type(question)
        form.get_by_role("button", name="Ask").click()

    # From the answer to the map and back.
    used.nth(1).get_by_role("button", name="Forces").click()
    expect(p.locator(".gn.sel")).to_have_count(1)
    side = p.locator(".atlas-card").bounding_box()
    ans = panel.bounding_box()
    check("choosing a note in the answer selects it on the map, and its card sits beside the answer, not under it", "sel" in cls("Forces") and side["x"] + side["width"] <= ans["x"], f"{side} {ans}")
    card.get_by_label("Passages on the map").uncheck()
    expect(p.locator(".aq-lead")).to_have_count(0)
    check("the passages can be taken off the map", p.locator(".aq-preview").count() == 0 and p.locator(".aq-lead").count() == 0)

    # Asked from the selected note: the chain starts there.
    check("with a note selected, the panel says the question is about it", where.inner_text() == "About Forces", where.inner_text())
    ask("What does it rest on from here?")
    expect(card.locator(".aq-used li")).to_have_count(1, timeout=20000)
    check("asked from a selected note, the model is told which, and a note it links to is reached by that link",
          "They have this note selected: Forces (/design/forces.md)" in sent(FAKE_REQUESTS[-1]) and "Asked from Forces." in card.inner_text() and "aq-link" in cls("Gravitational softening") and p.locator(".aq-rt").count() == 1,
          card.inner_text())
    check("…an answer with no list of what it used rests on the notes it links to", "Gravitational softening" in card.locator(".aq-used li").inner_text())
    p.screenshot(path=str(OUT / "ask-from-note.png"))

    # Code, by what it is for (T86).
    ask("Where is the nearest image worked out?")
    expect(card.locator(".aq-looked")).to_be_visible(timeout=20000)
    card.locator(".aq-looked summary").click()
    looked = card.locator(".aq-looked").inner_text()
    tools = [m["content"] for m in FAKE_REQUESTS[-1]["messages"] if m["role"] == "tool"]
    check("code is found by what it is for, from the index, and a folder is outlined", "Searched the code's symbols" in looked and "nothing found" not in looked and "Looked at what is in src/nanosim/core/" in looked
          and "minimum_image" in tools[0] and "vec3.hpp" in tools[1], looked + " | " + "\n".join(tools)[:600])

    # Found by meaning (T89), and its own mark on the map (T90).
    if MEANING:
        p.locator(".atlas-card .atlas-card-close").click()  # nothing selected, so that no link from a note in hand comes first
        ask("What stops close passes blowing up, in other words?")
        expect(card.locator(".aq-used li")).to_have_count(1, timeout=30000)
        tools = [m["content"] for m in FAKE_REQUESTS[-1]["messages"] if m["role"] == "tool"]
        check("a search by meaning is offered beside the keyword search, said to be second, and finds the note in other words than its own",
              "find_similar" in [t["function"]["name"] for t in FAKE_REQUESTS[-1]["tools"]] and "It is\n  second" in sent(FAKE_REQUESTS[-1]) and "Gravitational softening (/concepts/softening.md)" in tools[0], tools[0][:500])
        p.wait_for_timeout(700)
        check("a note found by meaning has a mark of its own on the map and in the key, apart from a search of words and a link",
              "aq-meaning" in cls("Gravitational softening") and "aq-cited" in cls("Gravitational softening") and p.locator(".aq-ring.meaning").count() >= 1
              and "Found by meaning" in card.locator(".aq-key").inner_text() and card.locator(".aq-used li.meaning").count() == 1, cls("Gravitational softening"))
        check("nothing left the machine for it: the only requests were the model's own", (ROOT / ".rdstudio/embeddings.json").exists())
        p.screenshot(path=str(OUT / "ask-meaning.png"))
    else:
        print("SKIP search by meaning: its model is not installed (mise run embed:model)")

    # The questions asked are kept (T94), and one is played again on the map.
    panel.get_by_role("button", name="Questions").click()
    expect(p.locator(".aq-ring")).to_have_count(0)
    check("putting the answer away clears the map", p.locator(".aq-rt").count() == 0 and p.locator(".gridmap.asked").count() == 0 and cost.is_hidden())
    asked = card.locator(".aq-asked li")
    expect(asked).to_have_count(4 if MEANING else 3)
    kept = sorted((TMP / "data/rdstudio/learners").glob("*/atlas/asks/*.json"))
    check("each question is kept in the learner record, newest first in the panel, and not in the repository",
          len(kept) == asked.count() and "Why is gravity softened" in asked.last.inner_text() and "0.44¢" in asked.last.inner_text() and status() == STATUS, f"{len(kept)} {asked.last.inner_text()}")
    p.reload()
    expect(asked).to_have_count(len(kept), timeout=15000)
    expect(note(p, "Gravitational softening")).to_be_visible()
    check("a question in the list has its maths typeset", asked.last.locator(".katex").count() == 1)
    before = len(FAKE_REQUESTS)
    asked.last.locator(".aq-ask").click()
    expect(card.locator(".aq-now", has_text="Playing it again")).to_be_visible()
    expect(card.locator(".aq-steps li")).to_have_count(3)  # two lookups so far, and the line saying it is playing
    partly = p.locator(".gn.aq-open").count()
    expect(card.locator(".aq-used li")).to_have_count(2, timeout=15000)
    p.wait_for_timeout(900)
    check("after a reload a kept question is played again on the map: its lookups one at a time, then the answer, its marks and its passages",
          partly < p.locator(".gn.aq-open").count() and "aq-cited" in cls("Gravitational softening") and p.locator(".aq-rt").count() == 2 and p.locator(".aq-preview:visible").count() == 2 and "So that close encounters stay finite" in card.inner_text(),
          f"{partly} {p.locator('.gn.aq-open').count()}")
    check("…with what it cost, and without asking the model again", "0.44¢" in cost.locator("summary").inner_text() and len(FAKE_REQUESTS) == before)
    p.screenshot(path=str(OUT / "ask-replay.png"))
    p.evaluate("document.documentElement.dataset.theme = 'station'")
    p.wait_for_timeout(400)
    p.screenshot(path=str(OUT / "ask-station.png"))
    p.evaluate("document.documentElement.dataset.theme = 'marginalia'")

    # A note it rests on is changed: it is played again, and the note is flagged, its sentence checked again.
    soft = ROOT / "knowledge/concepts/softening.md"
    was = soft.read_text()
    assert "biases forces" in was
    soft.write_text(was.replace("biases forces", "lowers the forces"))
    p.wait_for_timeout(1500)  # the server sees the change
    panel.get_by_role("button", name="Questions").click()
    asked.last.locator(".aq-ask").click()
    expect(card.locator(".aq-used li")).to_have_count(2, timeout=15000)
    first = card.locator(".aq-used li").nth(0)
    check("a note changed since is flagged, a sentence no longer in it is not shown as one, and the answer is still played again",
          "changed since" in first.inner_text() and first.locator("blockquote.unchecked").count() == 1 and "has changed (Gravitational softening)" in card.locator(".aq-since").inner_text() and card.get_by_role("button", name="Play again").count() == 1, card.inner_text())
    # The note is gone: the answer is shown as it was, and says what is missing.
    soft.unlink()
    p.wait_for_timeout(1500)
    panel.get_by_role("button", name="Questions").click()
    asked.last.locator(".aq-ask").click()
    expect(card.locator(".aq-since")).to_contain_text("is gone (concepts/softening)", timeout=15000)
    check("with a note gone, the answer is shown as it was with what is missing named, and is not played again",
          "So that close encounters stay finite" in card.inner_text() and card.get_by_role("button", name="Play again").count() == 0 and card.locator(".aq-used li").nth(0).locator(".aq-gone").count() == 1 and "aq-cited" in cls("Forces"), card.inner_text())
    soft.write_text(was)
    p.wait_for_timeout(1500)
    p.once("dialog", lambda d: d.accept())  # deleting asks first
    card.get_by_role("button", name="Delete").click()
    expect(asked).to_have_count(len(kept) - 1)
    check("a question forgotten is taken out of the record", len(list((TMP / "data/rdstudio/learners").glob("*/atlas/asks/*.json"))) == len(kept) - 1)
    check("no note was written", status() == STATUS, status())
    tab.click()
    p.wait_for_timeout(300)
    check("folded again, the map has the whole frame back", abs(wrap.bounding_box()["width"] - whole["width"]) < 1 and form.is_hidden())

    # A phone, upright: the panel is below the map.
    ph = browser.new_page(viewport={"width": 390, "height": 780})
    ph.on("pageerror", lambda e: errors.append(str(e)))
    ph.goto(URL + "?nosw#/map")
    ppanel = ph.locator(".axis-panel")
    ppanel.get_by_role("button", name="Axis", exact=True).click()
    pbox = ppanel.locator(".atlas-ask").get_by_role("textbox")
    expect(pbox).to_be_visible(timeout=15000)
    pbox.click()
    ph.keyboard.type("Why is gravity softened?")
    ppanel.get_by_role("button", name="Ask").click()
    expect(ppanel.locator(".aq-used li")).to_have_count(2, timeout=20000)
    ph.wait_for_timeout(300)
    fits = ph.evaluate("document.documentElement.scrollWidth <= innerWidth")
    ab, mb = ppanel.bounding_box(), ph.locator(".gridmap-wrap").bounding_box()
    cb = ppanel.locator(".axis-cost").bounding_box()
    check("on a phone held upright the panel is below the map, the full width, and the passages stay in the answer",
          fits and ab["x"] == 0 and ab["width"] == 390 and abs(mb["y"] + mb["height"] - ab["y"]) < 2 and mb["height"] > 150 and ph.locator(".aq-preview:visible").count() == 0, f"{ab} {mb}")
    check("…with the cost in view", cb["y"] + cb["height"] <= ab["y"] + ab["height"] + 1 and cb["height"] > 0, str(cb))
    ph.screenshot(path=str(OUT / "ask-phone.png"))
    # Turned on its side: the panel is to the right.
    ph.set_viewport_size({"width": 932, "height": 430})
    ph.wait_for_timeout(400)
    ab, mb = ppanel.bounding_box(), ph.locator(".gridmap-wrap").bounding_box()
    check("turned on its side, the panel is to the right of the map", abs(mb["x"] + mb["width"] - ab["x"]) < 2 and abs(ab["y"] - mb["y"]) < 2, f"{ab} {mb}")
    ph.screenshot(path=str(OUT / "ask-phone-side.png"))
    browser.close()

# No account: the box says how to connect one.
server.terminate()
server.wait()
server = serve({k: v for k, v in ENV.items() if k != "OPENROUTER_API_KEY"})
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 900})
    p.goto(URL + "?nosw#/map")
    p.locator(".axis-panel").get_by_role("button", name="Axis", exact=True).click()
    expect(p.locator(".atlas-ask-off")).to_be_visible(timeout=15000)
    ask_form = p.locator(".atlas-ask")
    check("with no model account, the panel says how to connect one and offers nothing to ask", ask_form.get_by_role("button", name="Ask", exact=True).is_hidden() and ask_form.locator("select").is_hidden()
          and p.locator(".atlas-ask-off a").get_attribute("href") == "#/teacher")
    # The box is still there to write in: what is written can be sent to an agent in the terminal, which needs no model (T109).
    check("and still offers to send what is written to the terminal agent", ask_form.locator(".axis-editor").is_visible() and ask_form.get_by_role("button", name="Send to agent").is_visible())
    browser.close()

check("no errors in the browser console", not errors, errors[:5])
server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
