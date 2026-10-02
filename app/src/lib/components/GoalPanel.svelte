<script lang="ts">
  // Under a Goal note (T44): how far you are towards it. The notes it needs
  // (what it requires, and what those require) by state, in reading order, and
  // its exercises; met when every exercise is passed.
  import type { ConceptRecord } from "@rdstudio/core";
  import { store } from "$lib/data.svelte.ts";
  import { STATUS_LABEL, exercisesFor, progressOf, statusOf } from "$lib/exercises.ts";
  import { conceptHref } from "$lib/format.ts";
  import { STATE_LABEL, understanding } from "$lib/understanding.svelte.ts";

  let { c }: { c: ConceptRecord } = $props();

  const p = $derived(progressOf(c));
  const exercises = $derived(exercisesFor(c.id));
  const notes = $derived(p.notes.map((id) => store.concepts.get(id)!).filter(Boolean).sort((a, b) => a.order - b.order));
  const passed = $derived(p.exercises.filter((e) => e.status === "passed").length);
  const pct = (n: number) => (p.coverage.total ? (100 * n) / p.coverage.total : 0);
</script>

<section class="goal-panel" aria-label="Progress towards this goal">
  <h2 class="section-h">{p.met ? "Met" : "Towards this goal"}</h2>
  {#if understanding.on}
    <p class="section-note">
      {#if exercises.length}{passed} of {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"} passed{p.met ? ": every one, so the goal is met" : ""}.{:else}No exercises name this goal yet, so it cannot be met: an agent can write some (the teach skill), or you can, as Exercise notes with this goal in their <code>goals</code>.{/if}
      {#if notes.length} It needs {notes.length} {notes.length === 1 ? "note" : "notes"}; {p.coverage.understood} understood.{/if}
    </p>
    {#if notes.length}
      <div class="cov-bar goal-bar" role="img" aria-label={`${p.coverage.understood} understood, ${p.coverage.processed} worked through, ${p.coverage.discovered} opened, ${p.coverage.undiscovered} not opened`}>
        <span class="cov-understood" style:width="{pct(p.coverage.understood)}%"></span><span class="cov-processed" style:width="{pct(p.coverage.processed)}%"></span><span class="cov-discovered" style:width="{pct(p.coverage.discovered)}%"></span>
      </div>
    {/if}
  {:else if !store.site.static}
    <p class="section-note">Turn the learner record on (in the Learn tab) to see how far you are towards this goal.</p>
  {/if}

  {#if exercises.length}
    <h3>Exercises</h3>
    <ul class="rows goal-exercises">
      {#each exercises as e (e.id)}
        {@const st = statusOf(e.id)}
        <li><a class="title" href={conceptHref(e.id)}>{e.title}</a>{#if understanding.on}<span class={["chip", "ex-" + st]}>{STATUS_LABEL[st]}</span>{/if}
          {#if e.description}<div class="desc">{e.description}</div>{/if}</li>
      {/each}
    </ul>
  {/if}
  {#if notes.length}
    <h3>What it needs, in reading order</h3>
    <ol class="goal-notes">
      {#each notes as n (n.id)}
        {@const st = understanding.state(n.id)}
        <li class={understanding.cls(n.id)}><a href={conceptHref(n.id)}>{n.title}</a>{#if st}<span class="goal-state">{STATE_LABEL[st.state]}{st.changed ? ", changed since" : ""}</span>{/if}</li>
      {/each}
    </ol>
  {:else}
    <p class="section-note">It requires no notes yet. Link the notes it needs with the title "requires", as in [Cavity method](/dmft/cavity.md "requires").</p>
  {/if}
</section>
