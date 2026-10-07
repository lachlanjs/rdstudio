// The link control (T79): what a link is, changed without editing its
// Markdown. With the cursor in a link (or the pointer over one), a button
// sits in the margin level with it, joined to the link by a dotted leader
// whose dots run while it is in use. It sets a link's rating (requires,
// uses, see also), and for an artifact or a picture whether it is a link or
// shown in place, and a picture's side. By click, or by keyboard: Alt-L
// opens it; Alt-1, 2, 3 and 0 set a rating at once; Alt-E turns a link into
// an embed and back. It writes only the link's title, or the "!" before it.
//
// With several links selected (T82) the control is for all of them: it says
// how many, and a rating chosen there, or with Alt-1, 2, 3 or 0, is given to
// each. So "rate every link of this list see also" needs no model.

import { syntaxTree } from "@codemirror/language";
import type { ChangeSpec, EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap, type ViewUpdate } from "@codemirror/view";

export type LinkKind = "note" | "artifact" | "image";
export interface LinkAt {
  from: number; to: number; // the whole link, with its "!" if it has one
  embed: boolean;
  url: string; urlTo: number; // where the address ends: a title goes after it
  title: string | null; titleFrom: number; titleTo: number; // the title with its quotes; equal when there is none
  kind: LinkKind;
}
export type Rating = "requires" | "uses" | "see also";
const RATINGS: Rating[] = ["requires", "uses", "see also"];

/** What a link's address points at, as far as the control cares: a note (or folder), an artifact, a picture; null for the web or anything else. */
export function kindOf(url: string): LinkKind | null {
  if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#")) return null;
  const path = url.split("#")[0]!.split("?")[0]!;
  if (/\.html?$/i.test(path)) return "artifact";
  if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(path)) return "image";
  if (/\.md$/i.test(path) || path.endsWith("/")) return "note";
  return null;
}

/** The link or image the position is in (or at either end of), if it is one the control handles. */
export function linkAt(state: EditorState, pos: number): LinkAt | null {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    for (let n: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, side); n; n = n.parent) {
      if (n.name !== "Link" && n.name !== "Image") continue;
      const u = n.getChild("URL");
      if (!u) break;
      const url = state.sliceDoc(u.from, u.to), kind = kindOf(url);
      if (!kind) return null;
      const t = n.getChild("LinkTitle");
      const raw = t ? state.sliceDoc(t.from, t.to) : null;
      return { from: n.from, to: n.to, embed: n.name === "Image", url, urlTo: u.to, title: raw === null ? null : raw.replace(/^["'(]|["')]$/g, ""),
        titleFrom: t ? t.from : u.to, titleTo: t ? t.to : u.to, kind };
    }
  }
  return null;
}

/** A link that can carry a rating: to a note, or to an artifact that is not shown in place. */
export const rateable = (l: LinkAt): boolean => l.kind === "note" || (l.kind === "artifact" && !l.embed);

/** The links in a range that can carry a rating, in order. */
export function linksIn(state: EditorState, from: number, to: number): LinkAt[] {
  const out: LinkAt[] = [];
  syntaxTree(state).iterate({ from, to, enter: (n) => {
    if (n.name !== "Link" && n.name !== "Image") return;
    if (n.from < from || n.to > to) return false; // only links wholly selected
    const l = linkAt(state, n.from + 1);
    if (l && l.from === n.from && rateable(l)) out.push(l);
    return false;
  } });
  return out;
}

/** Give every link the rating (null takes it away). Only titles change. */
export const setTitles = (links: LinkAt[], title: Rating | null): ChangeSpec[] => links.filter((l) => ratingOf(l) !== title).map((l) => setTitle(l, title));

const norm = (t: string | null) => (t ?? "").trim().toLowerCase().replace(/[-_]/g, " ");
/** A link's rating, from its title. */
export const ratingOf = (l: LinkAt): Rating | null => (RATINGS.includes(norm(l.title) as Rating) ? (norm(l.title) as Rating) : norm(l.title) === "seealso" ? "see also" : null);
/** A picture's side, from its title: centre unless it says left. */
export const sideOf = (l: LinkAt): "left" | "center" => (norm(l.title) === "left" ? "left" : "center");

