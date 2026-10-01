"""End to end: editing notes in the dashboard, in headless Chromium, against
a real rdstudio serve on a throwaway copy of the differential geometry test
bed (RDSTUDIO_BENCH_DG, or ~/Repositories/differential-geometry), at desktop
and phone sizes. Run with: mise run e2e

Screenshots go to .e2e/ for a person to look at; the checks print PASS/FAIL.
"""
import difflib, os, re, shutil, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
DG = Path(os.environ.get("RDSTUDIO_BENCH_DG", Path.home() / "Repositories/differential-geometry"))
if (DG / "knowledge").is_dir() is False and DG.name == "knowledge":
    DG = DG.parent
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
ROOT = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-")) / "project"
shutil.copytree(DG, ROOT, ignore=shutil.ignore_patterns(".rdstudio"))
NOTE = ROOT / "knowledge/forms/orientation.md"
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
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

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    errors = []

    def page_for(**kw):
        ctx = browser.new_context(**kw)
        p = ctx.new_page()
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.on("console", lambda m: m.type == "error" and errors.append(m.text))
        p.on("dialog", lambda d: d.accept())
        return ctx, p

    # ---------------------------------------------------------------- desktop
    ctx, p = page_for(viewport={"width": 1280, "height": 860})
    p.goto(URL + "?nosw#/k/forms/orientation")
    p.wait_for_selector("h1")
    edit = p.get_by_role("button", name="Edit")
    check("Edit button shown when served", edit.is_visible())
    before = NOTE.read_text()
    edit.click()
    p.wait_for_selector(".cm-content")
    p.screenshot(path=str(OUT / "edit-desktop-open.png"))
    check("editor shows the note's text", "orientation" in p.inner_text(".cm-content").lower())

    # A small edit at the end of one line.
    line = p.locator(".cm-line", has_text="Examples").first
    line.click()
    p.keyboard.press("End")
    p.keyboard.press("Enter"); p.keyboard.press("Enter")
    p.keyboard.type("Every Lie group is orientable.")
    expect(p.locator(".edit-status")).to_have_text("Unsaved changes")
    p.keyboard.press("Control+s")
    expect(p.locator(".edit-status")).to_have_text("Saved", timeout=5000)
    after = NOTE.read_text()
    check("saved to disk", "Every Lie group is orientable." in after)
    removed = [l for l in difflib.ndiff(before.split("\n"), after.split("\n")) if l.startswith("- ")]
    added = [l for l in difflib.ndiff(before.split("\n"), after.split("\n")) if l.startswith("+ ")]
    stamp = lambda l: l[2:].startswith(("generated:", "  by:", "  at:"))
    check("nothing removed but the old generated stamp", all(stamp(l) for l in removed), str(removed))
    check("added: the new paragraph, a blank line and the stamp", sorted(l[2:] for l in added if not stamp(l)) == ["", "Every Lie group is orientable."], str(added))

    # Live preview: markup hidden off the cursor's line, shown on it.
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing)")
    untouched = NOTE.read_text()
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    p.evaluate("document.activeElement.blur()")  # no line is being edited
    heading = p.locator(".cm-line.cm-lp-h1", has_text="Definition").first
    # The editor notices the focus leaving a moment after the blur.
    expect(heading).not_to_have_text(re.compile(r"^#"), timeout=3000)
    check("live preview: headings are set as headings, without the #", heading.count() == 1 and not heading.inner_text().startswith("#"))
    para = p.locator(".cm-line", has_text="is a continuous choice").first
    check("live preview: ** hidden off the cursor's line", "**" not in para.inner_text(), para.inner_text())
    link = p.locator(".cm-lp-link", has_text="exterior power").first
    check("live preview: links show their text, not the address", link.count() == 1 and "/foundations/" not in p.locator(".cm-line", has=link).first.inner_text())
    para.click()
    check("live preview: the markup shows on the line being edited", "**orientation**" in p.locator(".cm-line", has_text="is a continuous choice").first.inner_text())
    p.screenshot(path=str(OUT / "edit-desktop-live.png"))
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing)")
    check("opening and closing the live preview changes nothing", NOTE.read_text() == untouched)

    # Linking: [[ offers notes by title.
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    p.locator(".cm-line", has_text="Examples").first.click()
    p.keyboard.press("End")
    p.keyboard.press("Enter"); p.keyboard.press("Enter")
    p.keyboard.type("See [[Stokes")
    p.wait_for_selector(".cm-tooltip-autocomplete li", timeout=5000)
    check("[[ suggests notes by title", "Stokes' theorem" in p.inner_text(".cm-tooltip-autocomplete"))
    p.screenshot(path=str(OUT / "edit-desktop-link.png"))
    p.keyboard.press("Enter")
    p.keyboard.type(".")
    p.keyboard.press("Control+s")
    expect(p.locator(".edit-status")).to_have_text("Saved", timeout=5000)
    check("choosing one inserts a Markdown link to the note", "See [Stokes' theorem](/forms/stokes-theorem.md)." in NOTE.read_text(), [l for l in NOTE.read_text().split("\n") if l.startswith("See")])

    # Source: the Markdown as written.
    p.get_by_role("button", name="Source").click()
    check("Source shows the Markdown as written", p.locator(".cm-lp-h1").count() == 0 and p.locator(".cm-line", has_text="# Definition").count() == 1)
    p.get_by_role("button", name="Source").click()  # back to the live preview, which is remembered
    after = NOTE.read_text()

    # A selection is clearly visible in every theme, dark ones included.
    p.locator(".cm-line", has_text="Examples").first.click()
    p.keyboard.press("Home"); p.keyboard.press("Shift+ArrowDown"); p.keyboard.press("Shift+End")
    weak = []
    for look in ["studio", "notebook", "map", "space", "cyber"]:
        for mode in ["light", "dark"]:
            p.evaluate(f"""() => {{ document.getElementById('theme-css').href = 'themes/{look}.css'; document.documentElement.dataset.mode = '{mode}'; }}""")
            p.wait_for_timeout(150)
            # Contrast between the selection (over the paper) and the paper itself.
            ratio = p.evaluate("""() => {
              const c = document.createElement('canvas').getContext('2d');
              const rgb = (css) => { c.fillStyle = '#000'; c.fillStyle = css; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; };
              const cs = getComputedStyle(document.documentElement);
              const paper = rgb(cs.getPropertyValue('--paper').trim());
              const sel = getComputedStyle(document.querySelector('.cm-selectionBackground')).backgroundColor;
              c.fillStyle = cs.getPropertyValue('--paper').trim(); c.fillRect(0, 0, 1, 1);
              c.fillStyle = sel; c.fillRect(0, 0, 1, 1);
              const over = [...c.getImageData(0, 0, 1, 1).data];
              const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
              const [a, b] = [lum(paper), lum(over)].sort((x, y) => y - x);
              return (a + 0.05) / (b + 0.05);
            }""")
            if ratio < 1.5: weak.append(f"{look} {mode}: {ratio:.2f}")
    p.evaluate("() => { document.getElementById('theme-css').href = 'themes/studio.css'; delete document.documentElement.dataset.mode; }")
    check("a selection stands out from the page in every theme and mode", not weak, ", ".join(weak))
    p.keyboard.press("ArrowRight")

    # Details: the title.
    title = p.get_by_label("Title")
    title.fill("Orientation of manifolds")
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing) h1")
    time.sleep(0.5)
    t = NOTE.read_text()
    check("title saved, frontmatter edited in place", "title: Orientation of manifolds" in t and t.count("\n") == after.count("\n"))
    expect(p.locator(".doc-head h1")).to_have_text("Orientation of manifolds", timeout=6000)
    check("the page shows the new title without reloading", True)
    expect(p.locator(".prose")).to_contain_text("Every Lie group is orientable.", timeout=6000)
    check("the page shows the new text", True)
    p.screenshot(path=str(OUT / "edit-desktop-after.png"))

    # Conflict: an agent writes while the editor is open.
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    p.locator(".cm-line", has_text="Examples").first.click()
    p.keyboard.press("End")
    p.keyboard.type(" My sentence.")
    NOTE.write_text(NOTE.read_text() + "\nAn agent's addition.\n")
    p.get_by_role("button", name="Save", exact=True).click()
    p.wait_for_selector("section.edit-conflict")
    check("a save over a changed note is refused and shown", "changed since you opened it" in p.inner_text("section.edit-conflict"))
    check("the agent's text is untouched", "An agent's addition." in NOTE.read_text() and "My sentence." not in NOTE.read_text())
    p.get_by_role("button", name="Compare").click()
    p.screenshot(path=str(OUT / "edit-desktop-conflict.png"))
    p.get_by_role("button", name="Keep mine").click()
    expect(p.locator(".edit-status")).to_have_text("Saved", timeout=5000)
    check("keep mine saves over the current version", "My sentence." in NOTE.read_text())

    # A draft survives a reload.
    p.locator(".cm-line", has_text="Examples").first.click()
    p.keyboard.press("End")
    p.keyboard.type(" Draft words.")
    time.sleep(0.8)  # the draft is kept a moment after typing
    p.reload()
    p.wait_for_selector("h1")
    p.get_by_role("button", name="Edit").click()
    p.wait_for_selector(".cm-content")
    check("an unsaved draft is restored", "Draft words." in p.inner_text(".cm-content") and "Restored" in p.inner_text(".editing"))
    check("the draft was not saved to disk", "Draft words." not in NOTE.read_text())
    p.get_by_role("button", name="Cancel").click()
    p.wait_for_selector("article.doc:not(.editing)")
    ctx.close()

    # ---------------------------------------------------------------- phone
    ctx, p = page_for(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    p.goto(URL + "?nosw#/k/forms/orientation")
    p.wait_for_selector("h1")
    p.get_by_role("button", name="Edit").tap()
    p.wait_for_selector(".cm-content")
    p.screenshot(path=str(OUT / "edit-phone-open.png"))
    box = p.get_by_role("button", name="Done").bounding_box()
    check("phone: buttons are at least 40px tall", box and box["height"] >= 40, str(box))
    sw = p.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scrolling", sw <= 390, str(sw))
    p.locator(".cm-line", has_text="Examples").first.tap()
    p.keyboard.press("End")
    p.keyboard.type(" Typed on a phone.")
    p.get_by_role("button", name="Done").tap()
    p.wait_for_selector("article.doc:not(.editing)")
    time.sleep(0.5)
    check("phone: saved", "Typed on a phone." in NOTE.read_text())
    p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    ctx.close()
    browser.close()

server.terminate()
shutil.rmtree(ROOT.parent, ignore_errors=True)
# The browser logs the deliberate conflict's 409; anything else is a problem.
unexpected = [e for e in errors if "409" not in e]
check("no unexpected console errors", not unexpected, str(unexpected[:5]))
print(f"{sum(ok for _, ok in results)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(0 if all(ok for _, ok in results) else 1)
