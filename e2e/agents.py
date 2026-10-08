"""End to end: a terminal agent's path through the base, shown live (T107, T108), in headless Chromium, on a fresh
copy of the nanosim test bed. Run with: mise run e2e

A real `rdstudio mcp` is started and spoken to as a harness speaks to it. With the Atlas open and the Axis panel
open, each call shows as a step within a moment, with no reload; the notes it opened are marked on the map, and one
it wrote is marked as written and appears on the map. A file read with the agent's own tools, reported as a harness's
hook reports it, joins the same session. The session is listed afterwards, opened again, and deleted. Then the
other way (T109): something sent from the app waits, the brief says so, and the agent takes it once. No model is
connected: none is needed to watch or to send.
"""
import json, os, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
TMP = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-agents-"))
ROOT = TMP / "nanosim"
subprocess.run([sys.executable, str(REPO / "bench/nanosim.py"), str(ROOT)], check=True, stdout=subprocess.DEVNULL)
ENV = {k: v for k, v in os.environ.items() if k != "OPENROUTER_API_KEY"} | {"XDG_CONFIG_HOME": str(TMP / "config"), "XDG_DATA_HOME": str(TMP / "data")}
(TMP / "config/rdstudio").mkdir(parents=True)
(TMP / "config/rdstudio/config.toml").write_text('[learner]\nenabled = true\n\n[actors]\nhuman = "human:e2e"\n')
MAIN = ["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT)]
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen([*MAIN, "serve", "--port", str(PORT)], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(200):
    try:
        socket.create_connection(("127.0.0.1", PORT), 0.2).close()
        break
    except OSError:
        time.sleep(0.1)

class Agent:
    """A harness's side of the MCP server, over its standard streams."""
    def __init__(self, name):
        self.p = subprocess.Popen([*MAIN, "mcp"], env=ENV, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        self.n = 0
        self.ask("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": name, "version": "2.1"}})
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"); self.p.stdin.flush()
    def ask(self, method, params):
        self.n += 1
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params}) + "\n"); self.p.stdin.flush()
        while True:
            got = json.loads(self.p.stdout.readline())
            if got.get("id") == self.n:
                return got["result"]
    def call(self, tool, **args):
        return self.ask("tools/call", {"name": tool, "arguments": args})["content"][0]["text"]
    def close(self):
        self.p.stdin.close(); self.p.wait(timeout=10)

results = []
def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
note = lambda p, title: p.locator(f'.gn[aria-label="{title}"]')

