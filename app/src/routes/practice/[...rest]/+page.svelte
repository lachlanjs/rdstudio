<script lang="ts">
  // Practice: short rounds of interactive exercises, checked here, offline.
  // #/practice lists them; #/practice/<exercise>[/<folder>] runs a round of
  // up to ten. No scores or streaks: a round ends with what you got, partly
  // got and missed, and links to those notes.
  import { untrack } from "svelte";
  import { page } from "$app/state";
  import type { ConceptRecord } from "@rdstudio/core";
  import { dueReviews, reviewSchedule } from "@rdstudio/core/learning";
  import { learner, store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import {
    EXERCISES, answered, folderLabel, gapItem, landmarks, matchName, notesIn, placementItem, recallItem,
    type Exercise, type GapItem, type PlaceItem, type Result,
  } from "$lib/practice.ts";

  const ROUND = 10;
  const rest = $derived((page.params.rest ?? "").split("/").filter(Boolean));
  const kind = $derived((EXERCISES.some((e) => e.kind === rest[0]) ? rest[0] : null) as Exercise | null);
  const folder = $derived(kind ? rest.slice(1).join("/") : "");
  const pool = $derived(notesIn(folder));
  const info = $derived(EXERCISES.find((e) => e.kind === kind));
  const topFolders = $derived(Object.keys(store.tree).filter((d) => d && !d.includes("/")).sort());
  let scope = $state("");

  // ---------------------------------------------------------------- a round
  type Item =
    | { kind: "recall"; note: ConceptRecord; shown: boolean; result: Result | null }
    | { kind: "gap"; gap: GapItem; chosen: string | null }
    | { kind: "placement"; place: PlaceItem; chosen: string | null };
  let item = $state<Item | null>(null);
  let done = $state<{ id: string; result: Result }[]>([]);
  let used = new Set<string>();
  let over = $state(false);

  const due = () => dueReviews(reviewSchedule(learner.events, store.concepts.values()), Date.now()).due.map((r) => r.id);

  function nextItem() {
    if (!kind || kind === "landmarks") return;
    if (done.length >= ROUND) { over = true; item = null; return; }
    let next: Item | null = null;
    if (kind === "recall") {
      const note = recallItem(pool, used, due());
      if (note) next = { kind, note, shown: false, result: null };
    } else if (kind === "gap") {
      const gap = gapItem(pool, used);
      if (gap) next = { kind, gap, chosen: null };
    } else {
      const place = placementItem(pool, used);
      if (place) next = { kind, place, chosen: null };
    }
    if (!next) { over = true; item = null; return; }
    used.add(next.kind === "recall" ? next.note.id : next.kind === "gap" ? next.gap.answer.id : next.place.note.id);
    item = next;
  }

  function start() {
    done = []; used = new Set(); over = false; item = null;
    named = []; typed = ""; revealed = false;
    nextItem();
  }
  // A new round whenever the exercise or folder changes.
  $effect(() => { void kind; void folder; untrack(start); });

  function grade(id: string, result: Result) {
    if (!kind) return;
    answered(kind, id, result);
    done = [...done, { id, result }];
  }
  function recallGrade(result: Result) {
    if (item?.kind !== "recall") return;
    item.result = result;
    grade(item.note.id, result);
    nextItem();
  }
  function choose(id: string) {
    if (item?.kind === "gap" && !item.chosen) {
      item.chosen = id;
      grade(item.gap.answer.id, id === item.gap.answer.id ? "got" : "missed");
    } else if (item?.kind === "placement" && !item.chosen) {
      item.chosen = id;
      grade(item.place.note.id, id === item.place.note.directory ? "got" : "missed");
    }
  }

  // ---------------------------------------------------------------- landmarks
  const marks = $derived(landmarks(pool));
  let named = $state<string[]>([]);
  let typed = $state("");
  let feedback = $state("");
  let revealed = $state(false);
  function name(e: SubmitEvent) {
    e.preventDefault();
    const hit = matchName(typed, marks.notes);
    if (!hit) feedback = `"${typed}" is not one of them.`;
    else if (named.includes(hit.id)) feedback = `${hit.title}: already named.`;
    else { named = [...named, hit.id]; feedback = `${hit.title}.`; }
    typed = "";
  }
  function reveal() {
    revealed = true;
    for (const c of marks.notes) grade(c.id, named.includes(c.id) ? "got" : "missed");
  }

  const count = (r: Result) => done.filter((d) => d.result === r).length;
  const title = (id: string) => store.concepts.get(id)?.title ?? id;
</script>

<svelte:head><title>{info ? info.name : "Practice"} · {store.site.title}</title></svelte:head>

<div class="page practice">
  {#if !kind}
    <h1>Practice</h1>
    <p class="lede">Short rounds of exercises, checked here and kept to yourself. Recall and fill the gap count as evidence of understanding; placement and landmarks are practice.</p>
    {#if !learner.enabled && !store.site.static}<p class="section-note">The learner record is off, so answers are not kept. Turn it on in the Learn tab.</p>{/if}
    <label class="practice-scope">Notes from
      <select bind:value={scope}>
        <option value="">everywhere</option>
        {#each topFolders as f (f)}<option value={f}>{folderLabel(f)}</option>{/each}
      </select>
    </label>
    <ul class="practice-list">
      {#each EXERCISES as e (e.kind)}
        <li><a class="title" href={`#/practice/${e.kind}${scope ? "/" + scope : ""}`}>{e.name}</a><p>{e.what}</p></li>
      {/each}
    </ul>
  {:else}
    <p class="doc-kind"><a href="#/practice">Practice</a> · {folder ? folderLabel(folder) : "everywhere"}</p>
    <h1>{info?.name}</h1>

    {#if kind === "landmarks"}
      <p class="lede">{marks.declared ? "The notes marked as landmarks" : "No notes are marked as landmarks here, so these are the most linked-to notes"}: there {marks.notes.length === 1 ? "is one" : `are ${marks.notes.length}`}. Name as many as you can.</p>
      {#if !marks.notes.length}
        <p class="empty">Nothing here is linked to yet.</p>
      {:else if !revealed}
        <form class="practice-name" onsubmit={name}>
          <input bind:value={typed} aria-label="A landmark's name" placeholder="A note's title" autocomplete="off" />
          <button class="toggle primary" type="submit" disabled={!typed.trim()}>Name it</button>
        </form>
        <p class="edit-status" role="status">{feedback}</p>
        <p>{named.length} of {marks.notes.length} named.</p>
        {#if named.length}<ul class="practice-named">{#each named as id (id)}<li>{title(id)}</li>{/each}</ul>{/if}
        <p><button class="toggle" type="button" onclick={reveal}>Show the rest</button></p>
      {:else}
        <p>You named {named.length} of {marks.notes.length}.</p>
        <ul class="practice-results">
          {#each marks.notes as c (c.id)}
            <li class={named.includes(c.id) ? "got" : "missed"}><a href={conceptHref(c.id)}>{c.title}</a>
              <span>{named.includes(c.id) ? "named" : "not named"} · {folderLabel(c.directory)}</span></li>
          {/each}
        </ul>
        <p><button class="toggle" type="button" onclick={start}>Again</button></p>
      {/if}

    {:else if item && item.kind === kind}
      <p class="practice-progress">{item.kind !== "recall" && item.chosen ? done.length : done.length + 1} of up to {ROUND}</p>
      <section class="practice-card" aria-live="polite">
        {#if item.kind === "recall"}
          <p class="practice-where">{folderLabel(item.note.directory)}</p>
          <h2>{item.note.title}</h2>
          {#if !item.shown}
            <p class="section-note">Recall what this note says: what it is, why it matters, what it builds on.</p>
            <button class="toggle primary" type="button" onclick={() => { if (item?.kind === "recall") item.shown = true; }}>Show the note</button>
          {:else}
            {#if item.note.description}<p class="practice-answer">{item.note.description}</p>{/if}
            {#if item.note.headings.length}<p class="section-note">Sections: {item.note.headings.map((h) => h.text).join(" · ")}</p>{/if}
            <p><a href={conceptHref(item.note.id)} target="_blank" rel="noopener">Open the whole note</a></p>
            <div class="practice-grades" role="group" aria-label="How much did you recall?">
              <button class="toggle" type="button" onclick={() => recallGrade("missed")}>Missed it</button>
              <button class="toggle" type="button" onclick={() => recallGrade("partly")}>Partly</button>
              <button class="toggle primary" type="button" onclick={() => recallGrade("got")}>Got it</button>
            </div>
          {/if}

        {:else if item.kind === "gap"}
          <p class="section-note">A note in <strong>{folderLabel(item.gap.folder)}</strong> is hidden.</p>
          {#if item.gap.to.length}<p class="practice-clue">It links to: {item.gap.to.join(" · ")}</p>{/if}
          {#if item.gap.from.length}<p class="practice-clue">It is linked from: {item.gap.from.join(" · ")}</p>{/if}
          <div class="practice-options" role="group" aria-label="Which note is it?">
            {#each item.gap.options as o (o.id)}
              <button type="button" class={["toggle", item.chosen && o.id === item.gap.answer.id && "right", item.chosen === o.id && o.id !== item.gap.answer.id && "wrong"]}
                disabled={!!item.chosen} onclick={() => choose(o.id)}>{o.title}</button>
            {/each}
          </div>

        {:else if item.kind === "placement"}
          <h2>{item.place.note.title}</h2>
          {#if item.place.note.description}<p class="practice-answer">{item.place.note.description}</p>{/if}
          <div class="practice-options" role="group" aria-label="Which folder does it belong in?">
            {#each item.place.options as f (f)}
              <button type="button" class={["toggle", item.chosen && f === item.place.note.directory && "right", item.chosen === f && f !== item.place.note.directory && "wrong"]}
                disabled={!!item.chosen} onclick={() => choose(f)}>{folderLabel(f)}</button>
            {/each}
          </div>
        {/if}

        {#if (item.kind === "gap" || item.kind === "placement") && item.chosen}
          {@const right = item.kind === "gap" ? item.chosen === item.gap.answer.id : item.chosen === item.place.note.directory}
          {@const note = item.kind === "gap" ? item.gap.answer : item.place.note}
          <p class="practice-verdict" role="status">{right ? "Right" : "Not quite"}: <a href={conceptHref(note.id)}>{note.title}</a>{item.kind === "placement" ? ` is in ${folderLabel(note.directory)}` : ""}.</p>
          <button class="toggle primary" type="button" onclick={nextItem}>Next</button>
        {/if}
      </section>

    {:else if over || done.length}
      <p class="lede">{done.length ? `Round over: ${count("got")} got, ${count("partly")} partly, ${count("missed")} missed.` : "Nothing here to practise on yet."}</p>
      {#if done.length}
        <ul class="practice-results">
          {#each done as d (d.id)}<li class={d.result}><a href={conceptHref(d.id)}>{title(d.id)}</a> <span>{d.result === "got" ? "got it" : d.result}</span></li>{/each}
        </ul>
      {/if}
      <p><button class="toggle" type="button" onclick={start}>Another round</button> <a class="toggle" href="#/practice">Other exercises</a></p>
    {/if}
  {/if}
</div>
