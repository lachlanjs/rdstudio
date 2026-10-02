"""End to end: the teacher (milestone M10) in headless Chromium, against a
real rdstudio serve on a throwaway copy of the differential geometry test bed,
with the learner record on in a throwaway config and data folder (never the
user's own). Run with: mise run e2e

Foundation (T43): the Teacher page reached from the Learn tab and Settings,
the guessed profile, the skills with their defaults, customising one (kept
privately, with its own history, read by the agent through MCP), comparing it
with the default, a changed default, and a reset.
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

    # Phone width: the editor fits.
    pctx, pp = page_for(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pp.goto(URL + "?nosw#/teacher/skills/teach")
    pp.get_by_role("button", name="Customise").click()
    box = pp.locator("textarea.teacher-editor").bounding_box()
    check("on a phone the skill editor fits the width", box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 390, box)
    pp.screenshot(path=str(OUT / "teacher-phone.png"))
    pctx.close()

    check("no console errors", not errors, errors[:5])
    browser.close()

server.terminate()
failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)} of {len(results)} passed")
shutil.rmtree(TMP, ignore_errors=True)
raise SystemExit(1 if failed else 0)