/** Set a link's title (null takes it away). Only the title changes. */
export function setTitle(l: LinkAt, title: string | null): ChangeSpec {
  if (title === null) return { from: l.urlTo, to: l.titleTo, insert: "" };
  return l.titleFrom === l.titleTo ? { from: l.urlTo, insert: ` "${title}"` } : { from: l.titleFrom, to: l.titleTo, insert: `"${title}"` };
}
/** Make it shown in place, or a link: the "!" before it. A picture's side is not a link's rating, and the other way, so the title goes. */
export function setEmbed(l: LinkAt, embed: boolean): ChangeSpec[] {
  if (l.embed === embed) return [];
  const out: ChangeSpec[] = [embed ? { from: l.from, insert: "!" } : { from: l.from, to: l.from + 1, insert: "" }];
  if (l.title !== null && (l.kind === "image" || ratingOf(l) !== null)) out.push(setTitle(l, null));
  return out;
}

interface Choice { label: string; hint: string; on: boolean; run: (view: EditorView, l: LinkAt) => void }
const apply = (view: EditorView, changes: ChangeSpec | ChangeSpec[]) => view.dispatch({ changes, userEvent: "input.link" });

/** What can be chosen for a link, and what it is now. */
export function choices(l: LinkAt): Choice[] {
  const rate: Choice[] = [
    ...RATINGS.map((r): Choice => ({ label: r[0]!.toUpperCase() + r.slice(1), on: ratingOf(l) === r, run: (v, x) => apply(v, setTitle(x, r)),
      hint: r === "requires" ? "This note cannot be followed without it: it shapes the Atlas and the study order" : r === "uses" ? "It draws on it: it shapes the Atlas" : "Related reading: shown, but it does not shape the Atlas" })),
    { label: "Unrated", on: ratingOf(l) === null, run: (v, x) => apply(v, setTitle(x, null)), hint: "No rating: counted as uses" },
  ];
  if (l.kind === "note") return rate;
  const how: Choice[] = [
    { label: "Shown here", on: l.embed, run: (v, x) => apply(v, setEmbed(x, true)), hint: l.kind === "image" ? "The picture is shown in the note" : "The artifact is shown in the note, working" },
    { label: "Link", on: !l.embed, run: (v, x) => apply(v, setEmbed(x, false)), hint: "A link to it; it opens on its own" },
  ];
  if (l.kind === "image") {
    return l.embed ? [...how,
      { label: "Centre", on: sideOf(l) === "center", run: (v, x) => apply(v, setTitle(x, null)), hint: "In the middle, 80% of the text's width" },
      { label: "Left", on: sideOf(l) === "left", run: (v, x) => apply(v, setTitle(x, "left")), hint: "At the left, 80% of the text's width" }] : how;
  }
  return l.embed ? how : [...how, ...rate];
}

/** What can be chosen for several links at once: a rating for all of them. */
export function choicesFor(links: LinkAt[]): Choice[] {
  const all = (r: Rating | null) => links.every((l) => ratingOf(l) === r);
  const n = links.length;
  return [
    ...RATINGS.map((r): Choice => ({ label: r[0]!.toUpperCase() + r.slice(1), on: all(r), run: (v) => apply(v, setTitles(linksIn(v.state, v.state.selection.main.from, v.state.selection.main.to), r)),
      hint: `Rate all ${n} links ${r}` })),
    { label: "Unrated", on: all(null), run: (v) => apply(v, setTitles(linksIn(v.state, v.state.selection.main.from, v.state.selection.main.to), null)), hint: `Take the rating from all ${n} links` },
  ];
}
/** The control's label for several links: how many, and their rating where they share one. */
export function labelFor(links: LinkAt[]): string {
  const first = ratingOf(links[0]!), shared = links.every((l) => ratingOf(l) === first);
  return `${links.length} links, ${shared ? (first ?? "unrated") : "mixed"}`;
}

/** The control's label: what the link is now. */
export function labelOf(l: LinkAt): string {
  if (l.kind === "note") return ratingOf(l) ? ratingOf(l)![0]!.toUpperCase() + ratingOf(l)!.slice(1) : "Unrated";
  if (!l.embed) return ratingOf(l) ? `Link, ${ratingOf(l)}` : "Link";
  return l.kind === "image" ? (sideOf(l) === "left" ? "Shown, left" : "Shown, centre") : "Shown here";
}

