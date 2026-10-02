<script lang="ts">
  // One event from your learner record, as cited by the teacher's profile
  // ([e:<id>]): what it was, when, the answer and its marking.
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { evidence } from "$lib/teacher.svelte.ts";
  import { learner, store } from "$lib/data.svelte.ts";
  import { RESULT_LABEL } from "$lib/explain.ts";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";

  let { id }: { id: string } = $props();
  const ev = $derived(evidence(id));
  // The answer and the marking, whichever of the two was cited.
  const answer = $derived(ev ? (ev.event.event === "attempt" || ev.event.event === "explain" ? ev.event : ev.related) : null);
  const marking = $derived(ev ? (ev.event.event === "attempt_marked" || ev.event.event === "explain_marked" ? ev.event : ev.related) : null);
  const text = (v: unknown) => (typeof v === "string" ? v : "");
</script>

{#if !learner.enabled}
  <p class="section-note">The learner record is off.</p>
{:else if !ev}
  <p class="empty">There is no event {id} in your learner record. It may be from another device's record not merged here.</p>
{:else}
  <h1>{ev.label}</h1>
  <p class="section-note"><Time iso={text(ev.event.at)} rel={false} />{#if ev.about && store.concepts.has(ev.about)} · <a href={conceptHref(ev.about)}>{store.concepts.get(ev.about)?.title}</a>{/if}</p>
  {#if answer}
    {#if text(answer.question)}<p class="explain-asked">{text(answer.question)}</p>{/if}
    <h2 class="section-h">Your answer</h2>
    {#if answer.gave_up}<p class="section-note">You gave up and looked at the solution.</p>{:else}<blockquote class="evidence-answer"><Prose html={render(text(answer.answer) || "*(empty)*")} /></blockquote>{/if}
    {#if answer.result}<p>{RESULT_LABEL[text(answer.result)] ?? text(answer.result)}, {answer.by === "self" ? "marked by you" : "checked in the dashboard"}.</p>{/if}
  {/if}
  {#if marking}
    <h2 class="section-h">Marking</h2>
    <p><strong>{RESULT_LABEL[text(marking.result)] ?? text(marking.result)}</strong>, {marking.by === "self" ? "by you" : `by ${text(marking.by) || "an agent"}`}, <Time iso={text(marking.at)} />.</p>
    {#if text(marking.feedback)}<p class="explain-feedback">{text(marking.feedback)}</p>{/if}
    {#if Array.isArray(marking.gaps) && marking.gaps.length}<ul class="explain-gaps">{#each marking.gaps as g, i (i)}<li>{String(g)}</li>{/each}</ul>{/if}
  {/if}
{/if}