errors = []
agent = None
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        p = browser.new_page(viewport={"width": 1440, "height": 900})
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.on("console", lambda m: m.type == "error" and errors.append(m.text))
        p.goto(URL + "?nosw#/map")
        panel = p.locator(".axis-panel")
        tab = panel.get_by_role("button", name="Axis", exact=True)
        expect(tab).to_be_visible(timeout=20000)
        if tab.get_attribute("aria-expanded") != "true":
            tab.click()
        check("with no model connected, the panel is there to watch from", panel.locator(".atlas-ask-off").is_visible())
        check("no session yet", panel.get_by_text("Agents at work").count() == 0)
        p.wait_for_timeout(800)  # the page is listening

        agent = Agent("claude-code")
        found = agent.call("search", query="softened gravity")
        steps = panel.locator(".aq-steps li:not(.aq-now)")
        expect(steps).to_have_count(1, timeout=5000)  # no reload: the panel opened the session by itself
        check("the first call opens the session by itself, named for the agent", "claude-code 2.1" in panel.locator(".aq-question").inner_text() and "at work now" in panel.locator(".aq-question").inner_text().lower(), panel.locator(".aq-question").inner_text())
        check("a search says what was searched for and how many it found", 'Searched the notes for "softened gravity"' in steps.nth(0).inner_text() and "softening" in found)
        t = time.time()
        agent.call("read", id="concepts/softening")
        expect(steps).to_have_count(2, timeout=5000)
        check("a step shows within two seconds of the call", time.time() - t < 2.0, f"{time.time() - t:.2f}s")
        expect(note(p, "Gravitational softening")).to_have_class(__import__("re").compile(r"\baq-open\b"), timeout=5000)
        check("the note read is marked on the map as opened", True)
        agent.call("read", id="design/forces")
        expect(steps).to_have_count(3, timeout=5000)
        agent.call("record", id="decisions/softening-length", type="Decision", title="Choosing the softening length", description="How ε is chosen.",
                   body="ε is a fraction of the mean spacing. See [Gravitational softening](/concepts/softening.md).")
        expect(steps).to_have_count(4, timeout=5000)
        check("a write is told apart in the list", "wrote" in (steps.nth(3).get_attribute("class") or "") and "Wrote a new note: Choosing the softening length" in steps.nth(3).inner_text(), steps.nth(3).inner_text())
        expect(note(p, "Choosing the softening length")).to_have_class(__import__("re").compile(r"\baq-write\b"), timeout=10000)
        check("the note written appears on the map, marked as written, with no reload", True)
        check("what was read or written is not shown, only what was touched", "fraction of the mean spacing" not in panel.inner_text())

        # A file of the base read with the agent's own tools, as its harness's hook reports it (T108).
        hook = {"session_id": "abc", "hook_event_name": "PostToolUse", "cwd": str(ROOT), "tool_name": "Read", "tool_input": {"file_path": str(ROOT / "knowledge/design/integrators.md")}}
        t = time.time()
        done = subprocess.run([*MAIN, "trace"], env=ENV, input=json.dumps(hook), capture_output=True, text=True)
        took = time.time() - t
        check("the hook's command takes its report and says nothing", done.returncode == 0 and done.stdout == "" and done.stderr == "", done.stderr[:200])
        check("and is quick enough to run on every tool call", took < 1.0, f"{took:.2f}s")
        expect(steps).to_have_count(5, timeout=5000)
        check("a file read outside MCP joins the same session", "as a file" in steps.nth(4).inner_text(), steps.nth(4).inner_text())
        other = {**hook, "tool_input": {"file_path": str(ROOT / "README.md")}}
        subprocess.run([*MAIN, "trace"], env=ENV, input=json.dumps(other), capture_output=True, text=True)
        subprocess.run([*MAIN, "trace"], env=ENV, input="not json", capture_output=True, text=True)
        p.wait_for_timeout(1200)
        check("a file outside the base is not a step", steps.count() == 5)
        p.screenshot(path=str(OUT / "agents-live.png"))

        # Afterwards: listed, opened again, deleted.
        panel.get_by_role("button", name="Questions").click()
        expect(panel.get_by_text("Agents at work")).to_be_visible(timeout=5000)
        row = panel.locator(".aq-ask").first
        check("the session is listed with its counts", "claude-code 2.1" in row.inner_text() and "5 steps" in row.inner_text() and "1 written" in row.inner_text(), row.inner_text())
        row.click()
        expect(steps).to_have_count(5, timeout=5000)
        check("opened again, its notes are marked on the map", "aq-open" in (note(p, "Gravitational softening").get_attribute("class") or ""))
        p.once("dialog", lambda d: d.accept())
        with p.expect_response(lambda r: "/api/agents/sessions/" in r.url and r.request.method == "DELETE") as gone:
            panel.get_by_role("button", name="Delete", exact=True).click()
        check("the server deleted it", gone.value.status == 200, f"{gone.value.status} {gone.value.text()[:200]}")
        expect(panel.get_by_text("Agents at work")).to_have_count(0, timeout=5000)
        log = TMP / "data/rdstudio/learners"
        kept = "".join(f.read_text() for f in log.rglob("agents.jsonl"))
        check("deleted: nothing of it is left in the log", kept.strip() == "", kept[:200])
        check("the log is outside the repository", not list(ROOT.rglob("agents.jsonl")))
        # The other way (T109): something sent from the app, taken by the agent when it asks.
        note(p, "Gravitational softening").click()
        panel.locator(".cm-content").click()
        p.keyboard.type("Say what this costs at short range.")
        panel.get_by_role("button", name="Send to agent").click()
        row = panel.locator(".aq-sent").first
        expect(row).to_contain_text("waiting for an agent to ask", timeout=5000)
        check("what was sent is listed as waiting, with where it was sent from", "Say what this costs" in row.inner_text() and "Gravitational softening" in row.inner_text(), row.inner_text())
        told = subprocess.run([*MAIN, "brief"], env=ENV, capture_output=True, text=True).stdout
        check("the agent's brief says something waits", "from_developer" in told, told[-300:])
        got = agent.call("from_developer")
        check("the agent is given it, with the note", "Say what this costs at short range." in got and "/concepts/softening.md" in got, got)
        check("and only once", agent.call("from_developer").startswith("Nothing waits"))
        panel.get_by_role("button", name="Questions").click()
        expect(panel.locator(".aq-sent").first).to_contain_text("taken by claude-code 2.1", timeout=8000)
        check("the app shows who took it", True)
        check("no page errors", not errors, str(errors))
        browser.close()
finally:
    if agent:
        agent.close()
    server.terminate()
failed = [n for n, ok in results if not ok]
print(f"{len(results) - len(failed)} of {len(results)} passed")
sys.exit(1 if failed else 0)
