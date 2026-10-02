<script lang="ts">
  // Writing one of your own tours (an autodidactic task): stops chosen from the
  // notes, each with a sentence of narration. Kept privately beside the
  // learner record; published, it becomes a Tour note in the project.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { isStudyNote, tourBody } from "@rdstudio/core/learning";
  import { learner, store } from "$lib/data.svelte.ts";
  import { createNote, editing, slug } from "$lib/edit.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { stopsOf, tourHref } from "$lib/tours.ts";

  const name = $derived(page.params.name ?? "new");
  const existing = $derived(learner.tours.find((t) => t.name === name) ?? null);

  // Notes to choose from, by title; a title shared by two notes says its folder.
  const choices = $derived.by(() => {
    const notes = [...store.concepts.values()].filter(isStudyNote);
    const count = new Map<string, number>();
    for (const c of notes) count.set(c.title, (count.get(c.title) ?? 0) + 1);
    const byLabel = new Map<string, string>();
    for (const c of notes) byLabel.set(count.get(c.title)! > 1 ? `${c.title} (${c.directory || "top level"})` : c.title, c.id);
    return byLabel;
  });
  const labelOf = (id: string | null) => {
    if (!id) return "";
    for (const [label, x] of choices) if (x === id) return label;
    return "";
  };

  interface Row { key: number; label: string; text: string }
  let nextKey = 0;
  let title = $state(""), description = $state("");
  let rows = $state<Row[]>([]);
  let status = $state(""), busy = $state(false);

  $effect(() => {
    const t = existing;
    if (t) {
      title = t.title; description = t.description;
      rows = stopsOf({ body: t.body, dir: "" }).map((s) => ({ key: nextKey++, label: labelOf(s.id) || s.title, text: s.text }));
    } else if (!rows.length) rows = [{ key: nextKey++, label: "", text: "" }];
  });

  const add = () => { rows = [...rows, { key: nextKey++, label: "", text: "" }]; };
  const remove = (i: number) => { rows = rows.filter((_, j) => j !== i); };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const copy = [...rows];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    rows = copy;
  };

  const unknown = $derived(rows.filter((r) => r.label.trim() && !choices.has(r.label.trim())).length);
  const stops = $derived(rows.filter((r) => choices.has(r.label.trim())).map((r) => {
    const id = choices.get(r.label.trim())!;
    return { title: store.concepts.get(id)!.title, href: `/${id}.md`, text: r.text };
  }));
  const ready = $derived(!!title.trim() && stops.length > 0 && !unknown);

  async function save(): Promise<string | null> {
    busy = true; status = "";
    try {
      const target = existing ? existing.name : slug(title).replace(/[^a-z0-9-]/g, "") || "tour";
      let free = target, n = 2;
      while (!existing && learner.tours.some((t) => t.name === free)) free = `${target}-${n++}`;
      await learner.saveTour(free, { title: title.trim(), description: description.trim(), body: tourBody(stops) });
      if (!existing) void learner.record({ event: "tour_written", tour: "~" + free, kind: "autodidactic" });
      status = "Saved privately.";
      if (!existing) await goto(`#/tours/${free}`, { replaceState: true });
      return free;
    } catch (err) {
      status = (err as Error).message;
      return null;
    } finally {
      busy = false;
    }
  }

  async function publish() {
    if (!confirm(`Publish "${title.trim()}" as a Tour note in tours/, for everyone who uses this project? Your private copy is then removed.`)) return;
    busy = true; status = "";
    try {
      let id = `tours/${slug(title)}`, n = 2;
      while (store.concepts.has(id)) id = `tours/${slug(title)}-${n++}`;
      await createNote(id, { type: "Tour", title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) }, tourBody(stops));
      if (existing) await learner.deleteTour(existing.name);
      await goto(conceptHref(id));
    } catch (err) {
      status = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function remove_() {
    if (!existing || !confirm(`Delete your tour "${existing.title}"?`)) return;
    await learner.deleteTour(existing.name);
    await goto("#/learn");
  }
</script>

<svelte:head><title>{existing ? existing.title : "New tour"} · {store.site.title}</title></svelte:head>

<div class="page tour-editor">
  <h1>{existing ? "Edit your tour" : "Write a tour"}</h1>
  <p class="lede">A walk through the notes in an order that makes sense to you, with a sentence at each stop. Writing one is a way to learn the territory; following it shows the route on the map. Your tours are private until you publish one.</p>
  {#if !learner.enabled}
    <p class="empty">Your tours are kept beside the learner record, which is off. Turn it on in the Learn tab to write one.</p>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); void save(); }}>
      <label>Title <input bind:value={title} required maxlength="120" placeholder="From charts to curvature" /></label>
      <label>Description <input bind:value={description} maxlength="300" placeholder="One sentence: where it goes and for whom" /></label>
      <datalist id="tour-notes">{#each [...choices.keys()] as label (label)}<option value={label}></option>{/each}</datalist>
      <ol class="tour-rows">
        {#each rows as row, i (row.key)}
          <li>
            <div class="tour-row-head">
              <input list="tour-notes" bind:value={row.label} placeholder="A note's title" aria-label="Stop {i + 1}: note"
                class:bad={row.label.trim() && !choices.has(row.label.trim())} />
              <button type="button" class="toggle" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move stop {i + 1} up">↑</button>
              <button type="button" class="toggle" onclick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move stop {i + 1} down">↓</button>
              <button type="button" class="toggle quiet" onclick={() => remove(i)} aria-label="Remove stop {i + 1}">Remove</button>
            </div>
            <textarea bind:value={row.text} rows="2" placeholder="Why this stop, and what to notice" aria-label="Stop {i + 1}: narration"></textarea>
          </li>
        {/each}
      </ol>
      <p><button type="button" class="toggle" onclick={add}>Add a stop</button></p>
      {#if unknown}<p class="edit-message bad">{unknown === 1 ? "One stop names" : `${unknown} stops name`} no note; choose from the suggestions.</p>{/if}
      <div class="tour-actions">
        <button type="submit" class="toggle primary" disabled={!ready || busy}>Save</button>
        {#if existing}
          <a class="toggle" href={tourHref("~" + existing.name)}>Follow</a>
          {#if editing.enabled}<button type="button" class="toggle" disabled={!ready || busy} onclick={publish}>Publish to the project</button>{/if}
          <button type="button" class="toggle quiet" onclick={remove_}>Delete</button>
        {/if}
        <span class="edit-status" role="status">{status}</span>
      </div>
    </form>
  {/if}
</div>
