// Ask Atlas (T85): a question asked on the map. The box to ask from, the
// answer beside the map, and what the map is to draw for it: the notes each
// lookup named or opened, how each was reached, the links followed from one
// to the next, and the notes the answer rests on, each with a sentence of
// it. gridmap.js draws the marks; nothing here knows where a note is.

import { h } from "./dom.js";
import { askAtlas, streamingAnswer } from "../assist.ts";
import { ai, money } from "../teacher.svelte.ts";
import { editing } from "../edit.svelte.ts";
import { learner, store } from "../data.svelte.ts";
import { render } from "../markdown.ts";
import { conceptHref } from "../format.ts";

const TIER_KEY = "rdstudio.assist.tier"; // the editor's choice (T83), kept here too
export const MOST_PREVIEWS = 4; // more would cover the map

/**
 * @param {{ where: () => ({ ref: string, label: string, kind: "note" | "folder" } | null), changed: (what: "step" | "done" | "clear") => void, show: (note: string) => void }} map
 */
export function askBox(map) {
  let steps = [], answer = null, text = "", error = "", busy = null, asked = "", from = null; // busy: the request's AbortController
  let version = 0, cached = null, previewsOn = true;

  // ------------------------------------------------------------ the box
  const input = h("input", { type: "text", name: "question", autocomplete: "off", "aria-label": "Ask a question about this project", maxlength: 2000 });
  const tier = h("select", { "aria-label": "How strong a model to ask", title: "How strong a model to ask" },
    h("option", { value: "" }, "Usual"), h("option", { value: "low" }, "Low"), h("option", { value: "mid" }, "Mid"), h("option", { value: "max" }, "Max"));
  try { const t = localStorage.getItem(TIER_KEY); if (t === "low" || t === "mid" || t === "max") tier.value = t; } catch { /* no storage */ }
  tier.addEventListener("change", () => { try { if (tier.value) localStorage.setItem(TIER_KEY, tier.value); else localStorage.removeItem(TIER_KEY); } catch { /* no storage */ } });
  const go = h("button", { class: "toggle primary", type: "submit" }, "Ask");
  const off = h("p", { class: "atlas-ask-off", hidden: true }, "To ask questions here, ", h("a", { href: "#/teacher" }, "connect a model"), ".");
  const form = h("form", { class: "atlas-ask", role: "search", "aria-label": "Ask Atlas", hidden: true }, input, tier, go, off);
  const card = h("section", { class: "atlas-answer", "aria-label": "The answer", hidden: true });
  const previews = h("div", { class: "aq-previews" });

  let token = null;
  void editing.known.then(async () => {
    token = editing.token ?? learner.writeHeaders()["x-rdstudio-token"] ?? null;
    if (store.site.static || !token) return; // nothing to ask with
    const st = await ai.state();
    if (!st) return;
    form.hidden = false;
    form.parentElement?.classList.add("can-ask"); // the folders' legend makes room
    for (const el of [input, tier, go]) el.hidden = !st.connected;
    off.hidden = st.connected;
    if (st.tiers) for (const opt of tier.options) if (opt.value) opt.title = st.tiers[opt.value];
  });

  let placed = "";
  /** Say in the box where a question would start from. */
  function place() {
    const w = map.where(), label = w ? `Ask about ${w.kind === "folder" ? "the folder " : ""}${w.label}` : "Ask about this project";
    if (label !== placed) input.placeholder = placed = label;
  }
  place();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) { busy.abort(); return; }
    const question = input.value.trim();
    if (!question) { input.focus(); return; }
    void run(question);
  });
  // The map's own keys (Escape, a note's Enter and Space) are not for the box.
  form.addEventListener("keydown", (e) => e.stopPropagation());

  async function run(question) {
    const stop = busy = new AbortController();
    from = map.where();
    steps = []; answer = null; text = ""; error = ""; asked = question;
    go.textContent = "Stop";
    input.disabled = tier.disabled = true;
    touched("clear");
    try {
      const a = await askAtlas({ question, start: from?.ref, tier: tier.value || undefined },
        (soFar) => { if (busy === stop) { text = soFar; fill(); } }, stop.signal, (step) => { if (busy === stop) { steps = [...steps, step]; touched("step"); } }, token);
      if (busy !== stop) return;
      answer = a; steps = a.steps;
      input.value = "";
    } catch (err) {
      if (busy !== stop) return;
      error = stop.signal.aborted ? "Stopped." : (err instanceof Error ? err.message : String(err));
    }
    busy = null;
    go.textContent = "Ask";
    input.disabled = tier.disabled = false;
    touched("done");
  }

  function clear() {
    busy?.abort(); busy = null;
    steps = []; answer = null; text = ""; error = ""; asked = "";
    go.textContent = "Ask";
    input.disabled = tier.disabled = false;
    touched("clear");
  }

  function touched(what) { version++; cached = null; fill(); fillPreviews(); map.changed(what); }

  // ------------------------------------------------------------ what the map draws

  /** The marks for the map, or null when nothing is asked: each note named or opened (how it was reached, whether it
   *  was opened, its place among the notes the answer rests on), the links followed, and whether the answer is in. */
  function marks() {
    if (!asked) return null;
    if (cached) return cached;
    const notes = new Map(), chain = [];
    const mark = (id, how) => { if (!notes.has(id)) notes.set(id, { how, opened: false, cited: 0 }); return notes.get(id); };
    if (from?.kind === "note") mark(from.ref, "start");
    for (const s of steps) {
      if (s.failed) continue;
      if (!s.opened) { for (const id of s.notes) mark(id, "search"); continue; }
      const m = mark(s.opened, s.how === "link" ? "link" : "search");
      if (!m.opened && m.how !== "start") m.how = s.how === "link" ? "link" : "search"; // how it was first opened, not how it was first named
      m.opened = true;
      if (s.from && !chain.some((c) => c.from === s.from && c.to === s.opened)) { mark(s.from, "search"); chain.push({ from: s.from, to: s.opened }); }
    }
    (answer?.used ?? []).forEach((u, k) => { mark(u.note, u.how).cited = k + 1; });
    return (cached = { version, notes, chain, done: !!answer });
  }

  // ------------------------------------------------------------ the answer

  const titleOf = (id) => store.concepts.get(id)?.title ?? id;
  const onMap = (id, label) => { const b = h("button", { class: "link", type: "button", title: "Show on the map" }, label); b.addEventListener("click", () => map.show(id)); return b; };

  function fill() {
    card.hidden = !asked;
    if (!asked) { card.replaceChildren(); return; }
    const close = h("button", { class: "atlas-card-close", type: "button", "aria-label": "Close the answer" }, "×");
    close.addEventListener("click", clear);
    const looked = steps.map((s) => h("li", { class: s.failed ? "failed" : null }, s.said));
    const parts = [h("h3", {}, asked), close];
    if (from) parts.push(h("p", { class: "aq-from" }, `Asked from ${from.kind === "folder" ? "the folder " : ""}${from.label}.`));
    if (busy) {
      parts.push(h("ol", { class: "aq-steps", "aria-label": "What is being looked up" }, looked, h("li", { class: "aq-now" }, text ? "Writing the answer…" : steps.length ? "Reading…" : "Looking…")));
      const soFar = streamingAnswer(text);
      if (soFar) parts.push(h("div", { class: "aq-text prose", html: render(soFar) }));
    } else if (error) {
      parts.push(h("p", { class: "aq-error", role: "alert" }, error));
      if (looked.length) parts.push(h("ol", { class: "aq-steps" }, looked));
    } else if (answer) {
      parts.push(h("div", { class: "aq-text prose", html: render(answer.answer || "No answer was written.") }));
      if (answer.used.length) {
        parts.push(h("h4", {}, "Rests on"), h("ol", { class: "aq-used" }, answer.used.map((u) => h("li", { class: u.how },
          onMap(u.note, u.title), u.section ? h("span", { class: "aq-section" }, ` · ${u.section}`) : "", " ", h("a", { href: conceptHref(u.note), class: "aq-open" }, "open"),
          u.quote ? h("blockquote", { class: u.checked ? null : "unchecked", title: u.checked ? "Found in the note, word for word" : "The start of what it read: the sentence it gave is not in the note" }, u.checked ? `“${u.quote}”` : u.quote) : ""))));
      }
      const m = marks(), also = [...m.notes].filter(([, q]) => q.opened && !q.cited).map(([id]) => id);
      if (also.length) parts.push(h("p", { class: "aq-also" }, "Also opened, not used: ", also.flatMap((id, k) => [k ? ", " : "", onMap(id, titleOf(id))]), "."));
      if (answer.code.length) parts.push(h("p", { class: "aq-also" }, "Code read: ", answer.code.flatMap((c, k) => [k ? ", " : "", h("code", {}, `${c.id}:${c.line}`)]), "."));
      if (!steps.length) parts.push(h("p", { class: "aq-also" }, "Nothing was looked up, so this is not from the notes."));
      else parts.push(h("details", { class: "aq-looked" }, h("summary", {}, `Looked up ${steps.length} thing${steps.length === 1 ? "" : "s"}`), h("ol", { class: "aq-steps" }, looked)));
      const show = h("input", { type: "checkbox", checked: previewsOn });
      show.addEventListener("change", () => { previewsOn = show.checked; fillPreviews(); map.changed("step"); });
      parts.push(h("ul", { class: "aq-key", "aria-label": "How to read the map" },
        h("li", {}, h("i", { class: "search" }), "Found by a search"), h("li", {}, h("i", { class: "link" }), "Reached by a link"), h("li", {}, h("i", { class: "cited" }), "The answer rests on it")),
      answer.used.length ? h("label", { class: "aq-show" }, show, " Passages on the map") : "",
      h("p", { class: "aq-meta" }, `${answer.tier} · ${answer.model} · ${money(answer.cost)}`));
    }
    card.replaceChildren(...parts);
  }

  /** A preview for each of the first few notes the answer rests on; gridmap.js puts each beside its note. */
  function fillPreviews() {
    const used = answer && previewsOn ? answer.used.slice(0, MOST_PREVIEWS) : [];
    previews.replaceChildren(...used.map((u, k) => h("a", { class: `aq-preview ${u.how}`, href: conceptHref(u.note), "data-note": u.note, hidden: true, title: "Open the note" },
      h("b", {}, h("span", { class: "aq-n" }, String(k + 1)), u.title, u.section ? h("span", { class: "aq-section" }, ` · ${u.section}`) : ""),
      h("span", { class: u.checked ? "aq-quote" : "aq-quote unchecked" }, u.checked ? `“${u.quote}”` : u.quote || "No passage."))));
  }

  return { form, card, previews, place, marks, clear, active: () => !!asked, previewEls: () => [...previews.children] };
}
