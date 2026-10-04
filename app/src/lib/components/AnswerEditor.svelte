<script lang="ts">
  // A written answer (an exercise, its working, an explanation), in the same
  // live preview as the note editor: maths, emphasis and lists are shown as
  // they will read while the Markdown stays editable. The editor's code is
  // fetched when a box first appears, so reading pages do not pay for it.
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { store } from "$lib/data.svelte.ts";

  let { value = $bindable(""), label, placeholder = "", rows = 10 }: { value?: string; label: string; placeholder?: string; rows?: number } = $props();

  let host = $state<HTMLDivElement>();
  let view: EditorView | null = null;
  let failed = $state(false);
  let setText: ((v: EditorView, t: string) => void) | null = null;

  onMount(() => {
    let gone = false;
    import("$lib/editor/codemirror.ts").then((cm) => {
      if (gone || !host) return;
      setText = cm.setText;
      view = cm.createEditor(host, {
        doc: untrack(() => value),
        label,
        placeholder,
        inline: true,
        onChange: (text) => { value = text; },
        onSave: () => {},
        notes: () => [...store.concepts.values()].map((c) => ({ id: c.id, title: c.title, folder: c.directory })),
      });
    }).catch(() => { failed = true; });
    return () => { gone = true; view?.destroy(); view = null; };
  });

  // Cleared or replaced from outside (Try again): the editor follows.
  $effect(() => {
    const v = value;
    untrack(() => { if (view && setText && view.state.doc.toString() !== v) setText(view, v); });
  });
</script>

{#if failed}
  <!-- The editor did not load (offline after an update, say): a plain box still works. -->
  <textarea class="answer-editor plain" bind:value {rows} aria-label={label} {placeholder}></textarea>
{:else}
  <div class="answer-editor" style:min-height="{rows * 1.6}em" bind:this={host}></div>
{/if}
