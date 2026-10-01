<script lang="ts">
  // A modal dialog (the browser's own: focus stays inside, Escape closes) with
  // a form: the main action submits it, so Enter works too. On a phone it
  // rises from the bottom, within reach of a thumb.
  import type { Snippet } from "svelte";

  let { title, action, danger = false, disabled = false, busy = false, error = "", onsubmit, onclose, children }: {
    title: string;
    action: string; // the main button's label
    danger?: boolean;
    disabled?: boolean; // the main button, until the form is ready (a confirmation ticked)
    busy?: boolean;
    error?: string;
    onsubmit: () => void;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const open = (el: HTMLDialogElement) => {
    el.showModal();
    return () => el.close();
  };
</script>

<dialog class="sheet" {@attach open} aria-labelledby="sheet-title" onclose={onclose}
  onclick={(e) => { if (e.target === e.currentTarget && !busy) onclose(); }}>
  <form method="dialog" onsubmit={(e) => { e.preventDefault(); if (!busy && !disabled) onsubmit(); }}>
    <h2 id="sheet-title">{title}</h2>
    {@render children()}
    {#if error}<p class="sheet-error" role="alert">{error}</p>{/if}
    <div class="sheet-actions">
      <button class="toggle" type="button" onclick={onclose} disabled={busy}>Cancel</button>
      <button class={["toggle", danger ? "danger" : "primary"]} type="submit" disabled={busy || disabled}>{busy ? "Working…" : action}</button>
    </div>
  </form>
</dialog>
