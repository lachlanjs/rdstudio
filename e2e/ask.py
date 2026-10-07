"""End to end: Ask Atlas (T85), in headless Chromium, on a fresh copy of the
nanosim test bed, with a fake OpenRouter that looks things up as a model would.
Run with: mise run e2e

A question asked on the map is answered beside it; the notes the answer rests
on are marked on the map, each with a passage beside it; the links followed
from one note to the next are drawn; and how each note was reached shows.
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
    form = p.locator(".atlas-ask")
    box = form.get_by_role("textbox")
    expect(box).to_be_visible(timeout=15000)
    expect(note(p, "Forces")).to_be_visible()
    check("the Atlas has a box to ask from, which says what a question is about", box.get_attribute("placeholder") == "Ask about this project", box.get_attribute("placeholder"))
    p.screenshot(path=str(OUT / "ask-box.png"))

    box.fill("Why is gravity softened?")
    box.press("Enter")
    card = p.locator(".atlas-answer")
    expect(card.locator(".aq-steps li", has_text="Searched the notes")).to_be_visible(timeout=15000)
    check("each lookup is listed as it is made, and the notes a search named are marked while it works",
          form.get_by_role("button", name="Stop").count() == 1 and p.locator(".aq-ring.search").count() >= 2, str(p.locator(".aq-ring.search").count()))
    expect(card.locator(".aq-used li")).to_have_count(2, timeout=20000)
    text = card.inner_text()
    check("the answer is shown beside the map, with its link to the note", "So that close encounters stay finite" in text and card.locator('.aq-text a[href="#/k/concepts/softening"]').count() == 1, text)
    used = card.locator(".aq-used li")
    check("it lists the notes it rests on, and a sentence of each that is in the note, word for word",
          "Gravitational softening" in used.nth(0).inner_text() and f"“{QUOTE}”" in used.nth(0).inner_text() and used.nth(0).locator("blockquote.unchecked").count() == 0, used.nth(0).inner_text())
    check("…a sentence that is not in the note is not shown as one: what was read is, marked as such; a note never opened is left out",
          "Forces" in used.nth(1).inner_text() and "authors liked it" not in text and used.nth(1).locator("blockquote.unchecked").count() == 1 and "Integrators" not in text, used.nth(1).inner_text())
    check("…and what it opened and did not use, and the code it read", "Also opened, not used: Cell lists" in text and "Code read: README.md:1" in text and "Looked up 5 things" in text, text)
    check("the model, the tier and the cost are said", "mid · anthropic/claude-sonnet-5.5" in text, text)

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

    # From the answer to the map and back.
    used.nth(1).get_by_role("button", name="Forces").click()
    expect(p.locator(".gn.sel")).to_have_count(1)
    side = p.locator(".atlas-card").bounding_box()
    ans = card.bounding_box()
    check("choosing a note in the answer selects it on the map, and its card sits beside the answer, not under it", "sel" in cls("Forces") and side["x"] + side["width"] <= ans["x"], f"{side} {ans}")
    card.get_by_label("Passages on the map").uncheck()
    expect(p.locator(".aq-lead")).to_have_count(0)
    check("the passages can be taken off the map", p.locator(".aq-preview").count() == 0 and p.locator(".aq-lead").count() == 0)

    # Asked from the selected note: the chain starts there.
    check("with a note selected, the box says the question is about it", box.get_attribute("placeholder") == "Ask about Forces", box.get_attribute("placeholder"))
    box.fill("What does it rest on from here?")
    form.get_by_role("button", name="Ask").click()
    expect(card.locator(".aq-used li")).to_have_count(1, timeout=20000)
    check("asked from a selected note, the model is told which, and a note it links to is reached by that link",
          "They have this note selected: Forces (/design/forces.md)" in sent(FAKE_REQUESTS[-1]) and "Asked from Forces." in card.inner_text() and "aq-link" in cls("Gravitational softening") and p.locator(".aq-rt").count() == 1,
          card.inner_text())
    check("…an answer with no list of what it used rests on the notes it links to", "Gravitational softening" in card.locator(".aq-used li").inner_text())
    p.screenshot(path=str(OUT / "ask-from-note.png"))

    # Code, by what it is for (T86).
    box.fill("Where is the nearest image worked out?")
    form.get_by_role("button", name="Ask").click()
    expect(card.locator(".aq-looked")).to_be_visible(timeout=20000)
    card.locator(".aq-looked summary").click()
    looked = card.locator(".aq-looked").inner_text()
    tools = [m["content"] for m in FAKE_REQUESTS[-1]["messages"] if m["role"] == "tool"]
    check("code is found by what it is for, from the index, and a folder is outlined", "Searched the code's symbols" in looked and "nothing found" not in looked and "Looked at what is in src/nanosim/core/" in looked
          and "minimum_image" in tools[0] and "vec3.hpp" in tools[1], looked + " | " + "\n".join(tools)[:600])

    # Found by meaning (T89), and its own mark on the map (T90).
    if MEANING:
        p.locator(".atlas-card .atlas-card-close").click()  # nothing selected, so that no link from a note in hand comes first
        box.fill("What stops close passes blowing up, in other words?")
        form.get_by_role("button", name="Ask").click()
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

    card.get_by_role("button", name="Close the answer").click()
    expect(p.locator(".aq-ring")).to_have_count(0)
    check("closing the answer clears the map", card.is_hidden() and p.locator(".aq-ring").count() == 0 and p.locator(".aq-rt").count() == 0 and p.locator(".gridmap.asked").count() == 0)
    check("nothing was written", status() == STATUS, status())

    # A phone.
    ph = browser.new_page(viewport={"width": 390, "height": 780})
    ph.on("pageerror", lambda e: errors.append(str(e)))
    ph.goto(URL + "?nosw#/map")
    pbox = ph.locator(".atlas-ask").get_by_role("textbox")
    expect(pbox).to_be_visible(timeout=15000)
    pbox.fill("Why is gravity softened?")
    pbox.press("Enter")
    expect(ph.locator(".atlas-answer .aq-used li")).to_have_count(2, timeout=20000)
    fits = ph.evaluate("document.documentElement.scrollWidth <= innerWidth")
    ab = ph.locator(".atlas-answer").bounding_box()
    check("on a phone the box and the answer fit the screen, and the passages stay in the answer", fits and ab["x"] >= 0 and ab["x"] + ab["width"] <= 390 and ph.locator(".aq-preview:visible").count() == 0, str(ab))
    ph.screenshot(path=str(OUT / "ask-phone.png"))
    browser.close()

# No account: the box says how to connect one.
server.terminate()
server.wait()
server = serve({k: v for k, v in ENV.items() if k != "OPENROUTER_API_KEY"})
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page(viewport={"width": 1280, "height": 900})
    p.goto(URL + "?nosw#/map")
    expect(p.locator(".atlas-ask-off")).to_be_visible(timeout=15000)
    check("with no model account, the Atlas says how to connect one and offers nothing to ask", p.locator(".atlas-ask input:visible").count() == 0 and p.locator(".atlas-ask-off a").get_attribute("href") == "#/teacher")
    browser.close()

check("no errors in the browser console", not errors, errors[:5])
server.terminate()
shutil.rmtree(TMP, ignore_errors=True)
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(1 if failed else 0)
