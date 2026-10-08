// The Axis panel's place (T93, T96): beside what it is about where the frame
// is wide and wider than it is tall, below it otherwise; open or folded; and
// how much of the frame it takes, set by dragging its grip or with the arrow
// keys. The Atlas and the note editor share this, each remembering its own.
// It only sets classes and one variable; app.css does the rest:
// on the shell, `side` or `below`, and `axis-open`; on the panel, `folded`,
// `dragging` and --axis-size.

export const WIDE = 900; // beside from this width, where the frame is wider than tall

/**
 * @param {{ panel: HTMLElement, grip: HTMLElement, key: string, below?: number, available?: () => boolean,
 *   changed?: (now: { open: boolean, side: boolean }) => void }} o
 *   `below`: the share of the frame's height the panel takes below it, until it is resized. `available`: whether
 *   there is a panel to show at all. `changed`: told after each placing.
 */
export function axisDock(o) {
  const { panel, grip } = o;
  let state = { open: false };
  try { const s = JSON.parse(localStorage.getItem(o.key) ?? "null"); if (s && typeof s === "object") state = { ...state, ...s }; } catch { /* no storage */ }
  const remember = () => { try { localStorage.setItem(o.key, JSON.stringify(state)); } catch { /* no storage */ } };
  let shell = null, side = true, watch = null;

  /** The frame: the shell, or as much of it as the window shows (a page that scrolls is taller than the window). */
  const frame = () => { const r = shell.getBoundingClientRect(); return { width: r.width, height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; };
  const limits = (f) => (side ? [280, Math.max(280, f.width - 260)] : [170, Math.max(170, f.height - 150)]);
  function dock() {
    if (!shell) return;
    const f = frame();
    if (!f.width) return;
    side = f.width >= WIDE && f.width > f.height;
    const [least, most] = limits(f), kind = side ? "side" : "below";
    const size = Math.round(Math.max(least, Math.min(most, state[kind] ?? (side ? 400 : f.height * (o.below ?? 0.55)))));
    shell.classList.toggle("side", side);
    shell.classList.toggle("below", !side);
    shell.classList.toggle("axis-open", state.open && (o.available?.() ?? true));
    panel.classList.toggle("folded", !state.open);
    panel.style.setProperty("--axis-size", `${size}px`);
    grip.setAttribute("aria-orientation", side ? "vertical" : "horizontal");
    o.changed?.({ open: !!state.open, side });
  }
  function attach(el) {
    shell = el;
    watch = new ResizeObserver(dock);
    watch.observe(shell);
    addEventListener("resize", dock);
    dock();
  }
  const resize = (size) => { state[side ? "side" : "below"] = size; dock(); };
  grip.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    panel.classList.add("dragging");
    const move = (ev) => { const r = panel.getBoundingClientRect(); resize(side ? r.right - ev.clientX : r.bottom - ev.clientY); };
    const done = () => { panel.classList.remove("dragging"); grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", done); grip.removeEventListener("pointercancel", done); remember(); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", done);
    grip.addEventListener("pointercancel", done);
  });
  grip.addEventListener("keydown", (e) => {
    const more = side ? "ArrowLeft" : "ArrowUp", less = side ? "ArrowRight" : "ArrowDown";
    if (e.key !== more && e.key !== less) return;
    e.preventDefault();
    const now = parseFloat(panel.style.getPropertyValue("--axis-size")) || 0;
    resize(now + (e.key === more ? 24 : -24));
    remember();
  });

  return {
    attach, dock,
    get open() { return !!state.open; },
    get side() { return side; },
    setOpen(on) { state.open = on; remember(); dock(); },
    destroy() { watch?.disconnect(); removeEventListener("resize", dock); },
  };
}
