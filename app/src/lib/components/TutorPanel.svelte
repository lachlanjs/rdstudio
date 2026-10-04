<script lang="ts">
  // Work together (T51): ask the teacher for a hint, feedback or a discussion
  // about the draft as it stands. Each reply is kept with the draft version it
  // answered; its pins mark the passages it is about (red, green, blue), in
  // the draft and in the list here. The teacher answers only when asked.
  import { onMount } from "svelte";
  import { render } from "$lib/markdown.ts";
  import { ai, money } from "$lib/teacher.svelte.ts";
  import { HINT_RUNGS, MODE_LABEL, askTutor, streamingText, type Mode, type Seen, type Turn } from "$lib/tutor.ts";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";

  let { exercise, dir, text, working = "", selection = "", turns = $bindable([]), onreveal, onshow, onrestore, unanchored }: {
    exercise: string; dir: string; text: string; working?: string; selection?: string; turns?: Turn[];
    onreveal: (pin: string) => boolean; onshow: (version: string) => void; onrestore: (version: string) => void;
    /** Pins whose passage is not in the draft any more. */
    unanchored: Set<string>;
  } = $props();

  let connected = $state<boolean | null>(null);
  onMount(() => { void ai.state().then((s) => { connected = !!s?.connected; }); });

  let asking = $state<Mode | null>(null); // a reply on its way
  let streaming = $state("");
  let error = $state("");
  let picking = $state(false); // feedback: how sure are you?
  let discussing = $state(false);
  let prompt = $state("");
  let seen = $state<{ turn: string; seen: Seen[] } | null>(null);
  let missing = $state<string | null>(null); // a pin whose passage has gone

  const hints = $derived(turns.filter((t) => t.mode === "hint").length);
  const nextRung = $derived(Math.min(HINT_RUNGS, hints + 1));
  const html = (md: string) => render(md, { dir });

  async function ask(mode: Mode, extra: { prompt?: string; selection?: string; confidence?: string } = {}) {
    asking = mode; streaming = ""; error = ""; picking = false; missing = null;
    try {
      const r = await askTutor(exercise, { mode, text, working, ...extra }, (s) => { streaming = s; });
      turns = [...turns, r.turn];
      seen = { turn: r.turn.id, seen: r.seen };
      if (mode === "discuss") { discussing = false; prompt = ""; }
    } catch (err) {
      error = (err as Error).message;
    }
    asking = null;
  }
  function reveal(turn: Turn, i: number) {
    missing = onreveal(`${turn.id}.${i}`) ? null : `${turn.id}.${i}`;
  }
</script>

<section class="tutor" aria-label="Work with the teacher">
  <div class="tutor-bar">
    <span class="tutor-label">Work with the teacher</span>
    <button class="toggle" type="button" disabled={!!asking || connected === false} onclick={() => ask("hint")}
      title="The smallest push towards the next step: a word, then a direction, then the step">Hint{hints ? ` (${nextRung} of ${HINT_RUNGS})` : ""}</button>
    <button class="toggle" type="button" disabled={!!asking || connected === false || !text.trim()} aria-expanded={picking}
      onclick={() => { picking = !picking; discussing = false; }} title="What is right and what is not, pinned to your draft">Feedback</button>
    <button class="toggle" type="button" disabled={!!asking || connected === false} aria-expanded={discussing}
      onclick={() => { discussing = !discussing; picking = false; }} title="Ask about your answer, or about a passage you highlight">Discuss</button>
  </div>
  {#if connected === false}
    <p class="section-note">To work with the teacher here, connect a model account on the <a href="#/teacher">Teacher page</a>.</p>
  {/if}

  {#if picking}
    <div class="tutor-ask" role="group" aria-label="How sure are you of your answer?">
      <span class="section-note">How sure are you of it?</span>
      {#each ["unsure", "fairly sure", "sure"] as c (c)}
        <button class="toggle" type="button" onclick={() => ask("feedback", { confidence: c })}>{c[0]!.toUpperCase() + c.slice(1)}</button>
      {/each}
      <button class="link" type="button" onclick={() => ask("feedback")}>Ask without saying</button>
    </div>
  {/if}
  {#if discussing}
    <form class="tutor-ask discuss" onsubmit={(e) => { e.preventDefault(); void ask("discuss", { prompt, selection }); }}>
      {#if selection.trim()}
        <p class="section-note">About the passage you highlighted: <q>{selection.length > 120 ? selection.slice(0, 117) + "…" : selection}</q></p>
      {:else}
        <p class="section-note">Highlight a passage of your answer to ask about it, or just ask.</p>
      {/if}
      <textarea bind:value={prompt} rows="2" aria-label="Your question" placeholder="Is this step right? Why does it…"></textarea>
      <div class="teacher-actions">
        <button class="toggle primary" type="submit" disabled={!!asking || (!prompt.trim() && !selection.trim())}>Ask</button>
        <button class="link" type="button" onclick={() => { discussing = false; }}>Cancel</button>
      </div>
    </form>
  {/if}

  {#if asking}
    <article class={["turn", "turn-" + asking, "streaming"]} aria-live="polite" aria-busy="true">
      <header>{MODE_LABEL[asking]}{asking === "hint" ? `, ${nextRung} of ${HINT_RUNGS}` : ""} · thinking…</header>
      {#if streaming}<p class="turn-streaming">{streamingText(streaming)}</p>{/if}
    </article>
  {/if}
  {#if error}<p class="edit-message bad" role="alert">{error}</p>{/if}

  {#each [...turns].reverse() as t (t.id)}
    <article class={["turn", "turn-" + t.mode]}>
      <header>
        <span class="turn-mode">{MODE_LABEL[t.mode]}{t.rung ? `, ${t.rung} of ${HINT_RUNGS}` : ""}</span>
        <Time iso={t.at} /> · on <button class="link" type="button" onclick={() => onshow(t.version)} title="Show your draft as it was when you asked">{t.version}</button>
        {#if t.confidence} · you were {t.confidence}{/if} · {money(t.cost)}
      </header>
      {#if t.prompt || t.selection}<p class="turn-asked">You asked{t.selection ? ` about “${t.selection.length > 80 ? t.selection.slice(0, 77) + "…" : t.selection}”` : ""}{t.prompt ? `: ${t.prompt}` : ""}</p>{/if}
      {#if t.general}<Prose html={html(t.general)} />{/if}
      {#if t.pins.length}
        <ul class="turn-pins">
          {#each t.pins as p, i (i)}
            <li class={"pin pin-" + p.colour}>
              <button class="pin-quote" type="button" onclick={() => reveal(t, i)} title="Show it in your answer">“{p.quote}”</button>
              {#if unanchored.has(`${t.id}.${i}`) || missing === `${t.id}.${i}`}<span class="pin-gone">no longer in your answer: <button class="link" type="button" onclick={() => onshow(t.version)}>see {t.version}</button></span>{/if}
              {#if p.comment}<Prose html={html(p.comment)} />{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <footer>
        <button class="link" type="button" onclick={() => onshow(t.version)}>Show the draft as it was</button>
        <button class="link" type="button" onclick={() => onrestore(t.version)}>Restore it</button>
        {#if seen?.turn === t.id}
          <details class="turn-seen"><summary>What the teacher saw</summary>
            <ul>{#each seen.seen as s (s.name)}<li><details><summary>{s.name} · about {s.tokens} tokens{s.shortened ? " (shortened)" : ""}</summary><pre>{s.text}</pre></details></li>{/each}</ul>
          </details>
        {/if}
      </footer>
    </article>
  {/each}
</section>
