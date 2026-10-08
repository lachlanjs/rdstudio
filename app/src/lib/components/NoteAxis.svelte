<script lang="ts">
  // Axis beside a note being edited (T96, T97, T98): a panel docked to the
  // right of the note or below it, as on the Atlas (axisDock.js). It holds a
  // chat about the note: each turn a question (written as a note is, maths
  // and all), the answer, and any changes proposed, which appear in the note
  // as suggestions to accept or reject. What a turn may change is said with
  // it: a passage marked in the note, a place set for new text, or the whole
  // note. Chats are kept in the learner record, listed here, and deleted here.
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { learner, store } from "$lib/data.svelte.ts";
  import { editing, slug, type EditSession } from "$lib/edit.svelte.ts";
  import { askAssist, askChat, forgetChat, keptChat, keptChats, streamingChat, type ChatSummary, type Edit, type Reply, type Step, type Tier, type Turn } from "$lib/assist.ts";
  import { axisDock } from "$lib/axisDock.js";
  import { mountArtifact } from "$lib/artifactFrame.ts";
  import { check as checkFigure, save as saveFigure } from "$lib/figure.ts";
  import { acceptAll, acceptSuggestion, createEditor, markPlaces, placesOf, rejectAll, rejectSuggestion, reveal, selectionOf, setText, suggest, suggestAll, type Places, type Suggestion } from "$lib/editor/codemirror.ts";
  import { codeHref } from "$lib/code.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { ai, money } from "$lib/teacher.svelte.ts";
  import Prose from "./Prose.svelte";

  let { session, view, places, shell, open = $bindable(false), available = $bindable(false) }:
    { session: EditSession; view: EditorView | null; places: Places; shell: HTMLElement | undefined; open?: boolean; available?: boolean } = $props();

  const dir = $derived(session.id.includes("/") ? session.id.slice(0, session.id.lastIndexOf("/")) : "");
  const count = (n: number) => Math.round(n).toLocaleString("en");
  const plural = (n: number, one: string, many = one + "s") => `${count(n)} ${n === 1 ? one : many}`;
  const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
  const firstLine = (text: string) => text.trim().split("\n").find((l) => l.trim())?.trim() ?? "";
  const inline = (text: string) => render(text).trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");
  const brief = (text: string, most = 90) => { const t = text.trim().replace(/\s+/g, " "); return t.length > most ? t.slice(0, most - 1).trimEnd() + "…" : t; };

  // ------------------------------------------------------------ the panel: where it is, and how big
  const PANEL_KEY = "rdstudio.axis.note";
  let panel = $state<HTMLElement>(), grip = $state<HTMLElement>();
  let dk: ReturnType<typeof axisDock> | null = null;
  $effect(() => {
    if (!shell || !panel || !grip) return;
    const d = axisDock({ panel, grip, key: PANEL_KEY, available: () => available, changed: (now: { open: boolean }) => { open = now.open; } });
    d.attach(shell);
    dk = d;
    return () => { d.destroy(); dk = null; };
  });
  export function toggle() { dk?.setOpen(!dk.open); }
  // A selection made in the note is the passage only while the panel is there to say so.
  $effect(() => {
    const v = view, on = open && available && connected === true;
    if (v) untrack(() => markPlaces(v, on ? { follow: true } : { follow: false, passage: null, here: null }));
  });
  $effect(() => { void available; dk?.dock(); });
  $effect(() => { if (open && available) untrack(() => { if (chats === null) void listChats(); }); });

  // ------------------------------------------------------------ the model
  const TIER_KEY = "rdstudio.assist.tier";
  let tiers = $state<{ low: string; mid: string; max: string } | null>(null);
  let tier = $state<"" | Tier>("");
  try { const t = localStorage.getItem(TIER_KEY); if (t === "low" || t === "mid" || t === "max") tier = t; } catch { /* no storage */ }
  const keepTier = () => { try { if (tier) localStorage.setItem(TIER_KEY, tier); else localStorage.removeItem(TIER_KEY); } catch { /* no storage */ } };
  const short = (m: string | undefined) => (m ?? "").split("/").pop() ?? "";
  let connected = $state<boolean | null>(null); // a model account is connected (null: no server to ask, or not known yet)
  const token = () => editing.token ?? learner.writeHeaders()["x-rdstudio-token"] ?? null;

  // ------------------------------------------------------------ the question, written as a note is
  let qhost = $state<HTMLDivElement>();
  let qview: EditorView | null = null;
  let draft = $state("");
  $effect(() => {
    if (!qhost || !open || connected !== true || qview) return;
    const parent = qhost;
    untrack(() => {
      qview = createEditor(parent, {
        doc: draft, label: "Your question, or what to change", inline: true,
        placeholder: "Ask about the note, or say what to change. $x$ for maths, [[ to name a note.",
        onChange: (t) => { draft = t; }, onSave: () => {},
        notes: () => [...store.concepts.values()].map((c) => ({ id: c.id, title: c.title, folder: c.directory })),
      });
    });
  });
  const setDraft = (t: string) => { draft = t; if (qview) setText(qview, t); };

  onMount(() => {
    void ai.state().then((st) => { connected = st ? st.connected : null; tiers = st?.tiers ?? null; available = !!st && !store.site.static; });
    return () => { stop?.abort(); qview?.destroy(); qview = null; };
  });

  // ------------------------------------------------------------ what is marked, and what Axis may change
  let mayPassage = $state(false), mayNote = $state(false);
  const passage = $derived(places.passage ? session.body.slice(places.passage.from, places.passage.to) : "");
  const hereLine = $derived(places.here === null ? 0 : session.body.slice(0, places.here).split("\n").length);
  $effect(() => { if (!places.passage) mayPassage = false; });
  const setHere = () => { if (view) markPlaces(view, { here: view.state.selection.main.head }); };
  const dropHere = () => { if (view) markPlaces(view, { here: null }); };
  const dropPassage = () => { if (view) markPlaces(view, { passage: null }); };
  const show = (at: number | null | undefined) => { if (view && at !== null && at !== undefined) reveal(view, at); };

  // ------------------------------------------------------------ the chat
  // (A figure's state, used below: see "a figure".)
  let figure = $state<{ title: string; caption: string; html: string; url: string; model: string; at: number } | null>(null);
  let figureReply = $state<Reply | null>(null);
  let stage = $state("");
  let problems = $state<string[]>([]);
  let outcome = $state("");
  /** A turn shown: as it is kept, and, for one asked in this sitting, the suggestions it put in the note and what became of each. */
  interface Shown { turn: Turn; ids?: string[]; outcome?: Record<string, "waiting" | "accepted" | "rejected" | "lost"> }
  let turns = $state<Shown[]>([]);
  let chatId = $state<string | null>(null);
  let asking = $state<{ question: string; passage: string; here: number; may: { passage: boolean; note: boolean } } | null>(null); // the turn being answered
  let busy = $state<"chat" | "figure" | null>(null);
  let streaming = $state("");
  let looked = $state<Step[]>([]);
  let failed = $state("");
  let stop: AbortController | null = null;
  let scroller = $state<HTMLDivElement>();
  let made = 0;
  const toEnd = () => { requestAnimationFrame(() => { if (scroller) scroller.scrollTop = scroller.scrollHeight; }); };

  /** Where a change goes now: as it was placed, or, if the note was typed in while the reply was written, where its old text is found. */
  function placeNow(e: Edit, sent: string, now: string): { from: number; to: number } | null {
    if (sent === now) return { from: e.from, to: e.to };
    if (e.to > e.from) {
      const old = sent.slice(e.from, e.to), at = now.indexOf(old);
      return at >= 0 && now.indexOf(old, at + 1) < 0 ? { from: at, to: at + old.length } : null;
    }
    const here = view ? placesOf(view).here : null;
    return e.kind === "insert" && here !== null ? { from: here, to: here } : null;
  }

  async function ask() {
    if (!view || busy) return;
    const question = draft.trim(), p = placesOf(view);
    if (!question && !p.passage) { qview?.focus(); return; }
    rejectAll(view); // what was proposed before and neither taken nor refused is refused: the note sent is the note as it stands
    const body = view.state.doc.toString();
    const may = { passage: mayPassage && !!p.passage, note: mayNote };
    asking = { question, passage: p.passage ? body.slice(p.passage.from, p.passage.to) : "", here: p.here === null ? 0 : body.slice(0, p.here).split("\n").length, may };
    busy = "chat"; streaming = ""; looked = []; failed = ""; figure = null; figureReply = null; problems = [];
    stop = new AbortController();
    toEnd();
    try {
      const r = await askChat(session.id, {
        mode: "chat", tier: tier || undefined, body, from: p.passage?.from ?? 0, to: p.passage?.to ?? 0, at: p.here, may,
        prompt: question || undefined, title: session.fields.title || undefined, chat: chatId,
        thread: turns.map(({ turn: t }) => ({ question: t.question || "(About the marked passage.)", answer: t.answer + (t.edits.length ? `\n\n(You proposed ${plural(t.edits.length, "change")} to the note.)` : "") })),
      }, (soFar) => { streaming = streamingChat(soFar); toEnd(); }, stop.signal, (s) => { looked = [...looked, s]; toEnd(); });
      if (r.chat) { if (r.chat !== chatId) chats = null; chatId = r.chat; }
      const n = ++made, edits = r.reply.edits ?? [], now = view.state.doc.toString();
      const ids = edits.map((_, k) => `t${n}.${k}`), outcome: Shown["outcome"] = {}, list: Suggestion[] = [];
      edits.forEach((e, k) => {
        const at = placeNow(e, body, now);
        outcome[ids[k]!] = at ? "waiting" : "lost";
        if (at) list.push({ id: ids[k], ...at, insert: e.insert, model: r.reply.model });
      });
      turns = [...turns, { turn: r.turn, ids, outcome }];
      // The places were for this turn: the next one marks its own.
      markPlaces(view, { passage: null, here: null });
      if (list.length) suggestAll(view, list);
      setDraft("");
    } catch (err) {
      failed = (err as Error).name === "AbortError" ? "Stopped." : (err as Error).message;
    } finally {
      busy = null; stop = null; asking = null;
      toEnd();
    }
  }

  /** The note's editor says a suggestion was accepted or rejected (NoteEditor passes it on). */
  export function suggestion(what: "accepted" | "rejected", sg: Suggestion) {
    const id = sg.id ?? "";
    const t = turns.find((x) => x.outcome && id in x.outcome);
    if (t?.outcome) t.outcome[id] = what;
  }
  const waiting = (t: Shown) => (t.ids ?? []).filter((id) => t.outcome?.[id] === "waiting");
  const SAID: Record<string, string> = { accepted: "Accepted", rejected: "Rejected", lost: "Not placed: the note changed while this was written" };
  const KIND = (e: Turn["edits"][number]) => (e.kind === "insert" || !e.old ? "Add" : !e.new ? "Delete" : "Replace");

  // ---- the chats kept
  let chats = $state<ChatSummary[] | null>(null);
  let keeping = $state(true), listError = $state("");
  async function listChats() {
    try { const got = await keptChats(session.id); chats = got.chats; keeping = got.enabled; listError = ""; }
    catch (err) { chats = []; listError = (err as Error).message; }
  }
  async function openChat(id: string) {
    try {
      const c = await keptChat(id);
      turns = c.turns.map((turn) => ({ turn }));
      chatId = c.id; failed = ""; figure = null; figureReply = null; problems = [];
      toEnd();
    } catch (err) { listError = (err as Error).message; chats = null; void listChats(); }
  }
  function newChat() {
    stop?.abort();
    turns = []; chatId = null; failed = ""; figure = null; figureReply = null; problems = []; outcome = "";
    if (chats === null) void listChats();
  }
  async function deleteChat(id: string) {
    if (!confirm("Delete this chat from your record? This cannot be undone.")) return;
    try { await forgetChat(id, token()); listError = ""; } catch (err) { listError = (err as Error).message; }
    chats = null;
    if (chatId === id) { turns = []; chatId = null; }
    void listChats();
  }
  const showing = $derived(turns.length > 0 || busy !== null || !!failed || figureReply !== null);

  // ---- what it cost: the last turn's, kept in view below the chat
  const last = $derived(turns.at(-1)?.turn ?? null);
  const total = $derived(turns.reduce((n, t) => n + (t.turn.cost || 0), 0));
  const by = (t: Turn, how: Step["how"]) => t.steps.filter((s) => !s.failed && s.how === how).length;
  const sourceHref = (s: Reply["sources"][number]) => (s.kind === "note" ? conceptHref(s.id) : store.code?.items.some((i) => i.id === s.id) ? codeHref(s.id) : null);

  // ------------------------------------------------------------ a figure (T78)
  // The model writes an artifact; it is loaded out of sight and checked (no errors, light, quick, idle until
  // touched), sent back to be put right up to twice, and only then shown. Nothing is written until it is
  // accepted: then the file is saved beside the note and its embed put below the passage.
  async function makeFigure() {
    if (!view || busy) return;
    const p = placesOf(view), sel = selectionOf(view);
    const from = p.passage?.from ?? sel.from, to = p.passage?.to ?? sel.to, body = view.state.doc.toString(), asked = draft.trim() || undefined;
    if (!asked && from === to) { qview?.focus(); return; }
    busy = "figure"; streaming = ""; looked = []; figureReply = null; outcome = ""; failed = ""; figure = null; problems = []; stage = "Writing the figure…";
    stop = new AbortController();
    toEnd();
    try {
      let fix: { html: string; problems: string[] } | undefined;
      for (let round = 0; round < 3; round++) {
        const r = await askAssist(session.id, { mode: "figure", tier: tier || undefined, body, from, to, prompt: asked, title: session.fields.title || undefined, fix }, () => {}, stop.signal);
        figureReply = r;
        if (!r.artifact) { failed = "No figure was written."; break; }
        stage = "Checking that it loads, raises no error and stays light…";
        const name = slug(r.artifact.title) || "figure";
        const c = await checkFigure(`${dir ? dir + "/" : ""}${name}.html`, r.artifact.title, r.artifact.html);
        // A selection of whole lines ends at the start of the next one: the figure goes under the last line selected.
        if (!c.problems.length) { figure = { ...r.artifact, url: c.url, model: r.model, at: to > from && body[to - 1] === "\n" ? to - 1 : Math.max(from, to) }; setDraft(""); break; }
        problems = c.problems;
        if (round === 2) { failed = "The figure was not good enough to offer, after two tries at putting it right:"; break; }
        stage = `Putting it right (${round + 1} of 2): ${c.problems[0]}`;
        fix = { html: r.artifact.html, problems: c.problems };
      }
    } catch (err) {
      failed = (err as Error).name === "AbortError" ? "Stopped." : (err as Error).message;
    } finally {
      busy = null; stop = null; stage = "";
      toEnd();
    }
  }
  function showFigure(host: HTMLElement) {
    const f = figure;
    if (!f) return;
    const m = mountArtifact(host, "preview", { fit: "content", eager: true, caption: f.caption, held: { src: f.url, title: f.title } });
    return () => m.destroy();
  }
  async function acceptFigure() {
    const f = figure;
    if (!f || !view) return;
    try {
      const path = await saveFigure(dir, slug(f.title) || "figure", f.html, `openrouter/${f.model.replace(/^openrouter\//, "")}`);
      await store.refresh(); // the new artifact, so the preview in the note can show it
      rejectAll(view);
      const line = view.state.doc.lineAt(Math.min(f.at, view.state.doc.length));
      const caption = (f.caption || f.title).replace(/[\[\]\n]/g, " ").trim();
      suggest(view, { from: line.to, to: line.to, insert: `![${caption}](${path.split("/").pop()})`, model: f.model });
      acceptSuggestion(view);
      outcome = `Saved as ${path} and put in the note. The note is saved when you save.`;
      figure = null;
    } catch (err) { failed = (err as Error).message; }
  }
  function dropFigure() { figure = null; figureReply = null; problems = []; outcome = ""; failed = ""; }

  function submit(e: Event) {
    e.preventDefault();
    if (busy) { stop?.abort(); return; }
    void ask();
  }
  // Ctrl+Enter asks, before the editor makes a line of it.
  function keys(node: HTMLElement) {
    const down = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); e.stopPropagation();
      if (!busy) void ask();
    };
    node.addEventListener("keydown", down, true);
    return () => node.removeEventListener("keydown", down, true);
  }
