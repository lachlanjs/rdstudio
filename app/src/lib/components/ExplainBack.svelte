<script lang="ts">
  // Under a note: explain it in your own words, to be marked by an agent later
  // (the explain-back skill); and what you wrote before, with its marking.
  import { untrack } from "svelte";
  import type { ConceptRecord } from "@rdstudio/core";
  import { RESULT_LABEL, answers, openQuestions, submit } from "$lib/explain.ts";

  let { c }: { c: ConceptRecord } = $props();

  const mine = $derived(answers(c.id));
  const questions = $derived(openQuestions(c.id));
  const question = $derived(questions[0]?.question ?? null);
  let text = $state("");
  let status = $state("");
  let busy = $state(false);
  // Open when a question waits, and then however you leave it (new events,
  // such as this note being recorded as opened, must not close it).
  let open = $state(untrack(() => openQuestions(c.id).length > 0));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    busy = true;
    const ok = await submit(c.id, text, question);
    busy = false;
    status = ok ? "Saved. An agent marks it next time you use the explain-back skill." : "Not saved: the learner record did not accept it.";
    if (ok) text = "";
  }
</script>

<details class="explain-back" bind:open>
  <summary>Explain it back{#if questions.length}<span class="count">{questions.length}</span>{/if}</summary>
  <form onsubmit={save}>
    <p class="explain-q">{question ?? `In your own words: what is ${c.title}, and why does it matter here?`}</p>
    <textarea bind:value={text} rows="5" aria-label="Your explanation" placeholder="Write it without looking back at the note."></textarea>
    <div class="explain-actions">
      <button class="toggle primary" type="submit" disabled={busy || !text.trim()}>Save for marking</button>
      <span class="edit-status" role="status">{status}</span>
    </div>
  </form>
  {#if mine.length}
    <h3>Your explanations</h3>
    <ul class="explain-list">
      {#each mine as a (a.id)}
        <li class={a.marked?.result ?? "waiting"}>
          <p class="explain-meta">{new Date(a.at).toLocaleDateString()} · {a.marked ? RESULT_LABEL[a.marked.result] ?? a.marked.result : "waiting for marking"}</p>
          {#if a.question}<p class="explain-asked">{a.question}</p>{/if}
          <blockquote>{a.answer}</blockquote>
          {#if a.marked}
            <p class="explain-feedback">{a.marked.feedback}</p>
            {#if a.marked.gaps.length}<ul class="explain-gaps">{#each a.marked.gaps as g, i (i)}<li>{g}</li>{/each}</ul>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</details>
