"""End to end: writing comfortably (T30 slice 4), in headless Chromium against
a real rdstudio serve on a throwaway copy of the differential geometry test
bed: maths, tables and diagrams drawn in the editor; the formatting toolbar
and its shortcuts; the details form as a sheet on a phone; and making a new
folder and note from the map (the litmus test's "Philosophy").
Run with: mise run e2e

Screenshots go to .e2e/ for a person to look at; the checks print PASS/FAIL.
"""
import os, shutil, socket, subprocess, sys, tempfile, time
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
NOTE = ROOT / "knowledge/forms/blocks.md"
NOTE.write_text("""---
type: Note
title: Blocks
description: Maths, a table and a diagram, for the editor's live preview.
---

# Volume

The volume form $\\omega = dx^1 \\wedge \\dots \\wedge dx^n$ is nowhere zero.

$$
\\int_M d\\omega = \\int_{\\partial M} \\omega
$$

| Form | Degree |
|---|---|
| $f$ | 0 |
| $df$ | 1 |

```mermaid
graph LR
  A[Chart] --> B[Atlas]
```

Plain words here.
""")
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

def body(path):
    return path.read_text().split("\n---\n", 1)[1]

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

    def open_editor(p, note="forms/blocks"):
        p.goto(URL + f"?nosw#/k/{note}")
        p.wait_for_selector("h1")
        p.get_by_role("button", name="Edit").click()
        p.wait_for_selector(".cm-content")

    # ---------------------------------------------------- blocks, desktop
    ctx, p = page_for(viewport={"width": 1280, "height": 900})
    untouched = NOTE.read_text()
    open_editor(p)
    p.locator(".cm-line", has_text="Plain words").click()  # the cursor away from the blocks
    check("inline maths drawn by KaTeX off the cursor's line", p.locator(".cm-lp-imaths .katex").count() >= 1)
    check("display maths drawn as a block", p.locator(".cm-lp-maths:not(.cm-lp-beneath) .katex-display").count() == 1)
    check("a table drawn as a table", p.locator(".cm-lp-table table th", has_text="Degree").count() == 1)
    expect(p.locator(".cm-lp-diagram svg").first).to_be_visible(timeout=15000)
    check("a Mermaid diagram drawn", p.locator(".cm-lp-diagram svg").count() == 1)
    p.screenshot(path=str(OUT / "compose-blocks.png"))

    p.locator(".cm-lp-maths").first.click()
    check("clicking a formula shows its source to edit", p.locator(".cm-line", has_text="\\int_M").count() == 1)
    check("…with its rendering kept beneath while editing", p.locator(".cm-lp-beneath .katex-display").count() == 1)
    p.locator(".cm-line", has_text="\\int_M").click()
    p.keyboard.press("End")
    p.keyboard.type(" + 0")
    expect(p.locator(".cm-lp-beneath .katex-display")).to_contain_text("0")
    check("the rendering beneath follows the typing", True)
    p.keyboard.press("Control+z")
    p.locator(".cm-lp-table").click()
    check("clicking a table shows its Markdown", p.locator(".cm-line", has_text="|---|---|").count() == 1)
    p.get_by_role("button", name="Cancel").click()
    p.wait_for_selector("article.doc:not(.editing)")
    check("drawing blocks changes nothing in the file", NOTE.read_text() == untouched)
    # Found on the way: the note page dropped every diagram with an arrow.
    expect(p.locator(".prose .mermaid-block svg").first).to_be_visible(timeout=15000)
    check("the note page draws a flowchart (with -->) too", p.locator(".prose .mermaid-error").count() == 0)

    # ------------------------------------------------- toolbar and shortcuts
    open_editor(p)
    bar = p.get_by_role("toolbar", name="Formatting")
    check("formatting toolbar shown under the editing bar", bar.is_visible())
    check("details beside the editor on a desktop, no Details button", p.locator("#edit-details").is_visible() and not p.get_by_role("button", name="Details").is_visible())
    p.locator(".cm-line", has_text="Plain words").click()
    p.keyboard.press("End")
    p.keyboard.press("Enter"); p.keyboard.press("Enter")
    p.keyboard.type("strong")
    p.keyboard.press("Shift+Control+ArrowLeft")
    bar.get_by_role("button", name="Bold").click()
    p.keyboard.press("End")
    p.keyboard.type(" and ")
    p.keyboard.press("Control+i")
    p.keyboard.type("slanted")
    p.keyboard.press("End")
    p.keyboard.press("Enter"); p.keyboard.press("Enter")
    p.keyboard.type("Section")
    bar.get_by_role("button", name="Heading").click()
    bar.get_by_role("button", name="Heading").click()
    p.keyboard.press("End")
    p.keyboard.press("Enter")
    p.keyboard.type("one")
    bar.get_by_role("button", name="Bulleted list").click()
    p.keyboard.press("End")
    p.keyboard.type(" x")
    p.keyboard.press("Shift+ArrowLeft")
    bar.get_by_role("button", name="Maths").click()
    p.keyboard.press("End")
    p.keyboard.type(" see ")
    bar.get_by_role("button", name="Link to a note").click()
    p.keyboard.type("Stokes")
    expect(p.locator(".cm-tooltip-autocomplete")).to_contain_text("Stokes' theorem")
    time.sleep(0.2)  # suggestions ignore keys for a moment after appearing, by design
    p.keyboard.press("Enter")
    check("the editor kept the focus through the toolbar", p.evaluate("document.activeElement?.classList.contains('cm-content')"))
    time.sleep(0.6)  # a separate step in the history, as a pause makes it
    p.keyboard.type(" gone")
    bar.get_by_role("button", name="Undo").click()
    p.keyboard.press("Control+s")
    expect(p.locator(".edit-status")).to_have_text("Saved", timeout=5000)
    text = body(NOTE)
    check("Bold wraps the selection in **", "**strong** and *slanted*" in text, text[-200:])
    check("Heading, pressed twice, makes ##", "\n## Section\n" in text, text[-200:])
    check("list and maths", "- one $x$ see [Stokes' theorem](/forms/stokes-theorem.md)" in text, repr(text[-160:]))
    check("Undo undid the last typing", " gone" not in text)
    p.screenshot(path=str(OUT / "compose-toolbar.png"))
    p.get_by_role("button", name="Done").click()
    ctx.close()

    # ---------------------------------------------------------------- phone
    phone = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}
    ctx, p = page_for(**phone)
    open_editor(p)
    details = p.get_by_role("button", name="Details")
    check("phone: details are a sheet, closed until asked for", details.is_visible() and not p.locator("#edit-details").is_visible())
    bar = p.get_by_role("toolbar", name="Formatting")
    box = bar.bounding_box()
    check("phone: toolbar at the bottom of the screen", box and abs(box["y"] + box["height"] - 844) < 2, str(box))
    first = bar.get_by_role("button").first.bounding_box()
    check("phone: toolbar buttons at least 44px", first and first["height"] >= 44 and first["width"] >= 44, str(first))
    p.screenshot(path=str(OUT / "compose-phone.png"))
    details.tap()
    sheet = p.locator("#edit-details")
    expect(sheet).to_be_visible()
    time.sleep(0.4)  # it slides up
    sb = sheet.bounding_box()
    check("phone: the sheet rises from the bottom, within the screen", sb and sb["y"] > 100 and abs(sb["y"] + sb["height"] - 844) < 2, str(sb))
    check("phone: the toolbar steps aside for the sheet", not bar.is_visible())
    p.screenshot(path=str(OUT / "compose-phone-details.png"))
    title = sheet.get_by_label("Title")
    title.fill("Blocks on a phone")
    sheet.get_by_role("button", name="Done").tap()
    expect(sheet).to_be_hidden()
    check("phone: the toolbar is back once the sheet closes", bar.is_visible())
    sw = p.evaluate("document.documentElement.scrollWidth")
    check("phone: no sideways scrolling", sw <= 390, str(sw))
    p.get_by_role("button", name="Done").tap()
    p.wait_for_selector("article.doc:not(.editing)")
    time.sleep(0.3)
    check("phone: the title from the sheet saved", "title: Blocks on a phone" in NOTE.read_text())
    ctx.close()

    # ------------------------------------------------ creating from the map
    ctx, p = page_for(viewport={"width": 1280, "height": 860})
    p.goto(URL + "?nosw#/map")
    create = p.get_by_role("group", name="Create here")
    expect(create).to_be_visible(timeout=10000)
    create.get_by_role("button", name="New folder").click()
    dialog = p.locator("dialog[open]")
    dialog.get_by_label("Name").fill("Philosophy")
    dialog.get_by_label("Description").fill("Why rdstudio exists, and what it is for.")
    dialog.get_by_role("button", name="Create").click()
    p.wait_for_url("**#/map/philosophy", timeout=10000)
    check("map: a new folder is made from the map", (ROOT / "knowledge/philosophy/overview.md").exists())
    expect(p.locator("text.m-text", has_text="Philosophy").first).to_be_attached(timeout=10000)
    check("map: and appears on it, in focus", True)
    p.screenshot(path=str(OUT / "compose-map-folder.png"))
    create.get_by_role("button", name="New note").click()
    dialog = p.locator("dialog[open]")
    check("map: a new note goes in the folder in focus", "Philosophy" in dialog.locator("h2").inner_text(), dialog.locator("h2").inner_text())
    dialog.get_by_label("Title").fill("Motivation")
    dialog.get_by_role("button", name="Create and edit").click()
    p.wait_for_selector(".cm-content")
    check("map: the new note opens to be written", (ROOT / "knowledge/philosophy/motivation.md").exists())
    p.keyboard.type("Knowledge should be a place you can walk around in.")
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing)")
    p.goto(URL + "?nosw#/map/philosophy")
    expect(p.locator("text.m-text", has_text="Motivation").first).to_be_attached(timeout=10000)
    check("map: the note is on the map", True)
    p.screenshot(path=str(OUT / "compose-map-note.png"))
    ctx.close()
    browser.close()

server.terminate()
shutil.rmtree(ROOT.parent, ignore_errors=True)
check("no console errors", not errors, str(errors[:5]))
print(f"{sum(ok for _, ok in results)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(0 if all(ok for _, ok in results) else 1)