const same = (a: LinkAt | null, b: LinkAt | null) => a === b || (!!a && !!b && a.from === b.from && a.to === b.to && a.title === b.title && a.embed === b.embed);

class Control {
  private layer: HTMLElement;
  private button: HTMLButtonElement;
  private menu: HTMLElement;
  private leader: SVGSVGElement;
  private path: SVGPathElement;
  private link: LinkAt | null = null;
  private hover: LinkAt | null = null;
  private many: LinkAt[] = []; // several links selected: the control is for all of them
  private open = false;
  private at = 0; // the choice the keyboard is on

  constructor(readonly view: EditorView) {
    this.layer = document.createElement("div");
    this.layer.className = "cm-link-control";
    this.layer.hidden = true;
    this.leader = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.leader.setAttribute("class", "cm-link-leader");
    this.leader.setAttribute("aria-hidden", "true");
    this.path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this.leader.append(this.path);
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "cm-link-button";
    this.button.setAttribute("aria-haspopup", "menu");
    this.button.addEventListener("mousedown", (e) => e.preventDefault());
    this.button.addEventListener("click", () => this.toggle(!this.open, false));
    this.menu = document.createElement("div");
    this.menu.className = "cm-link-menu";
    this.menu.setAttribute("role", "menu");
    this.menu.hidden = true;
    this.menu.tabIndex = -1; // the menu holds the focus; which choice is current is kept here, not by moving the focus
    this.menu.addEventListener("keydown", (e) => this.keys(e));
    this.layer.append(this.leader, this.button, this.menu);
    view.dom.append(this.layer);
    view.dom.addEventListener("mousemove", this.onMove);
    view.dom.addEventListener("mouseleave", this.onLeave);
  }

  private onMove = (e: MouseEvent) => {
    if (this.open || this.layer.contains(e.target as Node)) return;
    const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
    const l = pos === null ? null : linkAt(this.view.state, pos);
    if (!same(l, this.hover)) { this.hover = l; this.view.requestMeasure(this.measure); }
  };
  private onLeave = (e: MouseEvent) => {
    if (this.open || this.layer.contains(e.relatedTarget as Node)) return;
    if (this.hover) { this.hover = null; this.view.requestMeasure(this.measure); }
  };

  /** The links selected, when there are two or more. */
  selected(): LinkAt[] {
    const r = this.view.state.selection.main;
    if (r.empty) return [];
    const ls = linksIn(this.view.state, r.from, r.to);
    return ls.length >= 2 ? ls : [];
  }

  /** The link in play: the first of several selected, else the cursor's, else the pointer's. */
  current(): LinkAt | null {
    const r = this.view.state.selection.main;
    const many = this.selected();
    if (many.length) return many[0]!;
    return linkAt(this.view.state, r.head) ?? (r.empty ? this.hover : null);
  }

  update(u: ViewUpdate): void {
    if (u.docChanged) this.hover = null;
    if (u.docChanged || u.selectionSet || u.geometryChanged || u.viewportChanged || u.focusChanged) this.view.requestMeasure(this.measure);
  }

