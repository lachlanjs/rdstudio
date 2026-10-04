"""End to end: creating, moving and deleting notes and folders from the
dashboard, in headless Chromium against a real rdstudio serve on a throwaway
copy of the differential geometry test bed. The litmus test, rehearsed: a
Philosophy folder (a new bubble on the map) with a Motivation note in it.
Run with: mise run e2e
"""
import json, os, shutil, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

REPO = Path(__file__).resolve().parent.parent
DG = Path(os.environ.get("RDSTUDIO_BENCH_DG", Path.home() / "Repositories/differential-geometry"))
OUT = REPO / ".e2e"
OUT.mkdir(exist_ok=True)
ROOT = Path(tempfile.mkdtemp(prefix="rdstudio-e2e-")) / "project"
shutil.copytree(DG, ROOT, ignore=shutil.ignore_patterns(".rdstudio"))
K = ROOT / "knowledge"
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://localhost:{PORT}/"
server = subprocess.Popen(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "serve", "--port", str(PORT)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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

def broken_links():
    """Broken links, as the core reports them (rdstudio check)."""
    out = subprocess.run(["node", str(REPO / "packages/cli/src/main.ts"), "-C", str(ROOT), "check", "-w"], capture_output=True, text=True).stdout
    return sorted(l for l in out.splitlines() if "broken link" in l)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    errors = []
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type == "error" and errors.append(m.text))
    p.on("dialog", lambda d: d.accept())
    broken_before = broken_links()

    # A new folder from the home page: a new bubble.
    p.goto(URL + "?nosw#/library")
    p.get_by_role("button", name="Add to the knowledge base").click()
    p.get_by_role("menuitem", name="New folder").click()
    p.get_by_label("Name").fill("Philosophy")
    p.get_by_label("Description").fill("Why this project exists and what it believes about learning.")
    p.screenshot(path=str(OUT / "reshape-new-folder.png"))
    p.get_by_role("button", name="Create").click()
    p.wait_for_url("**#/d/philosophy")
    expect(p.locator(".doc-head h1")).to_have_text("Philosophy", timeout=6000)
    check("new folder: made, with its overview, and opened", (K / "philosophy/overview.md").is_file())
    check("new folder: the overview carries the description", "what it believes about learning" in (K / "philosophy/overview.md").read_text())

    # A new note in it, from the folder's menu in the tree, opens straight in the editor.
    p.get_by_role("button", name="Actions for the folder Philosophy").click()
    p.get_by_role("menuitem", name="New note here").click()
    p.get_by_label("Title").fill("Motivation")
    p.get_by_label("Type").fill("Idea")
    check("new note: the file name follows the title", p.get_by_label("File name").input_value() == "motivation")
    p.get_by_role("button", name="Create and edit").click()
    p.wait_for_url("**#/k/philosophy/motivation")
    p.wait_for_selector(".cm-content")
    check("new note: opens in the editor", True)
    p.locator(".cm-content").click()
    p.keyboard.type("Understanding should keep pace with what we build. See [[Stokes")
    p.wait_for_selector(".cm-tooltip-autocomplete li")
    p.keyboard.press("Enter")
    p.keyboard.type(".")
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing)")
    text = (K / "philosophy/motivation.md").read_text()
    check("new note: written and saved", "type: Idea" in text and "title: Motivation" in text and "[Stokes' theorem](/forms/stokes-theorem.md)" in text, text)
    expect(p.locator(".prose")).to_contain_text("Understanding should keep pace", timeout=6000)

    # On the map: the new bubble.
    p.goto(URL + "?nosw#/map")
    p.wait_for_timeout(2500)
    check("the map shows the Philosophy bubble", p.locator("svg text", has_text="Philosophy").count() > 0)
    p.screenshot(path=str(OUT / "reshape-map.png"))

    # Moving a much-linked note into the folder: no link breaks.
    p.goto(URL + "?nosw#/k/forms/orientation")
    p.wait_for_selector(".doc-head h1")
    p.get_by_role("button", name="Move").click()
    p.get_by_role("dialog").get_by_label("Folder").fill("philosophy")
    p.screenshot(path=str(OUT / "reshape-move.png"))
    note_says = p.locator("dialog p.section-note").inner_text()
    p.get_by_role("dialog").get_by_role("button", name="Move").click()
    p.wait_for_url("**#/k/philosophy/orientation")
    check("move: the dialog said how many notes' links follow", "updated to the new place" in note_says, note_says)
    check("move: the file moved", (K / "philosophy/orientation.md").is_file() and not (K / "forms/orientation.md").exists())
    check("move: no link broke", broken_links() == broken_before, str(set(broken_links()) ^ set(broken_before)))
    expect(p.locator(".doc-head h1")).to_have_text("Orientation", timeout=6000)

    # Moving the whole folder: links to everything in it follow.
    p.goto(URL + "?nosw#/d/philosophy")
    p.wait_for_selector(".doc-head h1")
    p.get_by_role("button", name="Actions for the folder Philosophy").click()
    p.get_by_role("menuitem", name="Move or rename…").click()
    p.get_by_role("dialog").get_by_label("New place").fill("foundations/philosophy")
    p.get_by_role("dialog").get_by_role("button", name="Move").click()
    p.wait_for_url("**#/d/foundations/philosophy")
    check("folder move: everything moved", (K / "foundations/philosophy/orientation.md").is_file() and not (K / "philosophy").exists())
    check("folder move: no link broke", broken_links() == broken_before, str(set(broken_links()) ^ set(broken_before)))

    # Deleting: the dialog names what links to it; those links then break.
    p.goto(URL + "?nosw#/k/foundations/philosophy/orientation")
    p.wait_for_selector(".doc-head h1")
    p.get_by_role("button", name="Delete").click()
    listed = p.locator("dialog .linklist li").all_inner_texts()
    p.screenshot(path=str(OUT / "reshape-delete.png"))
    confirm_button = p.get_by_role("dialog").get_by_role("button", name="Delete")
    check("delete: the button waits for the confirmation", confirm_button.is_disabled())
    p.get_by_role("dialog").get_by_label("Yes, delete this note").check()
    confirm_button.click()
    p.wait_for_url("**#/d/foundations/philosophy")
    check("delete: the dialog listed the notes linking to it", len(listed) >= 3, str(listed))
    check("delete: the file is gone", not (K / "foundations/philosophy/orientation.md").exists())
    newly = set(broken_links()) - set(broken_before)
    check("delete: exactly those notes now have broken links", len(newly) >= len(listed), str(newly))

    # From the tree: a note in a folder through its menu, then deleting a
    # folder with notes in it, confirmed twice.
    p.goto(URL + "?nosw#/d/foundations/philosophy")
    p.wait_for_selector(".doc-head h1")
    row = p.locator(".tree summary", has=p.locator("a", has_text="Philosophy"))
    row.hover()
    row.get_by_role("button", name="Actions for the folder Philosophy").click()
    p.get_by_role("menuitem", name="New note here").click()
    p.get_by_role("dialog").get_by_label("Title").fill("Learning in public")
    p.get_by_role("button", name="Create and edit").click()
    p.wait_for_url("**#/k/foundations/philosophy/learning-in-public")
    p.wait_for_selector(".cm-content")
    check("tree: a new note from a folder's menu", (K / "foundations/philosophy/learning-in-public.md").is_file())
    p.get_by_role("button", name="Done").click()
    p.wait_for_selector("article.doc:not(.editing)")

    item = p.locator(".tree li.item", has=p.locator("a", has_text="Learning in public"))
    item.hover()
    item.get_by_role("button", name="Actions for Learning in public").click()
    p.screenshot(path=str(OUT / "reshape-tree-menu.png"))
    check("tree: a note's menu offers move and delete", p.get_by_role("menuitem").all_inner_texts() == ["Move or rename…", "Delete…"])
    p.keyboard.press("Escape")
    check("tree: Escape closes the menu", p.locator(".row-menu-list:popover-open").count() == 0)

    row.hover()
    row.get_by_role("button", name="Actions for the folder Philosophy").click()
    p.get_by_role("menuitem", name="Delete…").click()
    dialog = p.get_by_role("dialog")
    listed = dialog.locator("ul.doomed li").count()
    p.screenshot(path=str(OUT / "reshape-tree-delete-folder.png"))
    check("tree: deleting a folder lists every note in it", listed == 3, str(listed))
    check("tree: and waits for the confirmation", dialog.get_by_role("button", name="Delete").is_disabled())
    dialog.get_by_role("button", name="Cancel").click()
    check("tree: cancelling deletes nothing", (K / "foundations/philosophy/overview.md").is_file())
    row.hover()
    row.get_by_role("button", name="Actions for the folder Philosophy").click()
    p.get_by_role("menuitem", name="Delete…").click()
    dialog.get_by_label("Yes, delete the folder and its 3 notes").check()
    dialog.get_by_role("button", name="Delete").click()
    p.wait_for_url("**#/d/foundations")
    check("tree: the folder and its notes are gone", not (K / "foundations/philosophy").exists())
    expect(p.locator(".tree summary", has=p.locator("a", has_text="Philosophy"))).to_have_count(0, timeout=6000)
    check("tree: and gone from the tree", True)
    ctx.close()

    # On a phone: the dialog rises from the bottom, within reach.
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(URL + "?nosw#/d/foundations")
    p.wait_for_selector(".doc-head h1")
    check("phone: no sideways scrolling", p.evaluate("document.documentElement.scrollWidth") <= 390)
    # The tree's menus: buttons always shown on touch, the menu at the bottom.
    p.locator(".menu").tap()  # open the drawer with the tree
    p.wait_for_timeout(300)
    btn = p.get_by_role("button", name="Add to the knowledge base")
    check("phone: the tree's menu buttons are visible and big enough", btn.is_visible() and btn.bounding_box()["height"] >= 34, str(btn.bounding_box()))
    btn.tap()
    p.wait_for_timeout(200)
    mbox = p.locator(".row-menu-list").bounding_box()
    p.screenshot(path=str(OUT / "reshape-phone-tree-menu.png"))
    check("phone: the menu sits at the bottom, full width", mbox and mbox["width"] >= 389 and abs(mbox["y"] + mbox["height"] - 844) < 2, str(mbox))
    p.get_by_role("menuitem", name="New note").tap()
    box = p.locator("dialog.sheet").bounding_box()
    p.screenshot(path=str(OUT / "reshape-phone-new-note.png"))
    check("phone: the dialog sits at the bottom, full width", box and box["width"] >= 389 and abs(box["y"] + box["height"] - 844) < 2, str(box))
    p.get_by_role("button", name="Cancel").tap()
    ctx.close()
    browser.close()

server.terminate()
shutil.rmtree(ROOT.parent, ignore_errors=True)
unexpected = [e for e in errors if "409" not in e]
check("no unexpected console errors", not unexpected, str(unexpected[:5]))
print(f"{sum(ok for _, ok in results)}/{len(results)} passed; screenshots in {OUT}")
sys.exit(0 if all(ok for _, ok in results) else 1)
