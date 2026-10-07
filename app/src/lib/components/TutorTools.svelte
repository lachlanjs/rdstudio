<script lang="ts">
  // Above the answer (T55): ask the teacher for a hint, feedback (saying how
  // sure you are) or a discussion of what you ask or highlight.
  import { onMount } from "svelte";
  import { ai } from "$lib/teacher.svelte.ts";
  import { HINT_RUNGS, type Mode } from "$lib/tutor.ts";
  import type { TutorSession } from "$lib/tutorSession.svelte.ts";

  let { session, text, working = "", selection = "" }: { session: TutorSession; text: string; working?: string; selection?: string } = $props();

  let connected = $state<boolean | null>(null);
  onMount(() => { void ai.state().then((s) => { connected = !!s?.connected; }); });
  let picking = $state(false);
  let discussing = $state(false);
  let prompt = $state("");
  const nextRung = $derived(Math.min(HINT_RUNGS, session.hints + 1));
  const off = $derived(!!session.asking || connected === false);

  async function ask(mode: Mode, extra: { prompt?: string; selection?: string; confidence?: string } = {}) {
    picking = false;
    const ok = await session.ask({ mode, text, working, ...extra });
    if (ok && mode === "discuss") { discussing = false; prompt = ""; }
  }
</script>

<div class="a-tools" role="toolbar" aria-label="Ask Axis">
  <button class="toggle" type="button" data-key="h" data-key-label="hint" disabled={off} onclick={() => ask("hint")}
    title="The smallest push towards the next step: a word, then a direction, then the step">Hint{session.hints ? ` (${nextRung} of ${HINT_RUNGS})` : ""}</button>
  <button class="toggle" type="button" data-key="f" disabled={off || !text.trim()} aria-pressed={picking}
    onclick={() => { picking = !picking; discussing = false; }} title="What is right and what is not, pinned to your answer">Feedback</button>
  <button class="toggle" type="button" data-key="d" disabled={off} aria-pressed={discussing}
    onclick={() => { discussing = !discussing; picking = false; }} title="Ask about your answer, or about a passage you highlight">Discuss</button>
</div>
{#if connected === false}
  <p class="caption tools-note">To work with Axis here, connect a model account on the <a href="#/teacher">Axis page</a>.</p>
{/if}
{#if picking}
  <div class="tutor-ask" role="group" aria-label="How sure are you of your answer?">
    <span class="caption">How sure are you of it?</span>
    {#each ["unsure", "fairly sure", "sure"] as c (c)}
      <button class="toggle" type="button" onclick={() => ask("feedback", { confidence: c })}>{c[0]!.toUpperCase() + c.slice(1)}</button>
    {/each}
    <button class="link" type="button" onclick={() => ask("feedback")}>Ask without saying</button>
  </div>
{/if}
{#if discussing}
  <form class="tutor-ask discuss" onsubmit={(e) => { e.preventDefault(); void ask("discuss", { prompt, selection }); }}>
    {#if selection.trim()}
      <p class="caption">About the passage you highlighted: <q>{selection.length > 120 ? selection.slice(0, 117) + "…" : selection}</q></p>
    {:else}
      <p class="caption">Highlight a passage of your answer to ask about it, or just ask.</p>
    {/if}
    <textarea bind:value={prompt} rows="2" aria-label="Your question" placeholder="Is this step right? Why does it…"></textarea>
    <div class="teacher-actions">
      <button class="toggle primary" type="submit" disabled={off || (!prompt.trim() && !selection.trim())}>Ask</button>
      <button class="link" type="button" onclick={() => { discussing = false; }}>Cancel</button>
    </div>
  </form>
{/if}
{#if session.error}<p class="edit-message bad" role="alert">{session.error}</p>{/if}
