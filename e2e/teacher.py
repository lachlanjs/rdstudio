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
ENV = {**os.environ, "XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
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
    p.get_by_role("heading", name="Teacher", exact=True).wait_for()
    p.locator(".teacher-skills li").first.wait_for()
    check("the Teacher page is reached from the Learn tab, which stays the current tab",
          p.locator("nav a[aria-current=page]", has_text="Learn").count() == 1)
    check("the profile is guessed from the repository", p.get_by_text("Learning a topic, guessed from what is in the repository").count() == 1)
    rows = p.locator(".teacher-skills li")
    check("the skills are listed, teach first, all rdstudio's defaults",
          rows.count() >= 1 and rows.first.locator("a.title").inner_text() == "teach" and p.locator(".teacher-skills .chip.skill-changed").count() == 0)
    p.screenshot(path=str(OUT / "teacher-desktop.png"), full_page=True)

    p.goto(URL + "?nosw#/settings")
    p.get_by_role("link", name="Open the teacher").click()
    p.wait_for_url("**#/teacher")
    rows.first.wait_for()
    check("and from Settings", p.get_by_role("heading", name="Teacher", exact=True).count() == 1)

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

    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Goals", exact=True).wait_for()
    goal_row = p.locator(".rows.goals li", has_text="Work in coordinates")
    check("the Learn tab lists the goal with its exercises", goal_row.count() == 1 and "0 of 3 exercises passed" in goal_row.inner_text(), goal_row.inner_text() if goal_row.count() else "")
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
    check("an unreadable number is said, and nothing recorded", "not a number" in p.locator(".exercise .edit-status").inner_text() and not attempts())
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
    p.goto(URL + "?nosw#/learn")
    p.get_by_role("heading", name="Answers waiting for marking").wait_for()
    check("the Learn tab lists it as waiting", p.locator(".attempts-waiting li", has_text="Why an atlas").count() == 1)

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
    p.goto(URL + "?nosw&set#/learn")
    p.get_by_role("heading", name="Set for you").wait_for()
    check("exercises an agent sets are at the top of the Learn tab, with a count on the tab",
          p.locator(".set-for-you .set-note").inner_text() == "Diagnostic: charts" and p.locator("nav a[data-tab=learn] .count").inner_text().strip() == "2", got)
    p.locator(".set-for-you").get_by_role("link", name="Start").click()
    p.locator(".exercise-choice").first.wait_for()
    p.locator(".exercise-choice", has_text="Two charts").click()
    p.get_by_role("button", name="Check").click()
    nxt = p.get_by_role("link", name="Next in “Diagnostic: charts”: The dimension of the sphere")
    nxt.wait_for()
    check("answering one leads to the next in the set", nxt.count() == 1)
    nxt.click()
    p.locator(".exercise-value input").fill("2")
    p.get_by_role("button", name="Check").click()
    p.get_by_role("link", name="Set finished: back to Learn").click()
    p.get_by_role("heading", name="Learn", exact=True).wait_for()
    check("a finished set leaves the Learn tab, and its count goes", p.get_by_role("heading", name="Set for you").count() == 0 and p.locator("nav a[data-tab=learn] .count").count() == 0)
    state = json.loads(mcp(("learner_state", {}))[0])
    check("the agent sees the set is done", "set_for_developer" not in state, state.get("set_for_developer"))

    # ------------------------------------------------------------ streaks (T48)
    p.goto(URL + "?nosw&streaks#/learn")
    tiles = p.locator(".streak")
    tiles.first.wait_for()
    texts = tiles.all_inner_texts()
    check("streaks show at the top of the Learn tab: all three, recall, new learning, problem solving",
          len(texts) == 4 and texts[0].startswith("All three") and texts[3].startswith("Problem solving"), texts)
    check("today's exercises, new notes and an empty review queue keep all three going",
          all("1 day" in t and ("Done today" in t or "Nothing due today" in t) for t in texts), texts)
    p.locator(".streak-more-info summary").click()
    check("the calendar marks today", p.locator(".cal-day.cal-today.cal-done").count() == 1)
    p.screenshot(path=str(OUT / "teacher-streaks.png"))

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
    expect(p.locator(".exercise .edit-status")).to_contain_text("Sent for review")
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
    pctx.close()

    check("no console errors", not errors, errors[:5])
    browser.close()

server.terminate()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)} of {len(results)} passed")
shutil.rmtree(TMP, ignore_errors=True)
raise SystemExit(1 if failed else 0)
