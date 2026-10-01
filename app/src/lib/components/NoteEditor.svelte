<script lang="ts">
  // Editing a note's text, in place of the rendered page. The session (shared
  // with the details form beside it) loads, keeps drafts and saves; this shows
  // the editor, what is happening, and a note changed meanwhile to compare.
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { store } from "$lib/data.svelte.ts";
  import type { EditSession } from "$lib/edit.svelte.ts";
  import { applyFormat, createEditor, setSource, setText, type Format } from "$lib/editor/codemirror.ts";
  import FormatBar from "./FormatBar.svelte";

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
          source,
        });
        view.focus();
      } else if (revision && view.state.doc.toString() !== session.body) {
        setText(view, session.body);
      }
    });
  });

  onMount(() => {
    void session.load();
    // Leaving the page with unsaved changes asks first (the draft is kept anyway).
    const leave = (e: BeforeUnloadEvent) => { if (session.dirty) e.preventDefault(); };
    addEventListener("beforeunload", leave);
    return () => { removeEventListener("beforeunload", leave); view?.destroy(); view = null; };
  });

  const format = (what: Format) => { if (view) applyFormat(view, what); };

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
  </div>

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
