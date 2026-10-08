// Ask Atlas (T85), in the Axis panel (T93): a question asked on the map. The
// panel is docked beside the map or below it, folds to a tab and is resized by
// a drag. It holds the question (written in the note editor's live preview),
// the answer, what it cost, and the questions asked before (T94), each of
// which can be played again on the map. What the map is to draw comes from
// here: the notes each lookup named or opened, how each was reached (by a
// search of words, by a search of meaning, or by a link), the links followed
// from one to the next, and the notes the answer rests on, each with a
// sentence of it. gridmap.js draws the marks; nothing here knows where a note is.

import { h } from "./dom.js";
import { axisDock } from "../axisDock.js";
import { askAtlas, forgetAsk, keptAsk, keptAsks, streamingAnswer } from "../assist.ts";
import { ai, money } from "../teacher.svelte.ts";
import { editing } from "../edit.svelte.ts";
import { learner, store } from "../data.svelte.ts";
import { render } from "../markdown.ts";
import { conceptHref } from "../format.ts";

const TIER_KEY = "rdstudio.assist.tier"; // the editor's choice (T83), kept here too
const PANEL_KEY = "rdstudio.axis"; // open or folded, and the size on each side
export const MOST_PREVIEWS = 4; // more would cover the map
const REPLAY_MS = 700; // between one lookup and the next when a kept question is played again

const count = (n) => Math.round(n).toLocaleString("en");
const plural = (n, one, many = one + "s") => `${count(n)} ${n === 1 ? one : many}`;
/** Rendered Markdown without the paragraph round it, for a sentence set in a line. */
const inline = (text) => render(text).trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");
const firstLine = (text) => text.trim().split("\n").find((l) => l.trim())?.trim() ?? "";
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

/**
 * @param {{ where: () => ({ ref: string, label: string, kind: "note" | "folder" } | null), changed: (what: "step" | "done" | "clear") => void, show: (note: string) => void }} map
 */
