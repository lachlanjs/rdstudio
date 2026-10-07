"""End to end: the teacher (milestone M10) in headless Chromium, against a
real rdstudio serve on a throwaway copy of the differential geometry test bed,
with the learner record on in a throwaway config and data folder (never the
user's own). Run with: mise run e2e

Foundation (T43): the Teacher page reached from the Learn tab and Settings,
the guessed profile, the skills with their defaults, customising one (kept
privately, with its own history, read by the agent through MCP), comparing it
with the default, a changed default, and a reset.
Goals and exercises (T44): Goal and Exercise notes kept off the map; a value
exercise checked here, wrong then right; a choice exercise after giving up;
a text exercise marked by yourself, then left for an agent who marks it
through MCP; the evidence on the tested notes; a goal met.
Profile, sources and skills (T45): the default skills listed; an agent
writing the profile through MCP, citing events; the citations shown as links
to the evidence; the developer disputing a claim, and the agent told of it;
the sources log.
Set for you (T46 finding): an agent sets exercises through MCP; they show at
the top of the Learn tab with a count on the tab, lead one to the next, and
the agent sees the set's progress.
Drafts (T49): an answer saved as typed and back after a reload; a version
kept, shown and restored, with what was there kept first; the draft filed
with the attempt on submitting.
Models (T50): the Teacher page offers to connect OpenRouter (the sign-in
address checked, the site itself not visited), shows the week's budget, and
the model for each job.
Work together (T51), against a fake OpenRouter: hints climbing the ladder,
feedback pinned red and green in the draft and following edits, a discussion,
the draft as it was, replies back after a reload, the help kept with the
attempt, and spending by feature.
Working (T46): working shown with a checked answer and sent for review,
marked by an agent who lowers a right answer; a wrong answer's working sent
afterwards, and reviewed by the developer against the solution.
"""
import json, os, shutil, socket, subprocess, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
DG = Path(os.environ.get("RDSTUDIO_BENCH_DG", Path.home() / "Repositories/differential-geometry"))
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-teacher-"))
ROOT = TMP / "project"
shutil.copytree(DG, ROOT, ignore=shutil.ignore_patterns(".rdstudio"))
(TMP / "config/rdstudio").mkdir(parents=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:tester"\n')
(ROOT / "knowledge/goals").mkdir()
(ROOT / "knowledge/goals/charts.md").write_text("""---
type: Goal
title: Work in coordinates
description: Use charts to compute on a manifold.
---

Be able to cover a manifold with charts and say what its dimension is. Needs
[Charts and atlases](/manifolds/charts-and-atlases.md "requires").
""")
(ROOT / "knowledge/exercises").mkdir()
(ROOT / "knowledge/exercises/sphere-dimension.md").write_text("""---
type: Exercise
title: The dimension of the sphere
tests: [/manifolds/smooth-manifold.md]
goals: [/goals/charts.md]
answer: { kind: value, value: 2 }
---

What is the dimension of the sphere $S^2 \\subset \\mathbb{R}^3$?

# Solution

Two: near each point it looks like a piece of the plane.
""")
(ROOT / "knowledge/exercises/two-charts.md").write_text("""---
type: Exercise
title: Charts for the sphere
tests: [/manifolds/charts-and-atlases.md]
goals: [/goals/charts.md]
answer:
  kind: choice
  choices: ["One chart", "Two charts", "None: it cannot be covered"]
  correct: 2
---

What is the fewest charts that cover $S^2$?

## Solution

Two, by stereographic projection from each pole; one is impossible, as $S^2$ is compact.
""")
(ROOT / "knowledge/exercises/why-atlases.md").write_text("""---
type: Exercise
title: Why an atlas
tests: [/manifolds/charts-and-atlases.md, /manifolds/smooth-manifold.md]
goals: [/goals/charts.md]
---

Why does a manifold need an atlas rather than one chart?

# Solution

Because a single chart need not cover it, and smoothness is defined by the transition maps between charts.
""")
# A fake OpenRouter: streams a reply chosen by what is asked, and keeps the requests.
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
FAKE_REQUESTS = []
class FakeOpenRouter(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FAKE_REQUESTS.append(body)
        said = "\n".join(part["text"] for m in body["messages"] for part in (m["content"] if isinstance(m["content"], list) else [{"text": m["content"]}]))
        if "Give a hint" in said:
            reply = "Independence." if "rung 1 of 3" in said else 'Think about why the cross terms vanish.\n[hint] "terms are independent"'
        elif "Give feedback" in said:
            reply = 'Close.\n[green] "terms are independent"\nRight: that is why the variances add.\n[red] "So Var(h) = N g^2"\nThe $1/N$ in each weight\'s variance is missing.'
        elif "Answer the developer" in said:
            reply = 'What does each weight\'s variance carry?\n[blue] "So Var(h) = N g^2"\nThis is the line your question is about.'
        else:
            reply = "ready"
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i in range(0, len(reply), 7):
            self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {'content': reply[i:i + 7]}}]})}\n\n".encode())
            self.wfile.flush()
        self.wfile.write(f"data: {json.dumps({'choices': [{'delta': {}}], 'usage': {'prompt_tokens': 1200, 'completion_tokens': 40, 'cost': 0.0021}})}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
fake = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenRouter)
threading.Thread(target=fake.serve_forever, daemon=True).start()

