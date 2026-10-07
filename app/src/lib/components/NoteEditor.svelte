<script lang="ts">
  // Editing a note's text, in place of the rendered page. The session (shared
  // with the details form beside it) loads, keeps drafts and saves; this shows
  // the editor, what is happening, and a note changed meanwhile to compare.
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { store } from "$lib/data.svelte.ts";
  import type { EditSession } from "$lib/edit.svelte.ts";
  import { askAssist, streamingFill, type Mode, type Reply, type Tier } from "$lib/assist.ts";
  import { mountArtifact } from "$lib/artifactFrame.ts";
  import { slug } from "$lib/edit.svelte.ts";
  import { check as checkFigure, save as saveFigure } from "$lib/figure.ts";
  import { acceptSuggestion, applyFormat, createEditor, rejectSuggestion, selectionOf, setSource, setText, suggest, type Format } from "$lib/editor/codemirror.ts";
  import { codeHref } from "$lib/code.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { ai, money } from "$lib/teacher.svelte.ts";
  import FormatBar from "./FormatBar.svelte";
  import Prose from "./Prose.svelte";

  let { session, onDone }: { session: EditSession; onDone: () => void } = $props();

  let host = $state<HTMLDivElement>();
  let view: EditorView | null = null;
  let comparing = $state(false);

  // Live preview, or plain Markdown: remembered in this browser.
  const SOURCE_KEY = "rdstudio.editor.source";
  let source = $state((() => { try { return localStorage.getItem(SOURCE_KEY) === "1"; } catch { return false; } })());
  function toggleSource() {
    source = !source;
    try { localStorage.setItem(SOURCE_KEY, source ? "1" : "0"); } catch { /* not remembered */ }
    if (view) { setSource(view, source); view.focus(); }
  }
  const notes = () => [...store.concepts.values()].filter((c) => c.id !== session.id)
    .map((c) => ({ id: c.id, title: c.title, folder: c.directory }));

  const STATUS: Record<string, string> = {
    loading: "Opening…", saving: "Saving…", saved: "Saved", conflict: "Changed elsewhere", error: "Not saved",
  };
  const status = $derived(session.status === "ready" ? (session.dirty ? "Unsaved changes" : "No changes") : STATUS[session.status]);

  // The editor is made once the note has loaded, and its text replaced when
  // the session replaces it (a restored draft, their version).
  // (Typing changes the session's text, which is not a reason to run this.)
  $effect(() => {
    if (!host || !session.source) return;
    const parent = host, revision = session.revision;
    untrack(() => {
      if (!view) {
        view = createEditor(parent, {
          doc: session.body,
          label: `Text of ${session.fields.title || session.id}`,
          onChange: (text) => { session.body = text; session.changed(); },
          onSave: () => void session.save(),
          notes,
          dir: session.id.includes("/") ? session.id.slice(0, session.id.lastIndexOf("/")) : "",
          source,
          onSelect: (text) => { selected = text.trim().length > 0; },
          onSuggestion: (what, sg) => {
            waiting = false;
            if (what === "accepted") session.assisted.add(sg.model);
            outcome = what === "accepted" ? "Accepted into the note. It is yours to edit, and is saved when you save." : "Rejected: the note is as it was.";
          },
        });
        view.focus();
      } else if (revision && view.state.doc.toString() !== session.body) {
        setText(view, session.body);
      }
    });
  });

  onMount(() => {
    void session.load();
    void ai.state().then((st) => { connected = st ? st.connected : null; tiers = st?.tiers ?? null; });
    // Leaving the page with unsaved changes asks first (the draft is kept anyway).
    const leave = (e: BeforeUnloadEvent) => { if (session.dirty) e.preventDefault(); };
    addEventListener("beforeunload", leave);
    return () => { removeEventListener("beforeunload", leave); view?.destroy(); view = null; };
  });

  const format = (what: Format) => { if (view) applyFormat(view, what); };

  // An agent in the editor (T74): ask the connected model about the selection, or for text to go at the
  // caret (or in place of the selection). An answer is shown below the bar and changes nothing; proposed
  // text is a suggestion in the note to accept or reject.
  // How strong a model to ask (T83): the mode's usual tier, or one chosen here and remembered.
  const TIER_KEY = "rdstudio.assist.tier";
  let tiers = $state<{ low: string; mid: string; max: string } | null>(null);
  let tier = $state<"" | Tier>("");
  try { const t = localStorage.getItem(TIER_KEY); if (t === "low" || t === "mid" || t === "max") tier = t; } catch { /* no storage */ }
  const keepTier = () => { try { if (tier) localStorage.setItem(TIER_KEY, tier); else localStorage.removeItem(TIER_KEY); } catch { /* no storage */ } };
  const short = (m: string | undefined) => (m ?? "").split("/").pop() ?? "";
  let connected = $state<boolean | null>(null); // a model account is connected (null: no server to ask, or not known yet)
  let prompt = $state("");
  let selected = $state(false);
  let busy = $state<Mode | null>(null);
  let streaming = $state("");
  let reply = $state<Reply | null>(null);
  let waiting = $state(false); // a suggestion is in the note, neither accepted nor rejected
  let outcome = $state("");
  let failed = $state("");
  let stop: AbortController | null = null;
  const dir = $derived(session.id.includes("/") ? session.id.slice(0, session.id.lastIndexOf("/")) : "");

  async function ask(mode: Mode) {
    if (!view || busy) return;
    if (waiting) rejectSuggestion(view); // one suggestion at a time
    const { from, to } = selectionOf(view);
    busy = mode; streaming = ""; reply = null; outcome = ""; failed = "";
    stop = new AbortController();
    try {
      const r = await askAssist(session.id, { mode, tier: tier || undefined, body: view.state.doc.toString(), from, to, prompt: prompt.trim() || undefined, title: session.fields.title || undefined },
        (soFar) => { streaming = mode === "fill" ? streamingFill(soFar) : soFar; }, stop.signal);
      reply = r;
      if (mode === "fill" && r.insert !== null) {
        // The note may have been typed in since: the place is where the selection is now if it has not moved, else where it was asked.
        suggest(view, { from: Math.min(r.from, view.state.doc.length), to: Math.min(r.to, view.state.doc.length), insert: r.insert, model: r.model });
        waiting = true;
        prompt = "";
        view.focus(); // so that Ctrl+Enter accepts and Esc rejects
      } else if (mode === "ask") prompt = "";
    } catch (err) {
      if ((err as Error).name !== "AbortError") failed = (err as Error).message;
    } finally {
      busy = null; stop = null;
    }
  }
  // Make a figure (T78): the model writes an artifact; it is loaded out of sight and checked (no errors, light,
  // quick, idle until touched), sent back to be put right up to twice, and only then shown. Nothing is
  // written until it is accepted: then the file is saved beside the note and its embed put below the passage.
  let figure = $state<{ title: string; caption: string; html: string; url: string; model: string; at: number } | null>(null);
  let stage = $state("");
  let problems = $state<string[]>([]);
  async function makeFigure() {
    if (!view || busy) return;
    if (waiting) rejectSuggestion(view);
    const { from, to } = selectionOf(view), body = view.state.doc.toString(), asked = prompt.trim() || undefined;
    busy = "figure"; streaming = ""; reply = null; outcome = ""; failed = ""; figure = null; problems = []; stage = "Writing the figure…";
    stop = new AbortController();
    try {
      let fix: { html: string; problems: string[] } | undefined;
      for (let round = 0; round < 3; round++) {
        const r = await askAssist(session.id, { mode: "figure", tier: tier || undefined, body, from, to, prompt: asked, title: session.fields.title || undefined, fix }, () => {}, stop.signal);
        reply = r;
        if (!r.artifact) { failed = "No figure was written."; break; }
        stage = "Checking that it loads, raises no error and stays light…";
        const name = slug(r.artifact.title) || "figure";
        const c = await checkFigure(`${dir ? dir + "/" : ""}${name}.html`, r.artifact.title, r.artifact.html);
        if (!c.problems.length) { figure = { ...r.artifact, url: c.url, model: r.model, at: Math.max(from, to) }; prompt = ""; break; }
        problems = c.problems;
        if (round === 2) { failed = "The figure was not good enough to offer, after two tries at putting it right:"; break; }
        stage = `Putting it right (${round + 1} of 2): ${c.problems[0]}`;
        fix = { html: r.artifact.html, problems: c.problems };
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") failed = (err as Error).message;
    } finally {
      busy = null; stop = null; stage = "";
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
      const line = view.state.doc.lineAt(Math.min(f.at, view.state.doc.length));
      const caption = (f.caption || f.title).replace(/[\[\]\n]/g, " ").trim();
      suggest(view, { from: line.to, to: line.to, insert: `![${caption}](${path.split("/").pop()})`, model: f.model });
      acceptSuggestion(view);
      outcome = `Saved as ${path} and put in the note. The note is saved when you save.`;
      figure = null;
    } catch (err) { failed = (err as Error).message; }
  }
  const sourceHref = (s: Reply["sources"][number]) => (s.kind === "note" ? conceptHref(s.id) : store.code?.items.some((i) => i.id === s.id) ? codeHref(s.id) : null);
  function closeReply() {
    if (waiting && view) rejectSuggestion(view);
    reply = null; streaming = ""; outcome = ""; failed = ""; figure = null; problems = [];
  }

  async function done() {
    if (session.dirty && !(await session.save())) return;
    onDone();
  }

  function cancel() {
    if (session.dirty && !confirm("Discard your changes to this note?")) return;
    session.discard();
    onDone();
  }
</script>

<article class="doc editing" aria-busy={session.status === "loading" || session.status === "saving"}>
  <div class="edit-top">
    <div class="edit-bar" role="toolbar" aria-label="Editing">
      <span class={["edit-status", session.status]} role="status" aria-live="polite">{status}</span>
      <span class="edit-actions">
        <button class="toggle details-button" type="button" aria-expanded={session.detailsOpen} aria-controls="edit-details"
          onclick={() => (session.detailsOpen = !session.detailsOpen)}>Details</button>
        <button class="toggle" type="button" aria-pressed={source} onclick={toggleSource}
          title="Show the Markdown as it is written, instead of the live preview">Source</button>
        <button class="toggle" type="button" onclick={cancel}>Cancel</button>
        <button class="toggle" type="button" onclick={() => void session.save()}
          disabled={!session.dirty || session.status === "saving" || session.status === "conflict"}>Save</button>
        <button class="toggle primary" type="button" onclick={done} disabled={session.status === "saving" || session.status === "conflict"}>Done</button>
      </span>
    </div>
    <FormatBar onformat={format} hidden={!session.source || session.detailsOpen} />
    {#if connected !== null && session.source && !session.detailsOpen}
      {#if connected}
        <form class="assist-bar" aria-label="Ask Axis" onsubmit={(e) => { e.preventDefault(); void ask(selected && !prompt.trim() ? "ask" : "fill"); }}>
          <input type="text" bind:value={prompt} disabled={busy !== null} aria-label="Your question, or what to write"
            placeholder={selected ? "Ask about the selection, or say how to rewrite it" : "Say what to write at the cursor, or ask about the note"} />
          <button class="toggle" type="button" disabled={busy !== null || (!selected && !prompt.trim())} onclick={() => void ask("ask")}
            title="An answer beside the note; nothing in it changes">Ask</button>
          <button class="toggle" type="button" disabled={busy !== null || (!selected && !prompt.trim())} onclick={() => void ask("fill")}
            title={selected ? "Propose text in place of the selection, to accept or reject" : "Propose text at the cursor, to accept or reject"}>{selected ? "Rewrite" : "Write here"}</button>
          <button class="toggle" type="button" disabled={busy !== null || (!selected && !prompt.trim())} onclick={() => void makeFigure()}
            title="Have an interactive figure made for the selection, checked, and shown to accept or discard">Figure</button>
          <select class="assist-tier" bind:value={tier} onchange={keepTier} disabled={busy !== null} aria-label="How strong a model to ask"
            title="How strong a model to ask. Usual: mid for questions and text, max for a figure. Set which models these are on the Axis page.">
            <option value="">Usual</option>
            <option value="low">Low{tiers ? ` · ${short(tiers.low)}` : ""}</option>
            <option value="mid">Mid{tiers ? ` · ${short(tiers.mid)}` : ""}</option>
            <option value="max">Max{tiers ? ` · ${short(tiers.max)}` : ""}</option>
          </select>
          {#if busy}<button class="toggle" type="button" onclick={() => stop?.abort()}>Stop</button>{/if}
        </form>
      {:else}
        <p class="assist-off">To ask a model about this note or have it draft text, <a href="#/teacher">connect a model account for Axis</a>.</p>
      {/if}
    {/if}
  </div>

  {#if busy || reply || failed}
    <section class="assist-reply" aria-live="polite" aria-label="The model's reply">
      <header>
        <b>{busy === "figure" || reply?.mode === "figure" ? "Figure" : busy === "fill" || reply?.mode === "fill" ? "Suggested text" : "Answer"}</b>
        {#if busy}<span class="assist-meta">Writing…</span>
        {:else if reply}<span class="assist-meta">{reply.tier ? `${reply.tier} · ` : ""}{reply.model} · {money(reply.cost)}</span>{/if}
        <button class="atlas-card-close" type="button" aria-label="Close the reply" onclick={closeReply}>×</button>
      </header>
      {#if failed}<p class="edit-message bad">{failed}</p>{/if}
      {#if busy}
        {#if stage}<p class="assist-actions"><span>{stage}</span></p>{/if}
        {#if streaming}<pre class="assist-stream">{streaming}</pre>{/if}
      {:else if reply}
        {#if reply.mode === "figure"}
          {#if problems.length && !figure}<ul class="assist-problems">{#each problems as pr (pr)}<li>{pr}</li>{/each}</ul>{/if}
          {#if figure}
            {#key figure.url}<div class="assist-figure" {@attach showFigure}></div>{/key}
            {#if reply.answer}<Prose html={render(reply.answer, { dir })} class="prose assist-answer" />{/if}
            <p class="assist-actions">
              <span>Checked: it loads without error, is light and stays idle. Nothing is saved yet.</span>
              <button class="toggle primary" type="button" onclick={() => void acceptFigure()}>Put it in the note</button>
              <button class="toggle" type="button" onclick={closeReply}>Discard</button>
            </p>
          {:else if outcome}<p class="assist-actions"><span>{outcome}</span></p>{/if}
        {:else if reply.mode === "ask"}
          <Prose html={render(reply.answer, { dir })} class="prose assist-answer" />
        {:else if reply.insert === null}
          <p class="edit-message">No text was proposed.</p>
          {#if reply.answer}<Prose html={render(reply.answer, { dir })} class="prose assist-answer" />{/if}
        {:else}
          {#if reply.answer}<Prose html={render(reply.answer, { dir })} class="prose assist-answer" />{/if}
          {#if waiting}
            <p class="assist-actions">
              <span>It is marked in the note.</span>
              <button class="toggle primary" type="button" onclick={() => view && acceptSuggestion(view)}>Accept</button>
              <button class="toggle" type="button" onclick={() => view && rejectSuggestion(view)}>Reject</button>
            </p>
          {:else if outcome}<p class="assist-actions"><span>{outcome}</span></p>{/if}
        {/if}
        {#if reply.sources.length}
          <p class="assist-sources">Drew on:
            {#each reply.sources as s, k (s.kind + s.id + (s.line ?? "") + k)}
              {@const href = sourceHref(s)}
              {#if href}<a {href} target="_blank" rel="noopener">{s.kind === "note" ? s.title : `${s.id}${s.line ? `:${s.line}` : ""}`}</a>{:else}<code>{s.id}{s.line ? `:${s.line}` : ""}</code>{/if}{k < reply.sources.length - 1 ? ", " : ""}
            {/each}
          </p>
        {/if}
      {/if}
    </section>
  {/if}

  {#if session.message && session.status !== "conflict"}
    <p class={["edit-message", session.status === "error" && "bad"]}>{session.message}</p>
  {/if}

  {#if session.status === "conflict" && session.conflict}
    <section class="edit-conflict" aria-labelledby="conflict-head">
      <h2 id="conflict-head">This note changed since you opened it</h2>
      {#if session.conflict.current}
        <p>An agent, or you on another device, saved a different version. Your changes are kept here until you choose.</p>
        <div class="toggles">
          <button class="toggle" type="button" aria-pressed={comparing} onclick={() => (comparing = !comparing)}>Compare</button>
          <button class="toggle" type="button" onclick={() => void session.keepMine()}>Keep mine</button>
          <button class="toggle" type="button" onclick={() => { if (confirm("Discard your changes and use the saved version?")) session.discard(); }}>Use theirs</button>
        </div>
        {#if comparing}
          <div class="compare">
            <div><h3>Yours</h3><pre>{session.body}</pre></div>
            <div><h3>Saved</h3><pre>{session.conflict.current.body}</pre></div>
          </div>
        {/if}
      {:else}
        <p>It was deleted or moved. Your text is still here: copy what you need, or save it as a new note.</p>
      {/if}
    </section>
  {/if}

  {#if session.status === "error" && !session.source}
    <p class="edit-message bad">{session.message}</p>
  {/if}

  <div class="editor" bind:this={host}></div>
</article>