  private measure = {
    key: "link-control",
    read: (view: EditorView) => {
      const l = this.current();
      if (!l) return null;
      const many = this.selected();
      const box = view.dom.getBoundingClientRect(), text = view.contentDOM.getBoundingClientRect();
      let end = view.coordsAtPos(Math.max(l.from, l.to - 1), 1) ?? view.coordsAtPos(l.to, -1);
      if (many.length) {
        // Beside the last selected link that is in sight: a whole note may be selected.
        const top = Math.max(box.top, 0), bottom = Math.min(box.bottom, window.innerHeight);
        end = null;
        for (let k = many.length - 1; k >= 0 && !end; k--) {
          const c = view.coordsAtPos(Math.max(many[k]!.from, many[k]!.to - 1), 1);
          if (c && c.top >= top && c.bottom <= bottom - 34) end = c;
        }
        end ??= view.coordsAtPos(Math.max(many[0]!.from, many[0]!.to - 1), 1);
      }
      if (!end) return null;
      return { l, many, x: end.right - box.left, y: (end.top + end.bottom) / 2 - box.top, right: text.right - box.left, width: box.width };
    },
    write: (m: { l: LinkAt; many: LinkAt[]; x: number; y: number; right: number; width: number } | null) => {
      if (!m) { this.link = null; this.many = []; this.layer.hidden = true; this.toggle(false, false); return; }
      const label = m.many.length ? labelFor(m.many) : labelOf(m.l);
      const changed = !same(m.l, this.link) || m.many.length !== this.many.length || label !== this.button.textContent;
      this.link = m.l;
      this.many = m.many;
      this.layer.hidden = false;
      this.button.textContent = label;
      this.button.title = m.many.length ? "Rate all the selected links (Alt+L)" : "What this link is (Alt+L)";
      this.button.setAttribute("aria-label", m.many.length ? `${label}. Rate them all` : `This link: ${label}. Change it`);
      const bw = this.button.offsetWidth || 90;
      // In the margin at the right of the text where there is one; else at the text's right edge, a line below.
      const room = m.width - m.right >= bw + 20;
      const bx = room ? m.right + 14 : Math.max(0, m.width - bw - 2), by = room ? m.y - 13 : m.y + 12;
      this.button.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by)}px)`;
      this.menu.style.transform = `translate(${Math.round(Math.min(bx, m.width - 250))}px, ${Math.round(by + 30)}px)`;
      const ex = bx, ey = by + 13;
      this.path.setAttribute("d", room ? `M${m.x + 3} ${m.y} H${Math.max(m.x + 3, ex - 3)}` : `M${m.x + 3} ${m.y} V${ey} H${ex - 3}`);
      // The link changed under an open menu (an edit just made, measured only now): the choices are made
      // again, and the keyboard keeps its place.
      if (changed && this.open) { this.fill(); this.mark(this.at); }
    },
  };

  private fill(): void {
    const l = this.link;
    if (!l) return;
    this.menu.replaceChildren(...(this.many.length ? choicesFor(this.many) : choices(l)).map((c, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.tabIndex = -1;
      b.id = `cm-link-choice-${k}`;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("mousemove", () => this.mark(k));
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(c.on));
      b.title = c.hint;
      b.innerHTML = "<b></b><span></span>";
      b.querySelector("b")!.textContent = c.label;
      b.querySelector("span")!.textContent = c.hint;
      b.addEventListener("click", () => { const now = this.current() ?? l; c.run(this.view, now); this.toggle(false, true); });
      return b;
    }));
  }

  toggle(open: boolean, focusEditor: boolean): void {
    if (open) { this.link = this.current() ?? this.link; this.many = this.selected(); } // as it is now, not as last measured
    if (open && !this.link) return;
    this.open = open;
    this.menu.hidden = !open;
    this.layer.classList.toggle("open", open);
    this.button.setAttribute("aria-expanded", String(open));
    if (open) {
      this.fill();
      const items = [...this.menu.querySelectorAll("button")];
      this.mark(Math.max(0, items.findIndex((b) => b.getAttribute("aria-checked") === "true")));
      this.menu.focus();
    }
    else if (focusEditor) this.view.focus();
  }

  private mark(k: number): void {
    const items = [...this.menu.querySelectorAll("button")];
    this.at = items.length ? (k + items.length) % items.length : 0;
    items.forEach((b, i) => b.classList.toggle("on", i === this.at));
    this.menu.setAttribute("aria-activedescendant", items[this.at]?.id ?? "");
  }

  private keys(e: KeyboardEvent): void {
    const items = [...this.menu.querySelectorAll<HTMLElement>("button")];
    let handled = true;
    if (e.key === "Escape") this.toggle(false, true);
    else if (e.key === "Enter" || e.key === " ") items[this.at]?.click();
    else if (e.key === "ArrowDown") this.mark(this.at + 1);
    else if (e.key === "ArrowUp") this.mark(this.at - 1);
    else if (e.key === "Home") this.mark(0);
    else if (e.key === "End") this.mark(items.length - 1);
    else if (e.key === "Tab") this.toggle(false, true);
    else if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) { const hit = items.findIndex((b) => b.textContent!.toLowerCase().startsWith(e.key.toLowerCase())); if (hit >= 0) this.mark(hit); else handled = false; }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  destroy(): void {
    this.view.dom.removeEventListener("mousemove", this.onMove);
    this.view.dom.removeEventListener("mouseleave", this.onLeave);
    this.layer.remove();
  }
}

const plugin = ViewPlugin.fromClass(Control);

const withLink = (run: (view: EditorView, l: LinkAt) => void) => (view: EditorView): boolean => {
  const l = linkAt(view.state, view.state.selection.main.head);
  if (!l) return false;
  run(view, l);
  return true;
};
const rate = (r: Rating | null) => (view: EditorView): boolean => {
  const sel = view.state.selection.main, many = sel.empty ? [] : linksIn(view.state, sel.from, sel.to);
  if (many.length >= 2) { apply(view, setTitles(many, r)); return true; }
  return withLink((v, l) => { if (rateable(l)) apply(v, setTitle(l, r)); })(view);
};

export const linkKeymap = [
  { key: "Alt-l", run: (view: EditorView) => { const c = view.plugin(plugin); if (!c || !c.current()) return false; c.toggle(true, false); return true; } },
  { key: "Alt-1", run: rate("requires") }, { key: "Alt-2", run: rate("uses") }, { key: "Alt-3", run: rate("see also") }, { key: "Alt-0", run: rate(null) },
  { key: "Alt-e", run: withLink((view, l) => { if (l.kind !== "note") apply(view, setEmbed(l, !l.embed)); }) },
];

const theme = EditorView.baseTheme({
  "&": { position: "relative" },
  ".cm-link-control": { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "4", overflow: "visible" },
  ".cm-link-control[hidden]": { display: "none" },
  ".cm-link-leader": { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", overflow: "visible" },
  ".cm-link-leader path": { fill: "none", stroke: "var(--pen-blue)", strokeWidth: "1.75", strokeDasharray: ".1 5", strokeLinecap: "round", opacity: ".7" },
  // The dots run along the leader while the control is in use.
  ".cm-link-control:hover .cm-link-leader path, .cm-link-control:focus-within .cm-link-leader path, .cm-link-control.open .cm-link-leader path": { opacity: "1", animation: "cm-link-run .6s linear infinite" },
  "@keyframes cm-link-run": { to: { strokeDashoffset: "-5.1" } },
  "@media (prefers-reduced-motion: reduce)": { ".cm-link-leader path": { animation: "none !important" } },
  ".cm-link-button": { position: "absolute", left: "0", top: "0", pointerEvents: "auto", height: "26px", padding: "0 9px", font: "12.5px var(--font-ui)", whiteSpace: "nowrap",
    color: "var(--ink)", background: "var(--paper-raised)", border: "1px solid var(--pen-blue)", borderRadius: "var(--radius)", cursor: "pointer" },
  ".cm-link-button:hover, .cm-link-button[aria-expanded=true]": { background: "var(--accent-soft)" },
  ".cm-link-button:focus-visible": { outline: "2px solid var(--focus-ring)", outlineOffset: "2px" },
  ".cm-link-menu": { position: "absolute", left: "0", top: "0", pointerEvents: "auto", width: "248px", padding: "4px", background: "var(--paper-raised)", border: "1px solid var(--rule)",
    borderRadius: "var(--radius)", boxShadow: "0 6px 20px rgb(0 0 0 / .16)", display: "grid", gap: "1px" },
  ".cm-link-menu[hidden]": { display: "none" },
  ".cm-link-menu button": { display: "grid", gap: "1px", textAlign: "left", padding: "6px 8px 6px 24px", background: "none", border: "0", borderRadius: "var(--radius-sm)", color: "var(--ink)", font: "13.5px var(--font-ui)", cursor: "pointer", position: "relative" },
  ".cm-link-menu button b": { fontWeight: "600" },
  ".cm-link-menu button span": { fontSize: "12px", color: "var(--ink-faint)", lineHeight: "1.3" },
  ".cm-link-menu button[aria-checked=true]::before": { content: '"●"', position: "absolute", left: "8px", top: "7px", fontSize: "10px", color: "var(--pen-blue)" },
  ".cm-link-menu:focus": { outline: "none" },
  ".cm-link-menu button.on": { background: "var(--accent-soft)" },
  ".cm-link-menu:focus-visible button.on": { outline: "2px solid var(--focus-ring)", outlineOffset: "-2px" },
});

export const linkControl = [plugin, theme, keymap.of(linkKeymap)];