export function askBox(map) {
  let steps = [], answer = null, text = "", error = "", busy = null, asked = "", from = null; // busy: the request's AbortController
  let version = 0, cached = null, previewsOn = true;
  let kept = null; // the kept question shown: { id, at, since }, or null for one just asked and not kept
  let playing = 0; // a replay's timer
  let asks = null, keeping = true, listError = ""; // the questions kept, once fetched; whether they are kept at all

  // ------------------------------------------------------------ the panel

  const tab = h("button", { class: "toggle axis-tab", type: "button", "aria-expanded": "false", title: "Ask Axis about this project" }, "Axis");
  const back = h("button", { class: "toggle axis-back", type: "button", hidden: true, title: "Put this answer away and show the questions asked before" }, "Questions");
  const head = h("header", { class: "axis-head" }, tab, back);
  const grip = h("div", { class: "axis-grip", role: "separator", tabindex: "0", "aria-label": "Resize the Axis panel", title: "Drag to resize" });
  const body = h("div", { class: "axis-body" });
  const cost = h("details", { class: "axis-cost", hidden: true });
  const where = h("p", { class: "axis-where" });
  const editor = h("div", { class: "answer-editor axis-editor" });
  const tier = h("select", { "aria-label": "How strong a model to ask", title: "How strong a model to ask" },
    h("option", { value: "" }, "Usual"), h("option", { value: "low" }, "Low"), h("option", { value: "mid" }, "Mid"), h("option", { value: "max" }, "Max"));
  try { const t = localStorage.getItem(TIER_KEY); if (t === "low" || t === "mid" || t === "max") tier.value = t; } catch { /* no storage */ }
  tier.addEventListener("change", () => { try { if (tier.value) localStorage.setItem(TIER_KEY, tier.value); else localStorage.removeItem(TIER_KEY); } catch { /* no storage */ } });
  const go = h("button", { class: "toggle primary", type: "submit" }, "Ask");
  const keys = h("span", { class: "axis-keys" }, "Ctrl+Enter asks");
  const off = h("p", { class: "atlas-ask-off", hidden: true }, "To ask questions here, ", h("a", { href: "#/teacher" }, "connect a model"), ".");
  const form = h("form", { class: "atlas-ask", role: "search", "aria-label": "Ask Atlas" }, where, editor, h("div", { class: "axis-row" }, keys, tier, go), off);
  const panel = h("aside", { class: "axis-panel folded", "aria-label": "Axis", hidden: true }, grip, head, body, cost, form);
  const previews = h("div", { class: "aq-previews" });
  // The map's own keys (Escape, a note's Enter and Space) and the app's are not for the panel.
  panel.addEventListener("keydown", (e) => e.stopPropagation());

  let token = null, connected = false;
  void editing.known.then(async () => {
    token = editing.token ?? learner.writeHeaders()["x-rdstudio-token"] ?? null;
    if (store.site.static || !token) return; // nothing to ask with
    const st = await ai.state();
    if (!st) return;
    connected = !!st.connected;
    panel.hidden = false;
    for (const el of [where, editor, tier, go, keys]) el.hidden = !connected;
    off.hidden = connected;
    if (st.tiers) for (const opt of tier.options) if (opt.value) opt.title = st.tiers[opt.value];
    dock();
    if (dk.open) opened();
  });

  // ---- beside the map or below it, folded or open, and how much of the frame it takes (axisDock.js)
  const dk = axisDock({ panel, grip, key: PANEL_KEY, available: () => !panel.hidden, changed: ({ open }) => tab.setAttribute("aria-expanded", String(open)) });
  const dock = dk.dock, attach = dk.attach;
  function setOpen(on) {
    dk.setOpen(on);
    if (on) opened();
  }
  tab.addEventListener("click", () => setOpen(!dk.open));

  // ---- the question, written as a note is: the editor is fetched when the panel is first opened
  let view = null, setText = null, draft = "", plain = null, loading = false;
  function opened() {
    place();
    if (!asked && asks === null) void listAsks();
    if (!connected || view || plain || loading) return;
    loading = true;
    import("../editor/codemirror.ts").then((cm) => {
      setText = cm.setText;
      view = cm.createEditor(editor, {
        doc: draft, label: "Your question", inline: true,
        placeholder: "Ask a question. $x$ for maths, [[ to name a note.",
        onChange: (t) => { draft = t; }, onSave: () => {},
        notes: () => [...store.concepts.values()].map((c) => ({ id: c.id, title: c.title, folder: c.directory })),
      });
    }).catch(() => {
      // The editor did not load (offline after an update, say): a plain box still works.
      plain = h("textarea", { class: "answer-editor plain axis-editor", rows: "4", "aria-label": "Your question", placeholder: "Ask a question.", maxlength: 2000 });
      plain.addEventListener("input", () => { draft = plain.value; });
      editor.replaceWith(plain);
    });
  }
  const setDraft = (t) => { draft = t; if (view && setText) setText(view, t); if (plain) plain.value = t; };
  const focusDraft = () => { if (view) view.focus(); else plain?.focus(); };

  let placed = "";
  /** Say where a question would start from. */
  function place() {
    const w = map.where(), label = w ? `About ${w.kind === "folder" ? "the folder " : ""}${w.label}` : "About this project";
    if (label !== placed) where.textContent = placed = label;
  }
  place();

  const submit = () => {
    const question = draft.trim();
    if (!question) { focusDraft(); return; }
    void run(question);
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) { busy.abort(); return; }
    submit();
  });
  // Ctrl+Enter asks, before the editor makes a line of it.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); e.stopPropagation();
    if (!busy) submit();
  }, true);

  async function run(question) {
    stopPlaying();
    const stop = busy = new AbortController();
    from = map.where();
    steps = []; answer = null; text = ""; error = ""; asked = question; kept = null;
    go.textContent = "Stop";
    tier.disabled = true;
    touched("clear");
    try {
      const a = await askAtlas({ question, start: from?.ref, tier: tier.value || undefined },
        (soFar) => { if (busy === stop) { text = soFar; fill(); } }, stop.signal, (step) => { if (busy === stop) { steps = [...steps, step]; touched("step"); } }, token);
      if (busy !== stop) return;
      answer = a.answer; steps = a.answer.steps;
      if (a.kept) { kept = { id: a.kept, at: new Date().toISOString(), since: null }; asks = null; } // the list is fetched again when it is next shown
      setDraft("");
    } catch (err) {
      if (busy !== stop) return;
      error = stop.signal.aborted ? "Stopped." : (err instanceof Error ? err.message : String(err));
    }
    busy = null;
    go.textContent = "Ask";
    tier.disabled = false;
    touched("done");
  }

  function clear() {
    stopPlaying();
    busy?.abort(); busy = null;
    steps = []; answer = null; text = ""; error = ""; asked = ""; kept = null;
    go.textContent = "Ask";
    tier.disabled = false;
    touched("clear");
    if (dk.open && asks === null) void listAsks();
  }
  back.addEventListener("click", clear);

  function touched(what) { version++; cached = null; fill(); fillPreviews(); map.changed(what); }

  // ------------------------------------------------------------ the questions kept (T94)

  async function listAsks() {
    try { const got = await keptAsks(); asks = got.asks; keeping = got.enabled; listError = ""; }
    catch (err) { asks = []; listError = err instanceof Error ? err.message : String(err); }
    if (!asked) fill();
  }

  const fromOf = (f) => (f ? { ref: f.ref, kind: f.kind, label: f.kind === "note" ? (store.concepts.get(f.ref)?.title ?? f.ref) : f.ref } : null);
  /** Whether a kept answer can be played again: every note it touched is here, and every link it followed. */
  const intact = (since) => !since || (!since.gone.length && !since.links.length);

  /** Show a kept question: played again on the map where its notes and links are as they were, else as it stands. */
  async function openKept(id, play = true) {
    let k;
    try { k = await keptAsk(id); } catch (err) { listError = err instanceof Error ? err.message : String(err); asks = null; void listAsks(); return; }
    stopPlaying();
    busy?.abort(); busy = null;
    from = fromOf(k.from);
    asked = k.answer.question; error = ""; text = "";
    kept = { id: k.id, at: k.at, since: k.since };
    const all = k.answer.steps;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!play || still || !intact(k.since) || !all.length) { steps = all; answer = k.answer; touched("clear"); touched("done"); return; }
    steps = []; answer = null;
    touched("clear");
    let at = 0;
    const next = () => {
      if (at < all.length) { steps = [...steps, all[at++]]; touched("step"); playing = setTimeout(next, REPLAY_MS); return; }
      playing = 0; answer = k.answer; steps = all;
      touched("done");
    };
    playing = setTimeout(next, REPLAY_MS / 2);
  }
  function stopPlaying() { if (playing) { clearTimeout(playing); playing = 0; } }

  async function forget(id) {
    if (!confirm("Delete this question and its answer from your record? This cannot be undone.")) return;
    try { await forgetAsk(id, token); } catch (err) { listError = err instanceof Error ? err.message : String(err); }
    asks = null;
    if (kept?.id === id) clear(); else void listAsks();
  }

  // ------------------------------------------------------------ what the map draws

  /** A note that is not here: gone from the project, by the page's own notes or by what the server said of a kept answer. */
  const missing = (id) => !store.concepts.has(id) || !!kept?.since?.gone.includes(id);

  /** The marks for the map, or null when nothing is asked: each note named or opened (how it was reached, whether it
   *  was opened, its place among the notes the answer rests on), the links followed, and whether the answer is in. */
  function marks() {
    if (!asked) return null;
    if (cached) return cached;
    const notes = new Map(), chain = [];
    const here = (id) => !missing(id); // a kept answer may name a note that has gone since
    const mark = (id, how) => { if (!notes.has(id)) notes.set(id, { how, opened: false, cited: 0 }); return notes.get(id); };
    if (from?.kind === "note" && here(from.ref)) mark(from.ref, "start");
    for (const s of steps) {
      if (s.failed) continue;
      const how = s.how === "link" ? "link" : s.how === "meaning" ? "meaning" : "search";
      if (!s.opened) { for (const id of s.notes) if (here(id)) mark(id, how); continue; }
      if (!here(s.opened)) continue;
      const m = mark(s.opened, how);
      if (!m.opened && m.how !== "start") m.how = how; // how it was first opened, not how it was first named
      m.opened = true;
      if (s.from && here(s.from) && !chain.some((c) => c.from === s.from && c.to === s.opened)) { mark(s.from, "search"); chain.push({ from: s.from, to: s.opened }); }
    }
    (answer?.used ?? []).forEach((u, k) => { if (here(u.note)) mark(u.note, u.how).cited = k + 1; });
    return (cached = { version, notes, chain, done: !!answer });
  }

  // ------------------------------------------------------------ the answer

  const titleOf = (id) => store.concepts.get(id)?.title ?? id;
  const onMap = (id, label) => { const b = h("button", { class: "link", type: "button", title: "Show on the map" }, label); b.addEventListener("click", () => map.show(id)); return b; };

  /** A kept answer's sentence, as it stands now: no longer found in its note, or still what it was. */
  const stillThere = (u) => u.checked && kept?.since?.quotes[u.note] !== false;

  function fill() {
    back.hidden = !asked;
    fillCost();
    if (!asked) { body.replaceChildren(...idle()); return; }
    const looked = steps.map((s) => h("li", { class: s.failed ? "failed" : null }, s.said));
    const parts = [h("blockquote", { class: "aq-question" }, h("span", { class: "aq-label" }, kept?.since ? `Asked ${when(kept.at)}` : "Question"), h("div", { class: "prose", html: render(asked) }))];
    if (from) parts.push(h("p", { class: "aq-from" }, `Asked from ${from.kind === "folder" ? "the folder " : ""}${from.label}.`));
    if (busy || playing) {
      parts.push(h("ol", { class: "aq-steps", "aria-label": "What is being looked up" }, looked, h("li", { class: "aq-now" }, playing ? "Playing it again…" : text ? "Writing the answer…" : steps.length ? "Reading…" : "Looking…")));
      const soFar = streamingAnswer(text);
      if (soFar) parts.push(h("div", { class: "aq-text prose", html: render(soFar) }));
    } else if (error) {
      parts.push(h("p", { class: "aq-error", role: "alert" }, error));
      if (looked.length) parts.push(h("ol", { class: "aq-steps" }, looked));
    } else if (answer) {
      const since = kept?.since;
      if (since && (since.gone.length || since.links.length || since.changed.length)) {
        const said = [];
        if (since.gone.length) said.push(`${plural(since.gone.length, "note")} it used ${since.gone.length === 1 ? "is" : "are"} gone (${since.gone.join(", ")})`);
        if (since.links.length) said.push(`${plural(since.links.length, "link")} it followed ${since.links.length === 1 ? "is" : "are"} no longer there (${since.links.map((l) => `${titleOf(l.from)} to ${titleOf(l.to)}`).join("; ")})`);
        if (since.changed.length) said.push(`${plural(since.changed.length, "note")} ${since.changed.length === 1 ? "has" : "have"} changed (${since.changed.map(titleOf).join(", ")})`);
        parts.push(h("p", { class: "aq-since", role: "note" }, `Since this was answered: ${said.join("; ")}.`, intact(since) ? "" : " It is shown as it was answered, and is not played again."));
      }
      parts.push(h("div", { class: "aq-text prose", html: render(answer.answer || "No answer was written.") }));
      if (answer.used.length) {
        parts.push(h("h4", {}, "Rests on"), h("ol", { class: "aq-used" }, answer.used.map((u) => {
          const gone = missing(u.note), ok = stillThere(u);
          return h("li", { class: u.how },
            gone ? h("span", { class: "aq-gone" }, u.title) : onMap(u.note, u.title), u.section ? h("span", { class: "aq-section" }, ` · ${u.section}`) : "", " ",
            gone ? h("span", { class: "aq-flag" }, "gone") : h("a", { href: conceptHref(u.note), class: "aq-open" }, "open"),
            !gone && since?.changed.includes(u.note) ? h("span", { class: "aq-flag" }, " changed since") : "",
            u.quote ? h("blockquote", { class: ok ? null : "unchecked", title: ok ? "Found in the note, word for word" : u.checked ? "This sentence is no longer in the note" : "The start of what it read: the sentence it gave is not in the note",
              html: ok ? `“${inline(u.quote)}”` : inline(u.quote) }) : "");
        })));
      }
      const m = marks(), also = [...m.notes].filter(([, q]) => q.opened && !q.cited).map(([id]) => id);
      if (also.length) parts.push(h("p", { class: "aq-also" }, "Also opened, not used: ", also.flatMap((id, k) => [k ? ", " : "", onMap(id, titleOf(id))]), "."));
      if (answer.code.length) parts.push(h("p", { class: "aq-also" }, "Code read: ", answer.code.flatMap((c, k) => [k ? ", " : "", h("code", {}, `${c.id}:${c.line}`)]), "."));
      if (!steps.length) parts.push(h("p", { class: "aq-also" }, "Nothing was looked up, so this is not from the notes."));
      else parts.push(h("details", { class: "aq-looked" }, h("summary", {}, `Looked up ${steps.length} thing${steps.length === 1 ? "" : "s"}`), h("ol", { class: "aq-steps" }, looked)));
      const show = h("input", { type: "checkbox", checked: previewsOn });
      show.addEventListener("change", () => { previewsOn = show.checked; fillPreviews(); map.changed("step"); });
      parts.push(h("ul", { class: "aq-key", "aria-label": "How to read the map" },
        h("li", {}, h("i", { class: "search" }), "Found by a search"),
        [...m.notes.values()].some((q) => q.how === "meaning") ? h("li", {}, h("i", { class: "meaning" }), "Found by meaning") : "", // only where it was used (T90)
        h("li", {}, h("i", { class: "link" }), "Reached by a link"), h("li", {}, h("i", { class: "cited" }), "The answer rests on it")),
      answer.used.length ? h("label", { class: "aq-show" }, show, " Passages on the map") : "");
      if (kept) {
        const acts = [];
        if (steps.length && intact(since)) { const again = h("button", { class: "toggle", type: "button" }, "Play again"); again.addEventListener("click", () => void openKept(kept.id)); acts.push(again); }
        const drop = h("button", { class: "toggle", type: "button", title: "Delete this question and its answer from your record" }, "Delete");
        drop.addEventListener("click", () => void forget(kept.id));
        parts.push(h("p", { class: "aq-acts" }, acts, drop));
      }
    }
    body.replaceChildren(...parts);
    if (busy || playing) body.scrollTop = body.scrollHeight;
  }

  /** Nothing is asked: the questions asked before, to open again. */
  function idle() {
    if (!connected) return [];
    const out = [];
    if (listError) out.push(h("p", { class: "aq-error", role: "alert" }, listError));
    if (!keeping) out.push(h("p", { class: "aq-also" }, "Questions are not kept: the learner record is off."));
    else if (asks === null) out.push(h("p", { class: "aq-also" }, "…"));
    else if (!asks.length) out.push(h("p", { class: "aq-also" }, "Questions you ask are kept here, with their answers, to open and play again."));
    else {
      out.push(h("h4", {}, "Asked before"), h("ul", { class: "aq-asked" }, asks.map((a) => {
        const open = h("button", { class: "aq-ask", type: "button", title: "Show the answer, and play it again on the map" },
          h("span", { class: "aq-ask-q", html: inline(firstLine(a.question)) }), h("span", { class: "aq-ask-meta" }, [when(a.at), a.from ? (a.from.kind === "note" ? titleOf(a.from.ref) : `${a.from.ref}/`) : "", money(a.cost)].filter(Boolean).join(" · ")));
        open.addEventListener("click", () => void openKept(a.id));
        const drop = h("button", { class: "aq-drop", type: "button", "aria-label": `Delete the question: ${firstLine(a.question)}`, title: "Delete this question and its answer" }, "×");
        drop.addEventListener("click", () => void forget(a.id));
        return h("li", {}, open, drop);
      })));
    }
    return out;
  }

  /** What the answer cost, kept in view below it: the price and the tokens, and opened, how they came about. */
  function fillCost() {
    const a = !busy && !playing && !error ? answer : null;
    cost.hidden = !a;
    if (!a) { cost.replaceChildren(); return; }
    const s = a.spent, good = a.steps.filter((x) => !x.failed), by = (how) => good.filter((x) => x.how === how).length;
    const rows = [];
    const row = (k, v) => rows.push(h("dt", {}, k), h("dd", {}, v));
    if (s) {
      row("Sent to the model", `${plural(s.input, "token")}${s.cached ? `, ${count(s.cached)} of them read from its cache` : ""}`);
      row("Written by it", plural(s.output, "token"));
      row("Calls to the model", count(s.calls));
    }
    row("Searches of words", count(by("search")));
    if (by("meaning")) row("Searches by meaning", count(by("meaning")));
    row("Notes read", `${count(by("read") + by("link"))}${by("link") ? `, ${count(by("link"))} by a link` : ""}`);
    if (by("code")) row("Code looked up", count(by("code")));
    if (a.steps.length !== good.length) row("Lookups that failed", count(a.steps.length - good.length));
    row("Model", `${a.model} (${a.tier})`);
    const was = cost.open;
    cost.replaceChildren(h("summary", { title: "What this answer used" },
      h("b", { class: "axis-price" }, money(a.cost)), s ? h("span", {}, `${count(s.input)} in · ${count(s.output)} out`) : "", h("span", { class: "axis-model" }, `${a.tier} · ${a.model}`)),
      h("dl", {}, rows));
    cost.open = was;
  }

  /** A preview for each of the first few notes the answer rests on; gridmap.js puts each beside its note. */
  function fillPreviews() {
    const used = answer && previewsOn ? answer.used.filter((u) => !missing(u.note)).slice(0, MOST_PREVIEWS) : [];
    previews.replaceChildren(...used.map((u) => { const ok = stillThere(u), k = answer.used.indexOf(u); return h("a", { class: `aq-preview ${u.how}`, href: conceptHref(u.note), "data-note": u.note, hidden: true, title: "Open the note" },
      h("b", {}, h("span", { class: "aq-n" }, String(k + 1)), u.title, u.section ? h("span", { class: "aq-section" }, ` · ${u.section}`) : ""),
      u.quote ? h("span", { class: ok ? "aq-quote" : "aq-quote unchecked", html: ok ? `“${inline(u.quote)}”` : inline(u.quote) }) : h("span", { class: "aq-quote unchecked" }, "No passage.")); }));
  }

  function leave() { stopPlaying(); busy?.abort(); busy = null; dk.destroy(); view?.destroy(); view = null; }

  fill();
  /** `over`: what of the panel lies over the map (its tab, when folded), for the map to keep clear of. */
  return { panel, previews, attach, place, marks, clear, leave, over: () => (dk.open || panel.hidden ? [] : [tab]), active: () => !!asked, previewEls: () => [...previews.children] };
}