ENV = {**os.environ, "RDSTUDIO_OPENROUTER_URL": f"http://127.0.0.1:{fake.server_address[1]}", "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
CLI = ["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT)]

with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen([*CLI, "serve", "--port", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, env=ENV)
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

def cli(*args):
    return subprocess.run([*CLI, *args], capture_output=True, text=True, env=ENV).stdout

def teacher_dir():
    found = list((TMP / "data/rdstudio/learners").glob("*/teacher"))
    return found[0] if found else None

def mcp(*calls):
    """Call MCP tools on a fresh stdio server, as an agent's harness would; the texts they return."""
    msgs = [{"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e", "version": "1"}}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"}]
    msgs += [{"jsonrpc": "2.0", "id": i + 1, "method": "tools/call", "params": {"name": n, "arguments": a}} for i, (n, a) in enumerate(calls)]
    out = subprocess.run([*CLI, "mcp"], input="\n".join(json.dumps(m) for m in msgs) + "\n", capture_output=True, text=True, env=ENV, timeout=30).stdout
    replies = {r["id"]: r for r in (json.loads(l) for l in out.splitlines() if l.strip()) if "id" in r}
    return [replies[i + 1]["result"]["content"][0]["text"] for i in range(len(calls))]

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

    # ------------------------------------------------------------ foundation (T43)
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("link", name="How the agent teaches you here").click()
    p.get_by_role("heading", name="Axis", exact=True).wait_for()
    p.locator(".teacher-skills li").first.wait_for()
    check("the Teacher page is reached from the Learn tab, and belongs to You",
          p.locator(".you-button[aria-current=page]").count() == 1)
    check("the profile is guessed from the repository", p.get_by_text("Learning a topic, guessed from what is in the repository").count() == 1)
    rows = p.locator(".teacher-skills li")
    check("the skills are listed, teach first, all rdstudio's defaults",
          rows.count() >= 1 and rows.first.locator("a.title").inner_text() == "teach" and p.locator(".teacher-skills .chip.skill-changed").count() == 0)
    p.screenshot(path=str(OUT / "teacher-desktop.png"), full_page=True)

    p.goto(URL + "?nosw#/settings")
    p.get_by_role("link", name="Open Axis").click()
    p.wait_for_url("**#/teacher")
    rows.first.wait_for()
    check("and from Settings", p.get_by_role("heading", name="Axis", exact=True).count() == 1)

    rows.first.locator("a.title").click()
    p.locator("h1 .chip").wait_for()
    check("a skill shows its text, rendered", p.locator(".prose", has_text="Understanding is claimed only on evidence").count() == 1)
    p.get_by_role("button", name="Customise").click()
    editor = p.locator("textarea.teacher-editor")
    text = editor.input_value()
    check("customising starts from the default, frontmatter and all", text.startswith("---\nname: teach\n") and "## Rules" in text)
    editor.fill(text.replace("4. **One or two things at a time.**", "4. **One thing at a time, always.**"))
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_contain_text("Saved", timeout=5000)
    check("saved, the skill is marked customised", p.locator("h1 .chip.skill-changed").count() == 1)
    d = teacher_dir()
    check("the customisation is private, beside the learner record, with the default it was made from",
          d is not None and "One thing at a time, always." in (d / "skills/teach.md").read_text()
          and (d / "skills/.base/teach.md").exists() and not (ROOT / "teacher").exists())
    log = subprocess.run(["git", "log", "--format=%s"], cwd=d.parent, capture_output=True, text=True).stdout.split("\n") if d else []
    check("the teacher folder keeps its own history", log[:1] == ["Skill teach: customised"], log)

    agent = mcp(("teacher_skills", {}), ("teacher_skill", {"name": "teach"}))
    check("an agent sees the customisation through MCP",
          '"status": "changed"' in agent[0] and "customised by the developer" in agent[1] and "One thing at a time, always." in agent[1], agent[0][:200])

    p.get_by_role("button", name="Compare with the default").click()
    diff = p.locator(".catch-diff")
    check("comparing with the default shows the changed line",
          diff.locator(".d-del", has_text="One or two things at a time").count() == 1 and diff.locator(".d-add", has_text="One thing at a time, always.").count() == 1)

    # rdstudio's default moves on under the customisation (as after an update).
    (d / "skills/.base/teach.md").write_text((d / "skills/.base/teach.md").read_text().replace("## Rules", "## The rules"))
    p.reload()
    p.locator("h1 .chip").wait_for()
    check("a default changed since customising is said", p.get_by_text("rdstudio's default has changed since you customised this").count() == 1)
    p.get_by_role("button", name="What changed").click()
    check("and what changed in it is shown", p.locator(".catch-diff .d-del", has_text="## The rules").count() == 1)
    p.goto(URL + "?nosw#/teacher")
    rows.first.wait_for()
    check("the list flags it", p.locator(".teacher-skills .chip.stale-note").count() == 1)
    check("the history is listed on the Teacher page", p.locator(".teacher-history li", has_text="Skill teach: customised").count() == 1)

    p.locator(".teacher-skills a.title", has_text="teach").click()
    p.get_by_role("button", name="Reset to the default").click()
    expect(p.locator(".edit-status")).to_contain_text("Back to rdstudio's default", timeout=5000)
    check("a reset returns the default and removes the private copy",
          p.locator("h1 .chip.skill-default").count() == 1 and not (d / "skills/teach.md").exists())
    check("the agent reads the default again", "rdstudio's default" in mcp(("teacher_skill", {"name": "teach"}))[0])

    out = cli("teacher", "profile", "codebase")
    p.goto(URL + "?nosw&again#/teacher")
    rows.first.wait_for()
    check("the profile set from the command line is in rdstudio.toml and shown",
          'profile = "codebase"' in (ROOT / "rdstudio.toml").read_text() and p.get_by_text("Learning a codebase.").count() == 1, out)

    # ------------------------------------------------------------ the shell (T53)
    p.goto(URL + "?nosw&shell#/")
    p.locator("nav a[data-tab=today][aria-current=page]").wait_for()
    # The profile is codebase now, so this is a Project (T59): Project is a main
    # space and Practice the quiet link, and Today is the project's.
    p.locator(".project-today").wait_for()
    check("the shell in project mode: Today is home, beside Library, Atlas and Project, with Practice the quiet link",
          [t.split()[0] for t in p.locator("nav.tabs a").all_inner_texts()] == ["Today", "Library", "Atlas", "Project"]
          and p.locator(".quiet-link").inner_text().startswith("Practice") and p.locator(".mode-tag").inner_text() == "Project")
    check("…and Today counts the week's work and lists what needs you",
          p.locator(".project-today .s-tile").count() == 4 and p.get_by_text("Needs you").count() == 1)
    p.keyboard.press("Control+k")
    p.get_by_label("Jump to a note or action").first.wait_for()
    p.keyboard.type("smooth man")
    first = p.locator(".palette li").first.inner_text()
    p.keyboard.press("Enter")
    p.wait_for_url("**#/k/manifolds/smooth-manifold")
    check("the palette jumps to a note by a few letters of its name", "Smooth manifold" in first, first)
    p.locator(".palette-box").click()
    p.keyboard.type("chang")
    p.keyboard.press("Enter")
    p.wait_for_url("**#/changes")
    check("and to anything the app does", p.locator("nav.tabs a[data-tab=project][aria-current=page]").count() == 1)
    p.goto(URL + "?nosw#/map")
    p.locator(".m-place").first.wait_for(timeout=20000)
    p.wait_for_timeout(800)
    check("in project mode the Atlas shows the Activity lens, with no north arrow",
          p.locator(".map-panel .lenses button[aria-pressed=true]", has_text="Activity").count() == 1 and not p.locator(".atlas-north").is_visible())
    # Back to learning a topic, for the learning layer's own checks below.
    cli("teacher", "profile", "topic")
    p.goto(URL + "?nosw&shell2#/project")
    p.locator(".project-places").wait_for()
    check("Project gathers changes, review, reports, procedures and skills", p.locator(".project-places li").count() == 5)
    p.locator(".you-button").click()
    check("the You menu holds the teacher, settings and light or dark", p.locator(".you-menu a", has_text="Axis").count() == 1 and p.locator(".you-row button").count() == 3)
    p.locator(".you-row button", has_text="Light").click()
    check("light or dark from the You menu", p.evaluate("document.documentElement.dataset.mode") == "light")
    p.locator(".you-row button", has_text="Dark").click()
    p.keyboard.press("Escape")

    # ------------------------------------------------------------ goals and exercises (T44)
    def attempts(kind="attempt"):
        rec = list((TMP / "data/rdstudio/learners").glob("*/record.jsonl"))
        lines = rec[0].read_text().splitlines() if rec else []
        return [e for e in (json.loads(l) for l in lines if l.strip()) if e["event"] == kind]

    def settle(count, kind="attempt", timeout=3.0):
        end = time.time() + timeout
        while time.time() < end and len(attempts(kind)) < count:
            time.sleep(0.05)

    p.goto(URL + "?nosw#/map")
    p.wait_for_selector(".m-place", timeout=20000)
    p.wait_for_timeout(600)
    labels = p.locator(".m-text").evaluate_all("els => els.map(e => e.textContent)")
    check("goals and exercises are kept off the map, folders and all",
          not any(t.strip() in ("Exercises", "Goals", "Why an atlas", "Work in coordinates") for t in labels), labels[:30])

    p.goto(URL + "?nosw&goals#/")
    goal_row = p.locator(".today-margin .goals li", has_text="Work in coordinates")
    goal_row.wait_for()
    check("Today lists the goal with its exercises", "0 of 3" in goal_row.inner_text(), goal_row.inner_text())
    p.goto(URL + "?nosw#/practice")
    p.get_by_role("heading", name="Exercises", exact=True).wait_for()
    check("the Practice page lists the exercises, not tried", p.locator(".written-exercises li .chip.ex-untried").count() == 3)

    # A value, checked here: wrong, then right.
    p.locator(".written-exercises a.title", has_text="The dimension of the sphere").click()
    box = p.locator(".exercise-value input")
    box.wait_for()
    check("the solution is kept back until you answer", p.get_by_role("heading", name="Solution").count() == 0 and p.locator(".katex").count() >= 1)
    box.fill("two")
    p.get_by_role("button", name="Check").click()
    check("an unreadable number is said, and nothing recorded", "not a number" in p.locator(".bench .edit-status").inner_text() and not attempts())
    box.fill("3")
    p.get_by_role("button", name="Check").click()
    expect(p.locator(".exercise-verdict")).to_contain_text("Not right. The answer is 2.")
    settle(1)
    check("a wrong value is recorded as missed, checked here, and the solution shown",
          attempts()[-1]["result"] == "missed" and attempts()[-1]["by"] == "dashboard" and p.get_by_role("heading", name="Solution").count() == 1)
    p.get_by_role("button", name="Try again").click()
    p.locator(".exercise-value input").fill("2.0")
    p.locator(".exercise-value input").press("Enter")
    expect(p.locator(".exercise-verdict")).to_contain_text("Right.")
    settle(2)
    a = attempts()[-1]
    check("a right value is evidence for the note it tests, at its version",
          a["result"] == "got" and a["tests"] == ["manifolds/smooth-manifold"] and set(a["hashes"]) == {"manifolds/smooth-manifold"})
    expect(p.locator(".exercise-attempts li")).to_have_count(2)
    check("both attempts are listed, newest first", "Passed" in p.locator(".exercise-attempts li").first.inner_text() and "checked here" in p.locator(".exercise-attempts li").first.inner_text())

    # A choice, after giving up.
    p.goto(URL + "?nosw#/k/exercises/two-charts")
    p.locator(".exercise-choice").first.wait_for()
    p.get_by_role("button", name="Show the solution").click()
    expect(p.locator(".exercise-verdict")).to_contain_text("Here is the solution.")
    settle(3)
    check("giving up is recorded as missed, by you", attempts()[-1].get("gave_up") is True and attempts()[-1]["result"] == "missed")
    p.get_by_role("button", name="Try again").click()
    p.locator(".exercise-choice", has_text="Two charts").click()
    p.get_by_role("button", name="Check").click()
    expect(p.locator(".exercise-verdict")).to_contain_text("Right.")
    settle(4)
    check("the right choice is checked here", attempts()[-1]["answer"] == "Two charts" and attempts()[-1]["result"] == "got")

    # Text: marked by yourself, then left for an agent.
    p.goto(URL + "?nosw#/k/exercises/why-atlases")
    area = p.locator(".exercise-answer .answer-editor .cm-content")
    area.wait_for()
    area.fill("One chart may not cover it; $S^2$ needs two.")
    area.press("End")
    area.press("Enter")
    area.press("Enter")
    p.keyboard.type("(Off the line being written, maths is typeset.)")
    box = p.locator(".exercise-answer .answer-editor").bounding_box()
    check("a written answer is the note editor's live preview, maths shown as typed, in a large box",
          p.locator(".exercise-answer .answer-editor .katex").count() == 1 and box["height"] >= 300, box)
    p.get_by_role("button", name="Mark it yourself").click()
    check("marking it yourself shows the solution first", p.get_by_role("heading", name="Solution").count() == 1)
    p.get_by_role("button", name="Partly").click()
    settle(5)
    check("your own marking is recorded as yours", attempts()[-1]["result"] == "partly" and attempts()[-1]["by"] == "self")
    p.get_by_role("button", name="Try again").click()
    p.locator(".exercise-answer .answer-editor .cm-content").fill("A single chart need not cover the manifold, and smoothness comes from the transition maps.")
    p.get_by_role("button", name="Ask an agent to mark it").click()
    expect(p.get_by_role("heading", name="Saved for marking")).to_be_visible()
    settle(6)
    check("an answer for an agent waits, unmarked", "result" not in attempts()[-1] and attempts()[-1]["kind"] == "ai")
    p.goto(URL + "?nosw&wait#/")
    p.locator(".waiting-marking").wait_for()
    check("Today lists it as waiting for marking", p.locator(".waiting-marking li", has_text="Why an atlas").count() == 1)

    pending = json.loads(mcp(("exercise_pending", {}))[0])
    ref = pending[0]["ref"] if pending else None
    check("an agent finds it through MCP", len(pending) == 1 and pending[0]["exercise"] == "exercises/why-atlases", pending)
    marked = mcp(("exercise_mark", {"ref": ref, "result": "got", "feedback": "Right on both counts: coverage and the transition maps.", "gaps": []}))[0]
    p.goto(URL + "?nosw&back#/k/exercises/why-atlases")
    p.locator(".exercise-attempts li").first.wait_for()
    first = p.locator(".exercise-attempts li").first.inner_text()
    check("the agent's marking shows on the exercise, with its feedback", "Passed" in first and "transition maps." in first and "marked by" in first, first + marked)
    check("and the tested notes are understood", p.locator(".chip.ex-passed").count() >= 1)

    p.goto(URL + "?nosw#/k/goals/charts")
    p.locator(".goal-panel").wait_for()
    panel = p.locator(".goal-panel").inner_text()
    check("the goal is met once every exercise is passed", panel.startswith("Met") and "3 of 3 exercises passed" in panel, panel[:200])
    check("the goal lists what it needs in reading order, with your states",
          p.locator(".goal-notes li", has_text="Charts and atlases").count() == 1 and "Understood" in p.locator(".goal-notes li", has_text="Charts and atlases").inner_text())
    p.screenshot(path=str(OUT / "teacher-goal.png"), full_page=True)
    p.goto(URL + "?nosw#/k/manifolds/smooth-manifold")
    p.locator(".doc-head").wait_for()
    check("a note tested by a passed exercise is understood", "st-understood" in (p.locator(".doc-head").get_attribute("class") or ""))

    # ------------------------------------------------------------ profile, sources and skills (T45)
    p.goto(URL + "?nosw&t45#/teacher")
    rows.first.wait_for()
    names = rows.locator("a.title").all_inner_texts()
    check("the default skills are listed, teach first", names[:1] == ["teach"] and set(names) >= {"assess", "map", "source", "exercise", "next", "review-changes"}, names)
    check("with no profile yet, the page says what one will hold", p.get_by_text("No profile yet.").count() == 1)

    partly = next(a for a in attempts() if a.get("result") == "partly")
    gave_up = next(a for a in attempts() if a.get("gave_up"))
    mark = attempts("attempt_marked")[-1]
    profile = f"""# Strong

- Values checked first time once read carefully [e:{attempts()[1]['id']}].

# Struggling

- Saying why an atlas is needed: covered coverage, missed the transition maps [e:{partly['id']}], then got both [e:{mark['id']}].
- Gives up on counting charts [e:{gave_up['id']}].

# Changes

- First picture.
"""
    wrote = mcp(("teacher_write", {"name": "profile.md", "text": profile, "message": "First picture"}),
                ("teacher_write", {"name": "sources.md", "text": "## Charts\n\n- Chose: Lee, *Introduction to Smooth Manifolds*, ch. 1.\n"}))
    p.goto(URL + "?nosw&t45b#/teacher")
    p.locator(".teacher-file").first.wait_for()
    refs = p.locator(".teacher-file .ev-ref")
    labels = refs.all_inner_texts()
    check("the profile written through MCP shows, its citations as links to the evidence",
          refs.count() == 4 and "Why an atlas: Partly" in labels and "Charts for the sphere: gave up" in labels, labels or wrote)
    p.locator(".teacher-sources summary").click()
    check("the sources log is there too", p.locator(".teacher-sources", has_text="Introduction to Smooth Manifolds").count() == 1)
    p.locator(".teacher-file .ev-ref", has_text="Why an atlas: Got it").click()
    p.get_by_role("heading", name="Marking").wait_for()
    body = p.locator(".page").inner_text()
    check("a citation opens the evidence: the answer and its marking", "smoothness comes from the transition maps" in body and "transition maps." in body and "Got it" in body, body[:300])

    p.goto(URL + "?nosw#/teacher/profile")
    p.get_by_role("button", name="Edit").click()
    ed = p.locator("textarea.teacher-editor")
    ed.fill(ed.input_value().replace("- Gives up on counting charts", "- Gives up on counting charts. Disputed: I clicked by mistake."))
    p.get_by_role("button", name="Save").click()
    expect(p.locator(".edit-status")).to_contain_text("Saved", timeout=5000)
    check("the developer's edit is kept in the file's history", p.locator(".teacher-history li", has_text="edited by you").count() == 1)
    told = mcp(("teacher_read", {"name": "profile.md"}), ("teacher_read", {"name": "profile.md", "developer_edit": True}))
    check("an agent reading the profile is told of the edit, and can read it as a diff",
          "The developer edited it on" in told[0] and "+- Gives up on counting charts. Disputed: I clicked by mistake." in told[1], told[1][:300])
    p.screenshot(path=str(OUT / "teacher-profile.png"), full_page=True)

    # ------------------------------------------------------------ set for you
    got = mcp(("exercise_assign", {"ids": ["exercises/two-charts", "exercises/sphere-dimension"], "note": "Diagnostic: charts"}))[0]
    p.goto(URL + "?nosw&set#/")
    sec = p.locator(".sec", has=p.locator(".kind", has_text="Set for you"))
    sec.wait_for()
    check("exercises an agent sets are on Today, with a count on its tab",
          sec.locator("h2").inner_text() == "Diagnostic" and sec.locator(".desc").inner_text() == "Charts" and p.locator("nav a[data-tab=today] .count").inner_text().strip() == "2", got)
    sec.locator(".ex a.t").first.click()
    p.locator(".exercise-choice").first.wait_for()
    p.locator(".exercise-choice", has_text="Two charts").click()
    p.get_by_role("button", name="Check").click()
    nxt = p.get_by_role("link", name="Next in “Diagnostic: charts”: The dimension of the sphere")
    nxt.wait_for()
    check("answering one leads to the next in the set", nxt.count() == 1)
    nxt.click()
    p.locator(".exercise-value input").fill("2")
    p.get_by_role("button", name="Check").click()
    p.get_by_role("link", name="Set finished: back to Today").click()
    p.get_by_role("heading", name="Today", exact=True).wait_for()
    check("a finished set leaves Today, and its count goes", p.locator(".sec .kind", has_text="Set for you").count() == 0 and p.locator("nav a[data-tab=today] .count").count() == 0)
    state = json.loads(mcp(("learner_state", {}))[0])
    check("the agent sees the set is done", "set_for_developer" not in state, state.get("set_for_developer"))

    # ------------------------------------------------------------ streaks (T48)
    p.goto(URL + "?nosw&streaks#/")
    tiles = p.locator(".s-tile")
    tiles.first.wait_for()
    texts = tiles.all_inner_texts()
    check("streaks lead Today: all three, recall, new learning, problem solving",
          len(texts) == 4 and texts[0].startswith("All three") and texts[3].startswith("Problem solving"), texts)
    import re as _re
    check("today's exercises, new notes and an empty review queue keep all three going",
          all(_re.search(r"\b1\s+day\b", t) and ("done today" in t or "nothing due today" in t) for t in texts), texts)
    p.locator(".cal-toggle summary").click()
    check("the calendar marks today", p.locator(".cal-day.cal-today.cal-done").count() == 1)
    p.screenshot(path=str(OUT / "teacher-streaks.png"))

    # ------------------------------------------------------------ the next step on Today (T54)
    mcp(("teacher_write", {"name": "next.md", "text": "---\nabout: exercises/why-atlases\npen: green\n---\nTry [Why an atlas](/exercises/why-atlases.md) again, without hints.\n"}))
    p.goto(URL + "?nosw&next#/")
    pin = p.locator(".today-pin")
    pin.wait_for()
    check("the teacher's next step, written through MCP, is pinned on Today in its pen",
          "without hints" in pin.inner_text() and "pin-green" in (pin.get_attribute("class") or ""), pin.inner_text())
    p.screenshot(path=str(OUT / "teacher-today.png"))

    # ------------------------------------------------------------ working sent for review
    def events_named(kind):
        return attempts(kind)

    p.goto(URL + "?nosw&w1#/k/exercises/sphere-dimension")
    p.locator(".exercise-value input").wait_for()
    p.locator(".exercise-working summary").click()
    p.locator(".exercise-working .cm-content").fill("Spheres are surfaces, so $2$. (Guessed.)")
    p.get_by_label("Have my working reviewed, whatever the answer").check()
    p.locator(".exercise-value input").fill("2")
    n = len(attempts())
    p.get_by_role("button", name="Check").click()
    expect(p.locator(".exercise-verdict")).to_contain_text("Right.")
    settle(n + 1)
    expect(p.get_by_text("Your working is waiting for review")).to_be_visible(timeout=5000)
    a = attempts()[-1]
    check("working shown with a checked answer is kept, and sent for review when asked",
          a["result"] == "got" and a.get("review") is True and "Guessed" in a.get("working", "") and p.get_by_text("Your working is waiting for review").count() == 1, (a, p.locator(".exercise-answer").inner_text()))
    pend = json.loads(mcp(("exercise_pending", {}))[0])
    mine_ = [x for x in pend if x["ref"] == a["id"]]
    check("an agent sees it, with the check's verdict", mine_ and mine_[0]["review"] == "working" and mine_[0]["checked"] == "got", pend)
    mcp(("exercise_mark", {"ref": a["id"], "result": "partly", "feedback": "Right number, but the argument is a guess: say why each point has a chart to the plane."}))
    p.goto(URL + "?nosw&w2#/k/exercises/sphere-dimension")
    first = p.locator(".exercise-attempts li").first
    first.wait_for()
    expect(first).to_contain_text("Partly")
    check("a review can lower a right answer, and says what the check found", "(checked here: passed)" in first.inner_text(), first.inner_text())

    # A wrong answer: the review is offered, with the working.
    p.locator(".exercise-value input").fill("3")
    n = len(attempts())
    p.get_by_role("button", name="Check").click()
    expect(p.locator(".exercise-verdict")).to_contain_text("Not right.")
    offer = p.locator(".exercise-offer")
    expect(offer).to_be_visible(timeout=5000)
    check("after a wrong answer, sending the working for review is offered", offer.count() == 1 and "slip" in offer.inner_text(), p.locator(".exercise-answer").inner_text())
    offer.locator(".cm-content").fill("Counted the coordinates of $\\mathbb{R}^3$: 3. Should have counted the sphere's own directions.")
    offer.get_by_role("button", name="Send my working for review").click()
    expect(p.locator(".bench .edit-status")).to_contain_text("Sent for review")
    settle(1, "review_requested")
    rr = attempts("review_requested")[-1]
    check("the working is sent after the fact, for that answer", rr["ref"] == attempts()[-1]["id"] and "own directions" in rr["working"])
    marks = len(attempts("attempt_marked"))
    p.get_by_role("button", name="Review your working yourself").first.click()
    check("reviewing it yourself shows the working beside the solution",
          p.locator(".exercise-answer blockquote", has_text="own directions").count() == 1 and p.get_by_role("heading", name="Solution").count() == 1)
    p.get_by_role("button", name="Missed it").click()
    settle(marks + 1, "attempt_marked")
    m = attempts("attempt_marked")[-1]
    check("your review is recorded as yours", m["ref"] == rr["ref"] and m["by"] == "self" and m["result"] == "missed", m)

    # ------------------------------------------------------------ models (T50)
    p.goto(URL + "?nosw&ai#/teacher")
    p.get_by_role("heading", name="Models and spending").wait_for()
    p.get_by_role("button", name="Connect OpenRouter").wait_for()
    check("the Teacher page offers to connect OpenRouter, and shows the week's budget and the models",
          "$0 of $10.00 this week" in p.locator(".page").inner_text() and p.locator(".fm.spend code", has_text="google/gemini-3.8-flash").count() == 1)
    went = []
    p.route("https://openrouter.ai/**", lambda route: (went.append(route.request.url), route.fulfill(status=200, body="<p>OpenRouter</p>", content_type="text/html")))
    p.get_by_role("button", name="Connect OpenRouter").click()
    p.wait_for_url("https://openrouter.ai/**", timeout=5000)
    from urllib.parse import urlparse, parse_qs
    q = parse_qs(urlparse(went[0]).query) if went else {}
    check("connecting goes to OpenRouter's sign-in, with PKCE and a way back here",
          q.get("code_challenge_method") == ["S256"] and q.get("callback_url", [""])[0].startswith(URL.rstrip("/") + "/api/teacher/ai/callback?state="), went[:1])
    p.unroute("https://openrouter.ai/**")
    p.goto(URL + "?nosw&ai=expired#/teacher")
    expect(p.locator(".edit-status", has_text="took too long")).to_be_visible(timeout=5000)
    check("coming back without a key says why", True)

    # ------------------------------------------------------------ drafts (T49)
    p.goto(URL + "?nosw&d1#/k/exercises/why-atlases")
    ed = p.locator(".exercise-answer .answer-editor .cm-content")
    ed.wait_for()
    ed.fill("First thoughts: charts overlap.")
    expect(p.locator(".a-foot")).to_contain_text("Draft saved", timeout=5000)
    p.goto(URL + "?nosw&d2#/k/exercises/why-atlases")
    ed.wait_for()
    expect(p.locator(".bench .edit-status")).to_contain_text("is back", timeout=5000)
    check("a draft answer is saved as typed, and back after leaving", "First thoughts: charts overlap." in ed.inner_text())
    p.locator(".draft-versions summary").click()
    p.get_by_role("button", name="Keep this version").click()
    expect(p.locator(".bench .edit-status")).to_contain_text("Kept as v1")
    ed.fill("Rewritten entirely, and worse.")
    p.wait_for_timeout(900)
    p.locator(".draft-versions li", has_text="v1").get_by_role("button", name="Show").click()
    check("a kept version can be shown beside the draft", "First thoughts" in p.locator(".draft-shown").inner_text() and "Rewritten" in ed.inner_text())
    p.locator(".draft-versions li", has_text="v1").get_by_role("button", name="Restore").click()
    expect(p.locator(".bench .edit-status")).to_contain_text("Restored v1")
    check("restoring brings it back, and keeps what was there as a version",
          "First thoughts: charts overlap." in ed.inner_text() and p.locator(".draft-versions li", has_text="before restoring").count() == 1)
    p.get_by_role("button", name="Mark it yourself").click()
    n = len(attempts())
    p.get_by_role("button", name="Partly").click()
    settle(n + 1)
    att = attempts()[-1]
    filed = teacher_dir() / "drafts" / "submitted" / f"{att['id']}.json"
    deadline = time.time() + 3
    while time.time() < deadline and not filed.exists():
        time.sleep(0.05)
    check("submitting files the draft, with its versions, under the attempt",
          filed.exists() and [v["id"] for v in json.loads(filed.read_text())["versions"]] == ["v1", "v2"]
          and not (teacher_dir() / "drafts" / "exercises~why-atlases.json").exists())

    # ------------------------------------------------------------ work together (T51)
    (TMP / "config/rdstudio/openrouter.key").write_text("sk-or-v1-e2e-fake-key-000\n")
    p.goto(URL + "?nosw&t1#/k/exercises/why-atlases")
    ed = p.locator(".exercise-answer .answer-editor .cm-content")
    ed.wait_for()
    p.locator(".a-tools").wait_for()
    draft = "The variance adds because the terms are independent. So Var(h) = N g^2."
    ed.fill(draft)
    p.locator(".a-tools").get_by_role("button", name="Hint").click()
    card = p.locator(".m-cards .pin").first
    expect(card).to_contain_text("Independence.", timeout=8000)
    check("a hint comes back, the smallest push first", "Hint 1 of 3" in card.locator(".pin-head").inner_text() and "rung 1 of 3" in json.dumps(FAKE_REQUESTS[-1]))
    asked = json.dumps(FAKE_REQUESTS[-1])
    check("the teacher is given the tutor skill, the exercise, its solution and the notes it tests, and the draft",
          "How to teach" in asked and "Why does a manifold need an atlas" in asked and "transition maps" in asked and "The variance adds" in asked)
    p.locator(".a-tools").get_by_role("button", name="Hint (2 of 3)").click()
    expect(p.locator(".m-cards .pin", has_text="cross terms")).to_have_count(1, timeout=8000)
    check("the next hint climbs a rung", "rung 2 of 3" in json.dumps(FAKE_REQUESTS[-1]))
    p.locator(".a-tools").get_by_role("button", name="Feedback").click()
    p.get_by_role("button", name="Fairly sure").click()
    expect(p.locator(".m-cards .pin-red")).to_be_visible(timeout=8000)
    check("feedback is pinned in the draft, red and green, as you were asked how sure you were",
          p.locator(".answer-editor .cm-pin-green").inner_text() == "terms are independent" and p.locator(".answer-editor .cm-pin-red").inner_text() == "So Var(h) = N g^2"
          and "fairly sure" in json.dumps(FAKE_REQUESTS[-1]))
    p.locator(".m-cards .pin-red .pin-quote").click()
    sel = p.evaluate("() => window.getSelection().toString()")
    check("a pin's quote shows its passage in the draft", sel == "So Var(h) = N g^2", sel)
    ed.press("Control+Home")
    p.keyboard.type("First: ")
    check("pins stay on their words as the draft changes", p.locator(".answer-editor .cm-pin-green").inner_text() == "terms are independent")
    p.locator(".a-tools").get_by_role("button", name="Discuss").click()
    p.get_by_label("Your question").fill("Is the last line right?")
    p.locator(".tutor-ask").get_by_role("button", name="Ask").click()
    expect(p.locator(".m-cards .pin-blue")).to_be_visible(timeout=8000)
    p.wait_for_timeout(300)
    check("a discussion answers, pinned in blue", p.locator(".answer-editor .cm-pin-blue").count() >= 1 and "Is the last line right?" in json.dumps(FAKE_REQUESTS[-1]),
          (p.locator(".answer-editor .cm-pin-blue").count(), p.locator(".answer-editor .cm-content").inner_html()[:600], p.locator(".m-cards .pin-blue").inner_text()))
    p.locator(".m-cards .pin", has_text="Independence.").locator(".pin-foot button").first.click()
    check("a reply shows the draft as it was when asked", draft in p.locator(".draft-shown").inner_text() and "First:" not in p.locator(".draft-shown").inner_text())
    p.locator(".m-seen > summary").click()
    check("what the teacher saw is shown, section by section", p.locator(".m-seen li").count() >= 5)
    # The margin: cards level with their words, joined by leader lines in each pen's style.
    led = p.evaluate("""() => [...document.querySelectorAll('svg.leaders path')].map(e => e.getAttribute('class'))""")
    check("the margin joins its cards to their words, in each pen's line", {"ld-red", "ld-green", "ld-blue", "ld-hint"} <= set(led), led)
    p.screenshot(path=str(OUT / "teacher-tutor.png"), full_page=True)
    p.goto(URL + "?nosw&t2#/k/exercises/why-atlases")
    p.locator(".m-cards .pin").first.wait_for()
    check("the replies are back after a reload, pinned again", p.locator(".m-cards .pin").count() == 5 and p.locator(".answer-editor .cm-pin-red").count() == 1)
    p.get_by_role("button", name="Mark it yourself").click()
    n = len(attempts())
    p.get_by_role("button", name="Got it").click()
    settle(n + 1)
    att = attempts()[-1]
    check("the help is part of the answer", att.get("help") == {"hint": 2, "feedback": 1, "discuss": 1}, att.get("help"))
    filed = teacher_dir() / "drafts" / "submitted" / f"{att['id']}.json"
    deadline = time.time() + 3
    while time.time() < deadline and not filed.exists():
        time.sleep(0.05)
    check("and the session is filed with it, for the marker", filed.exists() and len(json.loads(filed.read_text())["turns"]) == 4)
    expect(p.locator(".exercise-attempts li").first).to_contain_text("written with 2 hints, feedback, discussion")
    p.goto(URL + "?nosw&t3#/teacher")
    p.get_by_role("heading", name="Models and spending").wait_for()
    spend = p.locator(".fm.spend").first.inner_text()
    check("spending is tracked by feature", "Hints" in spend and "Feedback" in spend and "Discussion" in spend, spend)

    # Phone width: the editor fits.
    pctx, pp = page_for(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pp.goto(URL + "?nosw#/teacher/skills/teach")
    pp.get_by_role("button", name="Customise").click()
    box = pp.locator("textarea.teacher-editor").bounding_box()
    check("on a phone the skill editor fits the width", box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 390, box)
    pp.screenshot(path=str(OUT / "teacher-phone.png"))
    pp.goto(URL + "?nosw#/k/exercises/two-charts")
    pp.locator(".exercise-choice").first.wait_for()
    wide = pp.evaluate("document.documentElement.scrollWidth")
    check("on a phone an exercise fits without sideways scrolling", wide <= 390, wide)
    pp.screenshot(path=str(OUT / "teacher-exercise-phone.png"), full_page=True)
    # Phone layouts (T58): the spaces in a bar at the bottom; an exercise's
    # marking actions in its place, with a way back.
    foot = pp.locator(".bench .a-foot").bounding_box()
    check("on a phone an exercise's marking actions take the tab bar's place, with a way back",
          not pp.locator(".tabbar").is_visible() and pp.get_by_role("button", name="Back").is_visible()
          and foot is not None and abs(foot["y"] + foot["height"] - 844) < 2, foot)
    pp.goto(URL + "?nosw#/")
    pp.locator(".s-tile").first.wait_for()
    check("…and elsewhere the spaces are a bar at the bottom", pp.locator(".tabbar").is_visible()
          and pp.locator(".tabbar a, .tabbar button").count() == 5 and not pp.locator(".bar .tabs").is_visible())
    pp.locator(".tabbar").get_by_role("button", name="More").tap()
    check("…More holds the You menu", pp.get_by_role("menuitem", name="Axis").is_visible())
    pp.keyboard.press("Escape")
    if pp.locator(".today-pin.has-inline").count():
        check("…and the teacher's next step hangs under its row", pp.locator(".ex li.next-inline .pin").is_visible())
    pp.screenshot(path=str(OUT / "teacher-today-phone.png"))
    pctx.close()

    check("no console errors", not errors, errors[:5])
    browser.close()

server.terminate()
fake.shutdown()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)} of {len(results)} passed")
shutil.rmtree(TMP, ignore_errors=True)
raise SystemExit(1 if failed else 0)