</script>

{#snippet looking(steps: Step[])}
  <ol class="aq-steps">{#each steps as s, k (k)}<li class={[s.failed && "failed"]}>{s.said}{#if s.from}<span> (by a link from {store.concepts.get(s.from)?.title ?? s.from})</span>{/if}</li>{/each}</ol>
{/snippet}

{#snippet asked(question: string, about: string, line: number, may: { passage: boolean; note: boolean }, label: string)}
  <blockquote class="aq-question">
    <span class="aq-label">{label}</span>
    {#if question}<Prose html={render(question, { dir })} class="prose" />{/if}
    {#if about}<p class="nx-about"><b>About</b> <q>{brief(about, 140)}</q>{may.passage ? " · it may change this" : ""}</p>{/if}
    {#if line}<p class="nx-about"><b>New text</b> at line {line}</p>{/if}
    {#if may.note}<p class="nx-about"><b>It may edit</b> anywhere in the note</p>{/if}
  </blockquote>
{/snippet}

<aside class="axis-panel note-axis folded" aria-label="Axis" bind:this={panel} hidden={!available}>
  <!-- A separator that can be moved takes the focus (the arrow keys resize it). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="axis-grip" role="separator" tabindex="0" aria-label="Resize the Axis panel" title="Drag to resize" bind:this={grip}></div>
  <header class="axis-head">
    <button class="toggle axis-tab" type="button" aria-expanded={open} title="Put the Axis panel away" onclick={toggle}>Axis</button>
    {#if showing}<button class="toggle axis-back" type="button" title="Put this chat away and show the chats about this note" onclick={newChat}>Chats</button>{/if}
  </header>

  <div class="axis-body" bind:this={scroller}>
    {#if connected === false}
      <p class="aq-also">To ask a model about this note or have it propose changes, <a href="#/teacher">connect a model account for Axis</a>.</p>
    {:else if !showing}
      {#if listError}<p class="aq-error" role="alert">{listError}</p>{/if}
      {#if !keeping}<p class="aq-also">Chats are not kept: the learner record is off.</p>
      {:else if chats === null}<p class="aq-also">…</p>
      {:else if !chats.length}<p class="aq-also">Ask about this note, or have changes proposed to it. Select text in the note to ask about that passage. Chats are kept here, to read again and go on from.</p>
      {:else}
        <h4>Chats about this note</h4>
        <ul class="aq-asked">
          {#each chats as c (c.id)}
            <li>
              <button class="aq-ask" type="button" title="Open this chat" onclick={() => void openChat(c.id)}>
                <span class="aq-ask-q">{@html inline(firstLine(c.question) || "About a passage")}</span>
                <span class="aq-ask-meta">{[when(c.updated), plural(c.turns, "turn"), money(c.cost)].join(" · ")}</span>
              </button>
              <button class="aq-drop" type="button" aria-label={`Delete the chat: ${firstLine(c.question)}`} title="Delete this chat" onclick={() => void deleteChat(c.id)}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      {#each turns as t, n (n)}
        {@const turn = t.turn}
        <article class="nx-turn">
          {@render asked(turn.question, turn.passage ?? "", turn.here?.line ?? 0, turn.may, t.ids ? "Question" : `Asked ${when(turn.at)}`)}
          <Prose html={render(turn.answer || (turn.edits.length ? "" : "No answer was written."), { dir })} class="prose aq-text" />
          {#if turn.edits.length}
            <h4>Proposed {turn.edits.length === 1 ? "change" : `changes (${turn.edits.length})`}</h4>
            <ol class="nx-edits">
              {#each turn.edits as e, k (k)}
                {@const id = t.ids?.[k]}
                {@const state = id ? t.outcome?.[id] : undefined}
                <li class={[state]}>
                  <span class="nx-kind">{KIND(e)} · line {e.line}</span>
                  {#if e.old}<del>{brief(e.old, 160)}</del>{/if}
                  {#if e.new}<ins>{brief(e.new, 220)}</ins>{/if}
                  {#if state === "waiting"}
                    <span class="nx-acts">
                      <button class="toggle primary" type="button" onclick={() => view && acceptSuggestion(view, id)}>Accept</button>
                      <button class="toggle" type="button" onclick={() => view && rejectSuggestion(view, id)}>Reject</button>
                    </span>
                  {:else if state}<span class="nx-said">{SAID[state]}</span>{/if}
                </li>
              {/each}
            </ol>
            {#if waiting(t).length > 1}
              <p class="aq-acts">
                <button class="toggle primary" type="button" onclick={() => view && acceptAll(view)}>Accept all</button>
                <button class="toggle" type="button" onclick={() => view && rejectAll(view)}>Reject all</button>
              </p>
            {:else if waiting(t).length}
              <p class="aq-also">It is marked in the note. Nothing changes until you accept it, and the note is saved when you save.</p>
            {/if}
          {/if}
          {#each turn.dropped as d (d)}<p class="aq-since" role="note">{d}</p>{/each}
          {#if turn.steps.length}
            <details class="aq-looked"><summary>Looked up {plural(turn.steps.length, "thing")}</summary>{@render looking(turn.steps)}</details>
          {:else}
            <p class="aq-also">Nothing was looked up: it worked from the note alone.</p>
          {/if}
          {#if turn.sources.length}
            <p class="aq-also">Drew on:
              {#each turn.sources as s, k (s.kind + s.id + (s.line ?? "") + k)}
                {@const href = sourceHref(s)}
                {#if href}<a {href} target="_blank" rel="noopener">{s.kind === "note" ? s.title : `${s.id}${s.line ? `:${s.line}` : ""}`}</a>{:else}<code>{s.id}{s.line ? `:${s.line}` : ""}</code>{/if}{k < turn.sources.length - 1 ? ", " : ""}
              {/each}
            </p>
          {/if}
        </article>
      {/each}

      {#if busy === "chat" && asking}
        <article class="nx-turn" aria-live="polite">
          {@render asked(asking.question, asking.passage, asking.here, asking.may, "Question")}
          <ol class="aq-steps" aria-label="What is being looked up">
            {#each looked as s, k (k)}<li class={[s.failed && "failed"]}>{s.said}</li>{/each}
            <li class="aq-now">{streaming ? "Writing…" : looked.length ? "Reading…" : "Looking…"}</li>
          </ol>
          {#if streaming}<Prose html={render(streaming, { dir })} class="prose aq-text" />{/if}
        </article>
      {/if}

      {#if busy === "figure" || figureReply}
        <article class="nx-turn nx-figure" aria-live="polite">
          <h4>Figure</h4>
          {#if busy === "figure"}
            <p class="aq-also">{stage}</p>
          {:else if figureReply}
            {#if failed}<p class="aq-error" role="alert">{failed}</p>{/if}
            {#if problems.length && !figure}<ul class="assist-problems">{#each problems as pr (pr)}<li>{pr}</li>{/each}</ul>{/if}
            {#if figure}
              {#key figure.url}<div class="assist-figure" {@attach showFigure}></div>{/key}
              {#if figureReply.answer}<Prose html={render(figureReply.answer, { dir })} class="prose aq-text" />{/if}
              <p class="aq-also">Checked: it loads without error, is light and stays idle. Nothing is saved yet.</p>
              <p class="aq-acts">
                <button class="toggle primary" type="button" onclick={() => void acceptFigure()}>Put it in the note</button>
                <button class="toggle" type="button" onclick={dropFigure}>Discard</button>
              </p>
            {:else if outcome}<p class="aq-also">{outcome}</p>{/if}
            <p class="aq-also">{figureReply.tier ? `${figureReply.tier} · ` : ""}{figureReply.model} · {money(figureReply.cost)}</p>
          {/if}
        </article>
      {/if}
      {#if failed && !figureReply}<p class="aq-error" role="alert">{failed}</p>{/if}
    {/if}
  </div>

  {#if last && showing && busy !== "chat"}
    {@const s = last.spent}
    <details class="axis-cost">
      <summary title="What the last answer used">
        <b class="axis-price">{money(last.cost)}</b>
        {#if s}<span>{count(s.input)} in · {count(s.output)} out</span>{/if}
        <span class="axis-model">{last.tier} · {last.model}</span>
      </summary>
      <dl>
        {#if s}
          <dt>Sent to the model</dt><dd>{plural(s.input, "token")}{s.cached ? `, ${count(s.cached)} of them read from its cache` : ""}</dd>
          <dt>Written by it</dt><dd>{plural(s.output, "token")}</dd>
          <dt>Calls to the model</dt><dd>{count(s.calls)}</dd>
        {/if}
        <dt>Searches of words</dt><dd>{count(by(last, "search"))}</dd>
        {#if by(last, "meaning")}<dt>Searches by meaning</dt><dd>{count(by(last, "meaning"))}</dd>{/if}
        <dt>Notes read</dt><dd>{count(by(last, "read") + by(last, "link"))}{by(last, "link") ? `, ${count(by(last, "link"))} by a link` : ""}</dd>
        {#if by(last, "code")}<dt>Code looked up</dt><dd>{count(by(last, "code"))}</dd>{/if}
        {#if last.steps.some((x) => x.failed)}<dt>Lookups that failed</dt><dd>{count(last.steps.filter((x) => x.failed).length)}</dd>{/if}
        <dt>Model</dt><dd>{last.model} ({last.tier})</dd>
        <dt>This chat so far</dt><dd>{money(total)} over {plural(turns.length, "turn")}</dd>
      </dl>
    </details>
  {/if}

  {#if connected === true}
    <form class="atlas-ask note-ask" aria-label="Ask Axis about this note" onsubmit={submit} {@attach keys}>
      <div class="nx-context">
        {#if places.passage}
          <span class="nx-chip">
            <button type="button" class="nx-chip-show" title="Show the marked passage in the note" onclick={() => show(places.passage?.from)}><b>About</b> “{brief(passage, 48)}”</button>
            <button type="button" class="nx-chip-drop" aria-label="Unmark the passage" title="Unmark the passage" onclick={dropPassage}>×</button>
          </span>
          <label class="nx-may" title="Let Axis propose a new text for the marked passage, for you to accept or reject"><input type="checkbox" bind:checked={mayPassage} disabled={busy !== null} /> <span class="nx-long">Axis may change it</span><span class="nx-short">May change it</span></label>
        {:else}
          <span class="nx-hint">Select text in the note to ask about it.</span>
        {/if}
        {#if places.here !== null}
          <span class="nx-chip here">
            <button type="button" class="nx-chip-show" title="Show the place in the note" onclick={() => show(places.here)}><b>New text</b> at line {hereLine}</button>
            <button type="button" class="nx-chip-drop" aria-label="Unset the place for new text" title="Unset the place" onclick={dropHere}>×</button>
          </span>
        {:else}
          <button type="button" class="toggle nx-set" disabled={busy !== null} title="Mark where the cursor is in the note as the place for new text, apart from any passage marked" onclick={setHere} aria-label="Put new text at the cursor"><span class="nx-long">Put new text at the cursor</span><span class="nx-short">New text at cursor</span></button>
        {/if}
        <label class="nx-may" title="Let Axis choose where to add, reword or delete, anywhere in the note. Each change is a suggestion for you to accept or reject."><input type="checkbox" bind:checked={mayNote} disabled={busy !== null} /> <span class="nx-long">Axis may edit anywhere in the note</span><span class="nx-short">May edit anywhere</span></label>
      </div>
      <div class="answer-editor axis-editor" bind:this={qhost}></div>
      <div class="axis-row">
        <span class="axis-keys">Ctrl+Enter asks</span>
        <select class="assist-tier" bind:value={tier} onchange={keepTier} disabled={busy !== null} aria-label="How strong a model to ask"
          title="How strong a model to ask. Usual: mid for a chat, max for a figure. Set which models these are on the Axis page.">
          <option value="">Usual</option>
          <option value="low">Low{tiers ? ` · ${short(tiers.low)}` : ""}</option>
          <option value="mid">Mid{tiers ? ` · ${short(tiers.mid)}` : ""}</option>
          <option value="max">Max{tiers ? ` · ${short(tiers.max)}` : ""}</option>
        </select>
        <button class="toggle" type="button" disabled={busy !== null || (!places.passage && !draft.trim())} onclick={() => void makeFigure()}
          title="Have an interactive figure made for the marked passage, checked, and shown to accept or discard">Figure</button>
        <button class="toggle primary" type="submit" disabled={busy === null && !places.passage && !draft.trim()}>{busy ? "Stop" : "Ask"}</button>
      </div>
    </form>
  {/if}
</aside>
