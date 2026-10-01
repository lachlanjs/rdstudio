"""End to end: a tunnel or proxy that asks you to sign in again (as a VS Code
dev tunnel does when its sign-in expires) must not leave the dashboard stuck
on its offline copy. A proxy in front of rdstudio serve starts redirecting
every request to a login page on another origin; the dashboard, with its
service worker in control, must say so ("Sign in"), and following that must
reach the login page and come back to a working dashboard.
Run with: mise run e2e
"""
import shutil, socket, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
ROOT = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-")) / "project"
shutil.copytree(REPO / "fixtures/bundles/basics", ROOT / "knowledge")
(ROOT / "rdstudio.toml").write_text("[project]\ntitle = 'Sign-in test'\n")

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

SERVE, PROXY, LOGIN = free_port(), free_port(), free_port()
wall = {"on": False}

class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if wall["on"]:
            self.send_response(302)
            self.send_header("Location", f"http://127.0.0.1:{LOGIN}/login?rd={self.path}")
            self.end_headers()
            return
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{SERVE}{self.path}") as r:
                body, status, headers = r.read(), r.status, r.headers
        except urllib.error.HTTPError as e:
            body, status, headers = e.read(), e.code, e.headers
        self.send_response(status)
        for k in ("Content-Type", "Cache-Control"):
            if headers.get(k): self.send_header(k, headers[k])
        self.end_headers()
        self.wfile.write(body)

class Login(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):  # signing in: lift the wall and go back
        wall["on"] = False
        rd = self.path.split("rd=", 1)[1] if "rd=" in self.path else "/"
        self.send_response(302)
        self.send_header("Location", f"http://127.0.0.1:{PROXY}{rd}")
        self.end_headers()

server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(SERVE)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for port, handler in ((PROXY, Proxy), (LOGIN, Login)):
    threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever, daemon=True).start()
for _ in range(100):
    try:
        socket.create_connection(("127.0.0.1", SERVE), timeout=0.2).close()
        break
    except OSError:
        time.sleep(0.1)

results = []
def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))

URL = f"http://127.0.0.1:{PROXY}/"
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    p = browser.new_page()
    p.goto(URL)
    p.wait_for_selector(".live")
    p.wait_for_function("navigator.serviceWorker.controller !== null || new Promise(r => setTimeout(() => r(false), 4000))")
    p.reload()  # now controlled by the service worker
    p.wait_for_selector(".live")
    check("the service worker controls the page", p.evaluate("navigator.serviceWorker.controller !== null"))
    expect(p.locator(".live")).to_have_text("Live")

    wall["on"] = True  # the tunnel's sign-in expires
    expect(p.locator(".live.signin")).to_have_text("Sign in", timeout=10000)
    check("the dashboard says it needs a sign-in, not just 'offline'", True)
    p.screenshot(path=str(OUT / "signin-needed.png"))

    p.locator(".live.signin").click()
    p.wait_for_url(f"http://127.0.0.1:{PROXY}/*", timeout=10000)
    p.wait_for_selector(".live")
    expect(p.locator(".live")).to_have_text("Live", timeout=10000)
    check("following it reaches the sign-in page and comes back working", not wall["on"])
    check("the address is tidied", "signin" not in p.url, p.url)
    browser.close()

server.terminate()
shutil.rmtree(ROOT.parent, ignore_errors=True)
print(f"{sum(ok for _, ok in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok in results) else 1)
