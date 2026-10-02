<script lang="ts">
  // Where this note stands for you, and marking it: worked through, understood,
  // or not yet (back to opened). Marking is your own judgement (autodidactic);
  // exercises and explain-back add evidence. Shown only with the learner record on.
  import type { ConceptRecord } from "@rdstudio/core";
  import type { Discovery } from "@rdstudio/core/learning";
  import { STATE_LABEL, understanding } from "$lib/understanding.svelte.ts";

  let { c }: { c: ConceptRecord } = $props();

  const s = $derived(understanding.state(c.id));
  const KIND: Record<string, string> = { autodidactic: "your marking", interactive: "an exercise", ai: "explain-back" };
  const review = $derived(understanding.schedule.get(c.id));
  const when = (ms: number) => {
    const days = Math.round((ms - Date.now()) / 86_400_000);
    return days <= 0 ? "due now" : days === 1 ? "due tomorrow" : `due in ${days} days`;
  };
  const marks: [Discovery, string][] = [["processed", "Worked through"], ["understood", "Understood"]];
</script>

<h2>Your understanding</h2>
<p class={["you-state", s && `st-${s.state}`, s?.changed && "changed"]}>
  {s ? STATE_LABEL[s.state] : STATE_LABEL.undiscovered}{#if s?.kind && s.state === "understood"}<span class="you-why">, from {KIND[s.kind] ?? s.kind}</span>{/if}
</p>
{#if s?.changed}<p class="section-note">The note has changed meaningfully since; worth another look.</p>{/if}
<div class="you-marks" role="group" aria-label="Mark this note">
  {#each marks as [state, label] (state)}
    <button type="button" class="toggle" aria-pressed={s?.state === state && !s.changed} onclick={() => understanding.mark(c.id, state)}>{label}</button>
  {/each}
  {#if s && (s.state === "processed" || s.state === "understood")}
    <button type="button" class="toggle quiet" onclick={() => understanding.mark(c.id, "discovered")}>Not yet</button>
  {/if}
</div>
{#if review}<p class="section-note">In review: {when(review.due)}. <a href="#/practice/recall">Practise recall</a></p>{/if}
