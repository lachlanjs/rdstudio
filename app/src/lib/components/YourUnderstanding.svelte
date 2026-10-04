<script lang="ts">
  // Where this note stands for you, in three steps (T56, sketch MarginaliaNote):
  // opened, worked through, understood. Choosing a step is your own marking
  // (autodidactic); exercises and explain-back add evidence. Shown only with
  // the learner record on.
  import type { ConceptRecord } from "@rdstudio/core";
  import type { Discovery } from "@rdstudio/core/learning";
  import { understanding } from "$lib/understanding.svelte.ts";

  let { c }: { c: ConceptRecord } = $props();

  const s = $derived(understanding.state(c.id));
  const KIND: Record<string, string> = { autodidactic: "your marking", interactive: "an exercise", ai: "explain-back" };
  const review = $derived(understanding.schedule.get(c.id));
  const when = (ms: number) => {
    const days = Math.round((ms - Date.now()) / 86_400_000);
    return days <= 0 ? "due now" : days === 1 ? "due tomorrow" : `due in ${days} days`;
  };
  const STEPS: [Discovery, string][] = [["discovered", "Opened"], ["processed", "Worked through"], ["understood", "Understood"]];
  const rank = (d: Discovery | undefined) => (d === "understood" ? 3 : d === "processed" ? 2 : d === "discovered" ? 1 : 0);
  const reached = $derived(rank(s?.state));
</script>

<div class="blk you-blk">
  <div class="kind-row"><span class="kind">Your understanding</span><span class="caption">{reached} of 3</span></div>
  <div class="steps" role="group" aria-label="Mark how far you are with this note">
    {#each STEPS as [state, label], i (state)}
      <button type="button" class={["step", i < reached && "on"]} aria-pressed={i + 1 === reached} onclick={() => understanding.mark(c.id, state)}
        title={i + 1 === reached ? "Where you are" : `Mark it ${label.toLowerCase()}`}><i class={["box", i < reached && "on"]} aria-hidden="true"></i>{label}</button>
    {/each}
  </div>
  {#if s?.changed}<p class="caption you-note">The note has changed meaningfully since you {s.state === "understood" ? "understood" : "worked through"} it: worth another look.</p>
  {:else if s?.kind && s.state === "understood"}<p class="caption you-note">Understood, from {KIND[s.kind] ?? s.kind}.</p>{/if}
  {#if review}<p class="caption you-note">In review: {when(review.due)}. <a href="#/practice/recall">Practise recall</a></p>{/if}
</div>
