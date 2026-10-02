<script lang="ts">
  // At the head of a note you have seen before: it changed since you last
  // looked (with what changed, on request), or a note it requires has changed
  // since you understood it. `look` is the last look before this visit.
  import type { ConceptRecord } from "@rdstudio/core";
  import { diffLines, historyOf, prerequisitesChanged, type Look } from "$lib/catchup.ts";
  import { conceptHref } from "$lib/format.ts";
  import type { NoteHistory } from "$lib/api/types.gen.ts";

  let { c, look }: { c: ConceptRecord; look: Look | null } = $props();

  const changed = $derived(!!look && look.hash !== c.hash);
  const moved = $derived(prerequisitesChanged(c.id));
  let history = $state<NoteHistory | null | undefined>(undefined);
  let open = $state(false);

  const ago = (iso: string) => {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    return days < 1 ? "earlier today" : days === 1 ? "yesterday" : `${days} days ago`;
  };
  async function show() {
    open = !open;
    if (open && history === undefined && look) history = await historyOf(c.id, look.at);
  }
</script>

{#if changed && look}
  <div class="catch-up" role="note">
    <p>Changed since you last looked ({ago(look.at)}).
      <button class="link" type="button" aria-expanded={open} onclick={show}>{open ? "Hide what changed" : "Show what changed"}</button></p>
    {#if open}
      {#if history === undefined}
        <p class="section-note">Looking in the history…</p>
      {:else if !history || !history.available}
        <p class="section-note">There is no history to compare with here (not a git repository).</p>
      {:else}
        {#if history.commits.length}
          <ul class="catch-commits">
            {#each history.commits as k (k.hash)}<li><code>{k.short}</code> {k.subject} <span>{k.author}, {new Date(k.date).toLocaleDateString()}</span></li>{/each}
          </ul>
        {:else}
          <p class="section-note">No commits since; the changes are not committed yet.</p>
        {/if}
        {#if history.diff}
          <div class="catch-diff" aria-label="What changed: removed lines marked −, added lines +">
            {#each diffLines(history.diff) as l, i (i)}<div class={"d-" + l.kind}>{l.kind === "add" ? "+ " : l.kind === "del" ? "− " : l.kind === "hunk" ? "⋯ " : "  "}{l.text}</div>{/each}
          </div>
        {:else if !history.existed}
          <p class="section-note">The note is new since then.</p>
        {/if}
      {/if}
    {/if}
  </div>
{/if}
{#if moved.length}
  <div class="catch-up" role="note">
    <p>Since you {"worked through or understood"} this note, {#each moved as p, i (p.id)}{i ? (i === moved.length - 1 ? " and " : ", ") : ""}<a href={conceptHref(p.id)}>{p.title}</a>{/each}, which it requires, {moved.length === 1 ? "has" : "have"} changed.</p>
  </div>
{/if}
