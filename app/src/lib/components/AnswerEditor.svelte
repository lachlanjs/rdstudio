<script lang="ts">
  // A written answer (an exercise, its working, an explanation), in the same
  // live preview as the note editor: maths, emphasis and lists are shown as
  // they will read while the Markdown stays editable. The editor's code is
  // fetched when a box first appears, so reading pages do not pay for it.
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { store } from "$lib/data.svelte.ts";

  import type { PinMark } from "$lib/editor/pins.ts";

  let { value = $bindable(""), selection = $bindable(""), pins = [], label, placeholder = "", rows = 10 }:
    { value?: string; selection?: string; pins?: PinMark[]; label: string; placeholder?: string; rows?: number } = $props();

  let host = $state<HTMLDivElement>();
  let view: EditorView | null = null;
  let failed = $state(false);
  let setText: ((v: EditorView, t: string) => void) | null = null;
  let pinsMod: typeof import("$lib/editor/pins.ts") | null = null;
  let ready = $state(false);

  /** Select a pin's passage in the draft (from the list of replies). */
  export function reveal(id: string): boolean {
    return !!(view && pinsMod?.revealPin(view, id));
  }

  onMount(() => {
    let gone = false;
    Promise.all([import("$lib/editor/codemirror.ts"), import("$lib/editor/pins.ts")]).then(([cm, pm]) => {
      if (gone || !host) return;
      setText = cm.setText;
      pinsMod = pm;
      view = cm.createEditor(host, {
        doc: untrack(() => value),
        label,
        placeholder,
        inline: true,
        onChange: (text) => { value = text; },
        onSelect: (text) => { selection = text; },
        onSave: () => {},
        notes: () => [...store.concepts.values()].map((c) => ({ id: c.id, title: c.title, folder: c.directory })),
      });
      ready = true;
    }).catch(() => { failed = true; });
    return () => { gone = true; view?.destroy(); view = null; };
  });

  // The pins to show: replaced whenever the list changes (a new reply, a restore).
  $effect(() => {
    const p = pins;
    if (!ready || !view || !pinsMod) return;
    untrack(() => view!.dispatch({ effects: pinsMod!.setPins.of(p) }));
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
