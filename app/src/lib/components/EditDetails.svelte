<script lang="ts">
  // Under the title of a note being edited: its details (frontmatter) as a
  // form, in a dropdown. Other fields in the frontmatter are kept as they are.
  import type { EditSession } from "$lib/edit.svelte.ts";
  import { store } from "$lib/data.svelte.ts";

  let { session }: { session: EditSession } = $props();

  // Types and statuses already used in this bundle, offered as suggestions.
  const used = (key: "type" | "status") => [...new Set([...store.concepts.values()].map((c) => c[key]).filter(Boolean))].sort();
  const types = $derived(used("type"));
  const statuses = $derived(used("status"));
  const others = $derived(Object.keys(session.source?.meta ?? {}).filter((k) => !["type", "title", "description", "tags", "status"].includes(k)));
</script>

<!-- Under the note's title, closed until asked for. -->
<details class="edit-details-drop" id="edit-details">
  <summary>Details{#if session.fields.type}<span class="chip">{session.fields.type}</span>{/if}{#if session.fields.status && session.fields.status !== "stable"}<span class="chip">{session.fields.status}</span>{/if}</summary>
  <div class="edit-details">
    <label>Title
      <input type="text" bind:value={session.fields.title} oninput={() => session.changed()} disabled={!session.source} />
    </label>
    <label>Description
      <textarea rows="3" bind:value={session.fields.description} oninput={() => session.changed()} disabled={!session.source}></textarea>
      <span class="hint">One sentence: what the note says, shown in lists and on the map.</span>
    </label>
    <div class="edit-details-row">
      <label>Type
        <input type="text" list="edit-types" bind:value={session.fields.type} oninput={() => session.changed()} disabled={!session.source} required />
      </label>
      <datalist id="edit-types">{#each types as t (t)}<option value={t}></option>{/each}</datalist>
      <label>Status
        <input type="text" list="edit-statuses" bind:value={session.fields.status} oninput={() => session.changed()} disabled={!session.source}
          autocapitalize="off" placeholder="stable" />
      </label>
      <datalist id="edit-statuses">{#each statuses as s (s)}<option value={s}></option>{/each}</datalist>
    </div>
    <label>Tags
      <input type="text" bind:value={session.fields.tags} oninput={() => session.changed()} disabled={!session.source}
        autocapitalize="off" autocomplete="off" />
      <span class="hint">Separated by commas.</span>
    </label>
    {#if others.length}
      <p class="section-note">Also in the frontmatter, unchanged: {others.join(", ")}.</p>
    {/if}
    <p class="section-note">Saved edits are recorded as yours. Editing a note does not mark it reviewed; that stays a separate step.</p>
  </div>
</details>
