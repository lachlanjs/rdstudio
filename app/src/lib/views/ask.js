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
import { acceptProposal, agentSession, agentSessions, askAtlas, followAgents, forgetAgentSession, forgetAsk, keptAsk, keptAsks, sendToAgent, sentToAgent, streamingAnswer, unsendToAgent } from "../assist.ts";
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
  // An agent outside the app (T107): the sessions kept, and the one whose path is shown, live while it is at work.
  let sessions = null, tracing = true, quietMs = 300000, watching = null; // watching: { id, client, last }
  let sent = null; // what was sent to a terminal agent (T109), once fetched
  let decided = new Map(); // what became of each proposal of the answer shown (T101), by its place: "accepted", "rejected", "busy", or why it failed

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
  // Whether it may propose a new note, a change or a move (T101): off unless ticked, and not kept from one visit to the next.
  const propose = h("input", { type: "checkbox" });
  const mayPropose = h("label", { class: "axis-may", hidden: true, title: "Let Axis propose a new note, a change to a note, or a move. Nothing is written until you accept it." }, propose, " May propose changes");
  const go = h("button", { class: "toggle primary", type: "submit" }, "Ask");
  // To the agent in the terminal (T109): it gets what is written here, and where you are on the map, when it next asks.
  const toAgent = h("button", { class: "toggle", type: "button", title: "Send what you have written, and where you are on the map, to the agent in your terminal. It gets it when it next asks rdstudio (its from_developer tool); nothing else of what you do here is sent." }, "Send to agent");
  const keys = h("span", { class: "axis-keys" }, "Ctrl+Enter asks");
  const off = h("p", { class: "atlas-ask-off", hidden: true }, "To ask questions here, ", h("a", { href: "#/teacher" }, "connect a model"), ".");
  const form = h("form", { class: "atlas-ask", role: "search", "aria-label": "Ask Atlas" }, where, editor, mayPropose, h("div", { class: "axis-row" }, keys, tier, toAgent, go), off);
  const panel = h("aside", { class: "axis-panel folded", "aria-label": "Axis", hidden: true }, grip, head, body, cost, form);
  const previews = h("div", { class: "aq-previews" });
  // The map's own keys (Escape, a note's Enter and Space) and the app's are not for the panel.
  panel.addEventListener("keydown", (e) => e.stopPropagation());

  let token = null, connected = false, stopFollowing = () => {};
  void editing.known.then(async () => {
    token = editing.token ?? learner.writeHeaders()["x-rdstudio-token"] ?? null;
    if (store.site.static || !token) return; // nothing to ask with
    const st = await ai.state();
    if (!st) return;
    connected = !!st.connected;
    panel.hidden = false;
    // With no model there is still something to write: what is sent to the terminal agent.
    for (const el of [tier, go, keys]) el.hidden = !connected;
    mayPropose.hidden = !connected || !editing.enabled; // nothing to propose where notes cannot be written
    off.hidden = connected;
    if (st.tiers) for (const opt of tier.options) if (opt.value) opt.title = st.tiers[opt.value];
    dock();
    if (dk.open) opened();
    stopFollowing = followAgents(agentStep);
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
    if (!asked && !watching && asks === null) void listAsks();
    if (!asked && !watching && sessions === null) void listSessions();
    if (!asked && !watching && sent === null) void listSent();
    if (view || plain || loading) return;
    loading = true;
    import("../editor/codemirror.ts").then((cm) => {
      setText = cm.setText;
      view = cm.createEditor(editor, {
        doc: draft, label: "Your question", inline: true,
        placeholder: connected ? "Ask a question. $x$ for maths, [[ to name a note." : "Write something to send to the agent in your terminal.",
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
    watching = null;
    const stop = busy = new AbortController();
    from = map.where();
    steps = []; answer = null; text = ""; error = ""; asked = question; kept = null; decided = new Map();
    go.textContent = "Stop";
    tier.disabled = true;
    touched("clear");
    try {
      const a = await askAtlas({ question, start: from?.ref, tier: tier.value || undefined, ...(propose.checked && !mayPropose.hidden ? { may: { propose: true } } : {}) },
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
    steps = []; answer = null; text = ""; error = ""; asked = ""; kept = null; decided = new Map(); watching = null;
    go.textContent = "Ask";
    tier.disabled = false;
    touched("clear");
    if (dk.open && asks === null) void listAsks();
    if (dk.open) void listSessions();
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
    busy?.abort(); busy = null; watching = null;
    from = fromOf(k.from);
    asked = k.answer.question; error = ""; text = ""; decided = new Map();
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
    if (!asked && !watching) return null;
    // Worked out again when the page's notes are read again: a note just written is only then there to mark (T107).
    if (cached && cached.read === store.version) return cached;
    if (cached) version++;
    const notes = new Map(), chain = [];
    const here = (id) => !missing(id); // a kept answer may name a note that has gone since
    const mark = (id, how) => { if (!notes.has(id)) notes.set(id, { how, opened: false, cited: 0 }); return notes.get(id); };
    if (from?.kind === "note" && here(from.ref)) mark(from.ref, "start");
    for (const s of steps) {
      if (s.failed) continue;
      const how = s.how === "link" ? "link" : s.how === "meaning" ? "meaning" : s.how === "write" ? "write" : "search";
      if (!s.opened) { for (const id of s.notes) if (here(id)) mark(id, how); continue; }
      if (!here(s.opened)) continue;
      const m = mark(s.opened, how);
      if (how === "write") m.how = "write"; // a note written is shown as written, however it was first reached
      else if (!m.opened && m.how !== "start") m.how = how; // how it was first opened, not how it was first named
      m.opened = true;
      if (s.from && here(s.from) && !chain.some((c) => c.from === s.from && c.to === s.opened)) { mark(s.from, "search"); chain.push({ from: s.from, to: s.opened }); }
    }
    (answer?.used ?? []).forEach((u, k) => { if (here(u.note)) mark(u.note, u.how).cited = k + 1; });
    return (cached = { version, notes, chain, done: !!answer, read: store.version });
  }

  // ------------------------------------------------------------ the answer

  const titleOf = (id) => store.concepts.get(id)?.title ?? id;
  const onMap = (id, label) => { const b = h("button", { class: "link", type: "button", title: "Show on the map" }, label); b.addEventListener("click", () => map.show(id)); return b; };

  /** A kept answer's sentence, as it stands now: no longer found in its note, or still what it was. */
  const stillThere = (u) => u.checked && kept?.since?.quotes[u.note] !== false;

  function fill() {
    back.hidden = !asked && !watching;
    fillCost();
    if (watching) { body.replaceChildren(...session()); if (isLive(watching.last)) body.scrollTop = body.scrollHeight; return; }
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
      // Where a limit shaped the answer (T110): it was cut off, or it stopped looking things up.
      for (const n of answer.notices ?? []) parts.push(h("p", { class: "aq-since", role: "note" }, n));
      if (answer.proposals?.length) parts.push(...proposed(answer));
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

  // ------------------------------------------------------------ what it proposed (T101)

  const idOf = (p) => (p.kind === "move" ? p.from : p.id);
  /** Accept one proposal: the server writes it, and the page's notes are read again. */
  async function accept(a, k) {
    decided.set(k, "busy"); fill();
    try {
      await acceptProposal(a.proposals[k], a.model, token);
      decided.set(k, "accepted");
      await store.refresh();
    } catch (err) { decided.set(k, err instanceof Error ? err.message : String(err)); }
    if (answer === a) fill();
  }

  /** The proposals of an answer, each with what it would do and the two things to do with it. */
  function proposed(a) {
    const open = a.proposals.filter((_, k) => !decided.has(k) || (decided.get(k) !== "accepted" && decided.get(k) !== "rejected")).length;
    const cards = a.proposals.map((p, k) => {
      const state = decided.get(k) ?? "", done = state === "accepted" || state === "rejected", failed = state && !done && state !== "busy";
      const head = p.kind === "create" ? ["New note: ", h("b", {}, p.title), h("code", {}, ` ${p.id}`)]
        : p.kind === "change" ? ["Change ", missing(p.id) ? h("b", {}, p.title || p.id) : onMap(p.id, p.title || titleOf(p.id))]
        : ["Move ", missing(p.from) ? h("b", {}, p.title || p.from) : onMap(p.from, p.title || titleOf(p.from))];
      const what = p.kind === "create" ? [
          h("p", { class: "aq-prop-meta" }, `${p.type}${p.tags.length ? ` · ${p.tags.join(", ")}` : ""}`), p.description ? h("p", { class: "aq-prop-desc" }, p.description) : "",
          h("details", { open: a.proposals.length === 1 }, h("summary", {}, `Its text (${plural(p.body.split("\n").length, "line")})`), h("div", { class: "aq-prop-body prose", html: render(p.body) }))]
        : p.kind === "change" ? p.edits.map((e) => h("div", { class: "aq-edit" },
            e.old ? h("pre", { class: "aq-old", "aria-label": "Taken out" }, e.old) : h("p", { class: "aq-prop-meta" }, "Added at the end:"),
            e.new ? h("pre", { class: "aq-new", "aria-label": "Put in" }, e.new) : h("p", { class: "aq-prop-meta" }, "Deleted, with nothing in its place.")))
        : [h("p", { class: "aq-move" }, h("code", {}, p.from), " → ", h("code", {}, p.to)), h("p", { class: "aq-prop-meta" }, p.links ? `${plural(p.links, "note")} link${p.links === 1 ? "s" : ""} to it; ${p.links === 1 ? "that link is" : "those links are"} rewritten.` : "No note links to it.")];
      const yes = h("button", { class: "toggle primary", type: "button", disabled: state === "busy" }, state === "busy" ? "Writing…" : "Accept");
      yes.addEventListener("click", () => void accept(a, k));
      const no = h("button", { class: "toggle", type: "button", disabled: state === "busy" }, "Reject");
      no.addEventListener("click", () => { decided.set(k, "rejected"); fill(); });
      const after = state === "accepted" ? h("p", { class: "aq-prop-done" }, p.kind === "move" ? "Moved. " : p.kind === "create" ? "Written. " : "Changed. ", h("a", { href: conceptHref(p.kind === "move" ? p.to : p.id) }, "Open it"))
        : state === "rejected" ? h("p", { class: "aq-prop-done" }, "Rejected: nothing was written.")
        : [failed ? h("p", { class: "aq-error", role: "alert" }, `Not done: ${state}`) : "", h("p", { class: "aq-acts" }, yes, no)];
      return h("li", { class: `aq-prop ${p.kind}${done ? " done" : ""}`, "data-note": idOf(p) }, h("p", { class: "aq-prop-head" }, head), done ? "" : what, after);
    });
    return [h("h4", {}, "Proposed"), h("p", { class: "aq-also" }, open ? `Nothing is written until you accept it. Each is yours to accept or reject${kept?.since ? "; a change is refused if its note no longer holds the text it replaces" : ""}.` : "All settled."),
      h("ol", { class: "aq-props" }, cards)];
  }

  // ------------------------------------------------------------ to the agent in the terminal (T109)

  async function listSent() {
    try { sent = (await sentToAgent()).sent; } catch { sent = []; }
    if (!asked && !watching) fill();
  }
  toAgent.addEventListener("click", async () => {
    const text = draft.trim();
    if (!text) { focusDraft(); return; }
    toAgent.disabled = true;
    try { await sendToAgent({ text, ref: map.where()?.ref }, token); setDraft(""); listError = ""; }
    catch (err) { listError = err instanceof Error ? err.message : String(err); }
    toAgent.disabled = false;
    if (asked || watching) clear(); // back to where what was sent is listed
    await listSent();
  });
  /** What was sent, each waiting or taken: listed where nothing is asked. */
  function sentList() {
    if (!sent?.length) return [];
    return [h("h4", {}, "Sent to the terminal agent"), h("ul", { class: "aq-asked" }, sent.slice(0, 6).map((s) => {
      const row = h("span", { class: "aq-ask aq-sent" }, h("span", { class: "aq-ask-q", html: inline(firstLine(s.text)) }),
        h("span", { class: "aq-ask-meta" }, [when(s.at), s.kind === "note" ? titleOf(s.ref) : s.kind === "folder" ? `${s.ref}/` : "", s.taken ? `taken by ${s.taken.by}` : "waiting for an agent to ask"].filter(Boolean).join(" · ")));
      const drop = h("button", { class: "aq-drop", type: "button", "aria-label": `Take back: ${firstLine(s.text)}`, title: s.taken ? "Remove from this list" : "Take it back before an agent takes it" }, "×");
      drop.addEventListener("click", async () => { try { await unsendToAgent(s.id, token); } catch { /* still listed */ } await listSent(); });
      return h("li", { class: s.taken ? "taken" : null }, row, drop);
    }))];
  }

  // ------------------------------------------------------------ agents outside the app (T107)

  const isLive = (last) => Date.now() - +new Date(last) < quietMs;
  async function listSessions() {
    try { const got = await agentSessions(); sessions = got.sessions; tracing = got.enabled; quietMs = got.quietMs; }
    catch { sessions = []; }
    tab.classList.toggle("live", !!sessions.length && isLive(sessions[0].last));
    if (!asked && !watching) fill();
  }

  /** Show a session's path: every step so far, and, while it is at work, each one more as it is made. */
  async function openSession(id) {
    let s;
    try { s = await agentSession(id); } catch { sessions = null; void listSessions(); return; }
    stopPlaying();
    busy?.abort(); busy = null;
    asked = ""; answer = null; error = ""; text = ""; kept = null; from = null; decided = new Map();
    watching = { id: s.id, client: s.client, last: s.events.at(-1)?.at ?? "" };
    steps = s.events.map((e) => e.step);
    touched("clear"); touched("step");
  }

  /** A step an agent has just made, from the server's stream. */
  function agentStep(e) {
    tab.classList.add("live");
    if (e.step.tool === "from_developer") void listSent(); // what was waiting is taken
    if (watching?.id === e.session) {
      watching.last = e.at;
      steps = [...steps, e.step];
      // A note written is on the page once the build that follows is read: the page's own watch does that, and the marks follow it.
      touched("step");
      return;
    }
    sessions = null;
    // Nothing else in hand and the panel open: follow it as it goes.
    if (!asked && !watching && !busy && dk.open) void openSession(e.session);
  }

  async function forgetSession(id) {
    if (!confirm("Delete this session from your record? This cannot be undone.")) return;
    try { await forgetAgentSession(id, token); } catch (err) { listError = err instanceof Error ? err.message : String(err); }
    sessions = null;
    if (watching?.id === id) clear(); else void listSessions();
  }

  /** The sessions kept, to open: above the questions, where nothing is asked. */
  function agents() {
    if (!sessions?.length) return [];
    return [h("h4", {}, "Agents at work"), h("ul", { class: "aq-asked" }, sessions.slice(0, 8).map((s) => {
      const live = isLive(s.last);
      const open = h("button", { class: "aq-ask", type: "button", title: "Show what it searched, opened and wrote, on the map" },
        h("span", { class: "aq-ask-q" }, live ? h("i", { class: "aq-live", title: "At work now" }) : "", s.client),
        h("span", { class: "aq-ask-meta" }, [live ? "now" : when(s.last), plural(s.steps, "step"), s.notes ? plural(s.notes, "note") : "", s.wrote ? `${count(s.wrote)} written` : ""].filter(Boolean).join(" · ")));
      open.addEventListener("click", () => void openSession(s.id));
      const drop = h("button", { class: "aq-drop", type: "button", "aria-label": `Delete the session of ${s.client}`, title: "Delete this session" }, "×");
      drop.addEventListener("click", () => void forgetSession(s.id));
      return h("li", {}, open, drop);
    }))];
  }

  /** The session shown: what the agent did, in order. */
  function session() {
    const live = isLive(watching.last), good = steps.filter((s) => !s.failed);
    const wrote = good.filter((s) => s.how === "write").length, read = new Set(good.filter((s) => s.opened && s.how !== "write").map((s) => s.opened)).size;
    const items = steps.map((s) => h("li", { class: [s.failed ? "failed" : "", s.how === "write" ? "wrote" : ""].filter(Boolean).join(" ") || null },
      s.opened && !missing(s.opened) ? [onMap(s.opened, s.said)] : s.said));
    const drop = h("button", { class: "toggle", type: "button", title: "Delete this session from your record" }, "Delete");
    drop.addEventListener("click", () => void forgetSession(watching.id));
    return [
      h("blockquote", { class: "aq-question" }, h("span", { class: "aq-label" }, live ? "At work now" : `Session, last active ${when(watching.last)}`), h("div", { class: "prose" }, h("p", {}, live ? h("i", { class: "aq-live" }) : "", watching.client))),
      h("p", { class: "aq-from" }, `${plural(steps.length, "step")}: ${plural(read, "note")} read, ${count(wrote)} written. What it touched is shown, not what it read or wrote.`),
      h("ol", { class: "aq-steps", "aria-label": "What the agent did", "aria-live": live ? "polite" : null }, items, live ? h("li", { class: "aq-now" }, "Watching…") : ""),
      h("ul", { class: "aq-key", "aria-label": "How to read the map" },
        h("li", {}, h("i", { class: "search" }), "Found by a search"), h("li", {}, h("i", { class: "link" }), "Reached by a link"), h("li", {}, h("i", { class: "write" }), "Written")),
      h("p", { class: "aq-acts" }, drop),
    ];
  }

  /** Nothing is asked: the questions asked before, to open again. */
  function idle() {
    const out = [...sentList(), ...agents()];
    if (!connected) return listError ? [h("p", { class: "aq-error", role: "alert" }, listError), ...out] : out;
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

  function leave() { stopPlaying(); stopFollowing(); busy?.abort(); busy = null; dk.destroy(); view?.destroy(); view = null; }

  fill();
  /** `over`: what of the panel lies over the map (its tab, when folded), for the map to keep clear of. */
  return { panel, previews, attach, place, marks, clear, leave, over: () => (dk.open || panel.hidden ? [] : [tab]), active: () => !!asked || !!watching, previewEls: () => [...previews.children] };
}
