<script lang="ts">
  // An Exercise note (T44): the problem, a way to answer it, the solution kept
  // back until you have answered (or given up), and your attempts. A choice or
  // a value is checked here, and can carry your working: sent for review (by
  // an agent, or by you against the solution) when you ask, or offered for
  // review after a wrong answer, for a slip to count as partly right or to
  // find where it went wrong. A text answer is marked by you against the
  // solution, or saved for an agent to mark.
  import type { ConceptRecord } from "@rdstudio/core";
  import { checkAnswer, splitSolution, type Attempt, type Result } from "@rdstudio/core/learning";
  import { learner, store } from "$lib/data.svelte.ts";
  import { BY_LABEL, STATUS_LABEL, goalsOf, markYourself, requestReview, sets, spec, statusOf, submitAttempt, testsOf, tried } from "$lib/exercises.ts";
  import { needsMarking } from "@rdstudio/core/learning";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";
  import AnswerEditor from "./AnswerEditor.svelte";
  import { onMount, untrack } from "svelte";
  import TutorPanel from "./TutorPanel.svelte";
  import type { Turn } from "$lib/tutor.ts";
  import { locate, type PinMark } from "$lib/editor/pins.ts";
  import type { DraftVersion } from "$lib/api/types.gen.ts";
  import { drafts } from "$lib/teacher.svelte.ts";

  let { c, body }: { c: ConceptRecord; body: string } = $props();

  const parts = $derived(splitSolution(body));
  const parsed = $derived(spec(c));
  const s = $derived("error" in parsed ? ({ kind: "text" } as const) : parsed);
  const mine = $derived([...(tried().get(c.id) ?? [])].reverse());
  const status = $derived(statusOf(c.id));
  const tests = $derived(testsOf(c));
  const goals = $derived(goalsOf(c));
  const recording = $derived(learner.enabled && !store.site.static);
  // The newest set this exercise was set in, and what is left in it.
  const set = $derived(sets().find((a) => a.exercises.includes(c.id)) ?? null);
  const nextInSet = $derived(set ? set.exercises.find((x) => x !== c.id && !set.done.includes(x)) ?? null : null);
  const html = (md: string) => render(md, { dir: c.directory });

  // ---------------------------------------------------------------- answering
  let picked = $state<number[]>([]);
  let typed = $state("");
  let text = $state("");
  /** Where this go has got to: answering, then a verdict (checked here or by
   *  you), saved for an agent, or given up. */
  let stage = $state<"answer" | "grade" | "done" | "queued">("answer");
  let verdict = $state<Result | null>(null);
  let gaveUp = $state(false);
  let message = $state("");
  let busy = $state(false);
  /** The solution is shown once you have answered or given up (or asked to see it after saving for an agent). */
  let reveal = $state(false);
  /** A waiting attempt you chose to mark yourself. */
  let marking = $state<Attempt | null>(null);
  // Working behind a choice or a value, and whether to have it reviewed.
  let working = $state("");
  let showWorking = $state(false);
  let review = $state(false);
  /** The attempt just made, and whether its working has gone for review. */
  let lastId = $state<string | null>(null);
  let sentForReview = $state(false);

  // ---------------------------------------------------------------- the draft
  // Kept as you type (privately, beside your record), back when you return,
  // with versions kept at the moments that matter, any of which can be shown
  // beside the draft or restored.
  let versions = $state<DraftVersion[]>([]);
  // Working together: the teacher's replies, the editor (to reveal a pin) and what is selected in it.
  let turns = $state<Turn[]>([]);
  let editor = $state<{ reveal: (id: string) => boolean } | null>(null);
  let selection = $state("");
  let pinEpoch = $state(0); // place the pins again (after a restore)
  const placed = $derived.by(() => {
    void pinEpoch;
    const now = untrack(() => text);
    const marks: PinMark[] = [];
    const gone = new Set<string>();
    for (const t of turns) t.pins.forEach((p, i) => {
      const at = locate(now, p.quote);
      if (at) marks.push({ id: `${t.id}.${i}`, from: at.from, to: at.to, colour: p.colour });
      else gone.add(`${t.id}.${i}`);
    });
    return { marks, gone };
  });
  // A reply keeps a version on the server: fetch the list again.
  $effect(() => {
    if (!turns.length) return;
    void turns.length;
    untrack(() => { void drafts.read(c.id).then((d) => { if (d) versions = d.versions; }); });
  });
  const helpCounts = () => turns.length ? { hint: turns.filter((t) => t.mode === "hint").length, feedback: turns.filter((t) => t.mode === "feedback").length, discuss: turns.filter((t) => t.mode === "discuss").length } : null;
  let showing = $state<DraftVersion | null>(null);
  let loaded = $state(false);
  let savedAt = $state<string | null>(null);
  onMount(() => {
    void drafts.read(c.id).then((d) => {
      if (d && (d.text || d.working)) {
        if (s.kind === "text") text = d.text;
        working = d.working;
        if (d.working) showWorking = true;
        message = `Your draft from ${new Date(d.updated ?? Date.now()).toLocaleString()} is back.`;
      }
      versions = d?.versions ?? [];
      turns = (d?.turns ?? []) as unknown as Turn[];
      loaded = true;
    });
  });
  $effect(() => {
    const t = text, w = working;
    if (!loaded || !recording || stage !== "answer") return;
    const timer = setTimeout(() => { void drafts.save(c.id, s.kind === "text" ? t : "", w).then((d) => { if (d) savedAt = d.updated; }); }, 700);
    return () => clearTimeout(timer);
  });
  async function keep() {
    await drafts.save(c.id, s.kind === "text" ? text : "", working);
    const d = await drafts.keep(c.id);
    if (d) { versions = d.versions; message = `Kept as ${d.versions.at(-1)?.id}.`; }
  }
  async function restore(v: DraftVersion) {
    await drafts.save(c.id, s.kind === "text" ? text : "", working);
    const d = await drafts.restore(c.id, v.id);
    if (!d) return;
    if (s.kind === "text") text = d.text;
    working = d.working;
    if (d.working) showWorking = true;
    versions = d.versions;
    showing = null;
    pinEpoch++;
    message = `Restored ${v.id}. What you had is kept as ${d.versions.at(-1)?.id}.`;
  }
  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  function again() {
    picked = []; typed = ""; text = ""; stage = "answer"; verdict = null; gaveUp = false; message = ""; reveal = false; marking = null;
    working = ""; showWorking = false; review = false; lastId = null; sentForReview = false;
  }

  const answerText = (): string =>
    s.kind === "choice" ? picked.map((i) => s.choices[i]).join("; ") : s.kind === "value" ? typed.trim() : text.trim();

  async function record(result: Result | null, by: "dashboard" | "self" | null, gaveUp = false) {
    busy = true;
    const withWorking = s.kind !== "text" && !gaveUp && !!working.trim();
    lastId = await submitAttempt(c, gaveUp ? "" : answerText(), result && by ? { result, by, gaveUp } : null,
      withWorking ? { working, review } : undefined, helpCounts());
    sentForReview = withWorking && review;
    busy = false;
    if (lastId) { void drafts.submitted(c.id, lastId); versions = []; showing = null; turns = []; }
    if (!lastId && recording) message = "Not saved: the learner record did not accept it.";
    return !!lastId;
  }

  async function sendWorking() {
    if (!lastId || !working.trim()) return;
    busy = true;
    const ok = await requestReview(lastId, working);
    busy = false;
    if (ok) sentForReview = true;
    message = ok ? "Sent for review. An agent reads it next time you ask to be taught or tested, or you can mark it yourself below." : "Not sent: the learner record did not accept it.";
  }

  async function check() {
    const r = checkAnswer(s, s.kind === "choice" ? picked : typed);
    if (r === null) { message = "That is not a number this can read. Try 0.25, 1/4 or 2.5e-3."; return; }
    message = "";
    verdict = r;
    reveal = true;
    stage = "done";
    await record(r, "dashboard");
  }

  /** Text: see the solution, then say how you did. */
  function markMine() { reveal = true; stage = "grade"; }
  async function grade(r: Result) {
    if (marking) {
      busy = true;
      const ok = await markYourself(marking.id, r);
      busy = false;
      message = ok ? "Marked." : "Not saved: the learner record did not accept it.";
      marking = null; reveal = false;
      return;
    }
    verdict = r;
    stage = "done";
    await record(r, "self");
  }
  async function askAgent() {
    if (await record(null, null)) {
      stage = "queued";
      message = "Saved for marking. An agent marks it next time you ask to be taught or tested (the teach skill).";
    }
  }
  async function giveUp() {
    gaveUp = true;
    reveal = true;
    verdict = "missed";
    stage = "done";
    await record("missed", "self", true);
  }

  const ready = $derived(s.kind === "choice" ? picked.length > 0 : s.kind === "value" ? !!typed.trim() : !!text.trim());
  const toggle = (i: number) => {
    if (s.kind !== "choice") return;
    picked = s.multiple ? (picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]) : [i];
  };
</script>

<section class="exercise" aria-label="Exercise">
  <div class="exercise-status">
    <span class={["chip", "ex-" + status]}>{STATUS_LABEL[status]}</span>
    {#if tests.length}<span class="exercise-tests">Tests {#each tests as t, i (t)}{i ? ", " : ""}<a href={conceptHref(t)}>{store.concepts.get(t)?.title}</a>{/each}</span>{/if}
    {#if goals.length}<span class="exercise-tests">For {#each goals as g, i (g)}{i ? ", " : ""}<a href={conceptHref(g)}>{store.concepts.get(g)?.title}</a>{/each}</span>{/if}
  </div>
  {#if "error" in parsed}<p class="edit-message bad">This exercise's answer settings are not right ({parsed.error}), so it is answered as text.</p>{/if}

  <Prose html={html(parts.problem)} />

  <div class="exercise-answer">
    {#if marking}
      <h2>Mark your answer</h2>
      <blockquote><Prose html={html(marking.answer)} /></blockquote>
    {:else if stage === "answer"}
      <h2>Your answer</h2>
      {#if !recording}<p class="section-note">{store.site.static ? "This is an exported snapshot, so" : "The learner record is off, so"} answers are not kept.</p>{/if}
      {#if s.kind === "choice"}
        <div class="exercise-choices" role={s.multiple ? "group" : "radiogroup"} aria-label={s.multiple ? "Choose every right answer" : "Choose one"}>
          {#if s.multiple}<p class="section-note">Choose every one that is right.</p>{/if}
          {#each s.choices as ch, i (i)}
            <label class={["exercise-choice", picked.includes(i) && "on"]}>
              <input type={s.multiple ? "checkbox" : "radio"} name={"ex-" + c.id} checked={picked.includes(i)} onchange={() => toggle(i)} />
              <Prose html={html(ch)} class="prose choice-text" />
            </label>
          {/each}
        </div>
      {:else if s.kind === "value"}
        <label class="exercise-value">
          <span class="section-note">A number (0.25, 1/4 and 2.5e-3 all work){s.unit ? `, in ${s.unit}` : ""}:</span>
          <input bind:value={typed} inputmode="decimal" autocomplete="off" onkeydown={(e) => { if (e.key === "Enter" && ready) void check(); }} />
          {#if s.unit}<span class="unit">{s.unit}</span>{/if}
        </label>
      {:else}
        <p class="section-note">Maths between dollar signs, shown as you type. For working on paper or in code, say where it is (a file in the repository).</p>
        <AnswerEditor bind:this={editor} bind:value={text} bind:selection pins={placed.marks} label="Your answer" rows={14} placeholder="Write your answer here: $x^2$ for maths, **bold**, - for a list." />
      {/if}
      {#if s.kind !== "text"}
        <details class="exercise-working" bind:open={showWorking}>
          <summary>Show your working (optional)</summary>
          {@render workingBox()}
          {#if recording}
            <label class="exercise-review"><input type="checkbox" bind:checked={review} disabled={!working.trim()} /> Have my working reviewed, whatever the answer</label>
          {/if}
        </details>
      {/if}
      <div class="exercise-actions">
        {#if s.kind === "text"}
          <button class="toggle primary" type="button" disabled={busy || !ready} onclick={markMine}>Mark it yourself</button>
          {#if recording}<button class="toggle" type="button" disabled={busy || !ready} onclick={askAgent}>Ask an agent to mark it</button>{/if}
        {:else}
          <button class="toggle primary" type="button" disabled={busy || !ready} onclick={check}>Check</button>
        {/if}
        <button class="link" type="button" disabled={busy} onclick={giveUp}>Show the solution</button>
      </div>
      {#if recording && (s.kind === "text" || working.trim() || versions.length)}
        <div class="draft-bar">
          <span class="section-note">{savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString(undefined, { timeStyle: "short" })}` : "Your draft is saved as you type"}</span>
          <button class="link" type="button" onclick={keep}>Keep this version</button>
          {#if versions.length}
            <details class="draft-versions">
              <summary>Versions ({versions.length})</summary>
              <ol>
                {#each [...versions].reverse() as v (v.id)}
                  <li><span class="draft-v">{v.id}</span> {v.reason} · {when(v.at)}
                    <button class="link" type="button" onclick={() => (showing = showing?.id === v.id ? null : v)}>{showing?.id === v.id ? "Hide" : "Show"}</button>
                    <button class="link" type="button" onclick={() => restore(v)}>Restore</button></li>
                {/each}
              </ol>
            </details>
          {/if}
        </div>
        {#if s.kind === "text" && recording}
          <TutorPanel exercise={c.id} dir={c.directory} {text} {working} {selection} bind:turns unanchored={placed.gone}
            onreveal={(id) => editor?.reveal(id) ?? false}
            onshow={(v) => { const x = versions.find((y) => y.id === v); if (x) showing = x; }}
            onrestore={(v) => { const x = versions.find((y) => y.id === v); if (x) void restore(x); }} />
        {/if}
        {#if showing}
          <div class="draft-shown" role="region" aria-label={`Your draft as it was at ${showing.id}`}>
            <p class="section-note">Your draft at {showing.id} ({showing.reason}), {when(showing.at)}:</p>
            {#if showing.text}<Prose html={html(showing.text)} />{/if}
            {#if showing.working}<p class="section-note">Working:</p><Prose html={html(showing.working)} />{/if}
            {#if !showing.text && !showing.working}<p class="empty">It was empty.</p>{/if}
          </div>
        {/if}
      {/if}
    {:else if stage === "grade"}
      <h2>Your answer</h2>
      <blockquote><Prose html={html(text)} /></blockquote>
    {:else if stage === "queued"}
      <h2>Saved for marking</h2>
      <blockquote><Prose html={html(text)} /></blockquote>
    {:else}
      <p class={["exercise-verdict", verdict ?? ""]} role="status">
        {gaveUp ? "Here is the solution." : verdict === "got" ? "Right." : verdict === "partly" ? "Partly." : "Not right."}
        {#if s.kind === "value" && verdict === "missed" && !gaveUp}The answer is {s.value}{s.unit ? " " + s.unit : ""}.{/if}
        {#if s.kind === "choice" && verdict === "missed" && !gaveUp}The right {s.correct.length > 1 ? "choices are" : "choice is"} {s.correct.map((i) => i + 1).join(" and ")}.{/if}
      </p>
      {#if s.kind !== "text" && !gaveUp && recording && lastId}
        {#if sentForReview}
          <p class="section-note">Your working is waiting for review: an agent reads it next time you ask to be taught or tested, or mark it yourself under Your attempts. The review decides the result.</p>
        {:else if verdict === "missed"}
          <div class="exercise-offer">
            <p>If it was a slip, or you would like to know where it went wrong, send your working for review. A slip in a sound method counts as partly right.</p>
            {#if !working.trim() || showWorking}{@render workingBox()}{:else}<blockquote><Prose html={html(working)} /></blockquote>{/if}
            <button class="toggle" type="button" disabled={busy || !working.trim()} onclick={sendWorking}>Send my working for review</button>
          </div>
        {/if}
      {/if}
    {/if}
    <p class="edit-status" role="status">{message}</p>

    {#if reveal || stage === "queued"}
      {#if stage === "queued" && !reveal}
        <button class="toggle" type="button" onclick={() => (reveal = true)}>Show the solution</button>
      {:else if parts.solution}
        <h2>Solution</h2>
        <Prose html={html(parts.solution)} />
      {:else}
        <p class="section-note">There is no written solution. Check against the notes it tests{#if tests.length}: {#each tests as t, i (t)}{i ? ", " : ""}<a href={conceptHref(t)}>{store.concepts.get(t)?.title}</a>{/each}{/if}.</p>
      {/if}
    {/if}

    {#if marking?.working}
      <h3 class="exercise-sub">Your working</h3>
      <blockquote><Prose html={html(marking.working)} /></blockquote>
    {/if}
    {#if stage === "grade" || marking}
      <div class="practice-grades" role="group" aria-label="How did you do?">
        <span class="section-note">{marking?.working && marking.result !== null ? "Against the solution, how sound was the working? A slip in a sound method is partly; a right answer without a sound argument is partly too." : "Against the solution, how did you do?"}</span>
        <button class="toggle" type="button" disabled={busy} onclick={() => grade("missed")}>Missed it</button>
        <button class="toggle" type="button" disabled={busy} onclick={() => grade("partly")}>Partly</button>
        <button class="toggle primary" type="button" disabled={busy} onclick={() => grade("got")}>Got it</button>
      </div>
    {/if}
    {#if stage === "done" || stage === "queued"}
      <p class="exercise-next">
        {#if set && nextInSet}<a class="toggle primary" href={conceptHref(nextInSet)}>Next in “{set.note}”: {store.concepts.get(nextInSet)?.title ?? nextInSet}</a>
        {:else if set}<a class="toggle primary" href="#/learn">Set finished: back to Learn</a>{/if}
        <button class="toggle" type="button" onclick={again}>Try again</button>
      </p>
    {/if}
  </div>

  {#if mine.length}
    <h2 class="section-h">Your attempts</h2>
    <ul class="explain-list exercise-attempts">
      {#each mine as a (a.id)}
        <li class={a.result ?? "waiting"}>
          <p class="explain-meta"><Time iso={a.at} /> · {a.gaveUp ? "gave up" : a.result ? STATUS_LABEL[a.result === "got" ? "passed" : a.result] : "waiting for marking"}{a.result && !a.gaveUp ? ` · ${BY_LABEL(a.by)}` : ""}{a.marked && a.checked && a.checked !== a.result ? ` (checked here: ${STATUS_LABEL[a.checked === "got" ? "passed" : a.checked].toLowerCase()})` : ""}{a.review && !a.marked ? " · working waiting for review" : ""}{a.help ? ` · written with ${[a.help.hint && `${a.help.hint} ${a.help.hint === 1 ? "hint" : "hints"}`, a.help.feedback && "feedback", a.help.discuss && "discussion"].filter(Boolean).join(", ")}` : ""}</p>
          {#if a.answer}<blockquote><Prose html={html(a.answer)} /></blockquote>{/if}
          {#if a.working}<details class="attempt-working"><summary>Working</summary><Prose html={html(a.working)} /></details>{/if}
          {#if a.feedback}<p class="explain-feedback">{a.feedback}</p>{/if}
          {#if a.gaps.length}<ul class="explain-gaps">{#each a.gaps as g, i (i)}<li>{g}</li>{/each}</ul>{/if}
          {#if needsMarking(a) && recording && !marking}
            <button class="link" type="button" onclick={() => { marking = a; reveal = true; message = ""; }}>{a.result === null ? "Mark it yourself instead" : "Review your working yourself"}</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#snippet workingBox()}
  <AnswerEditor bind:value={working} label="Your working" rows={9} placeholder="Your working, step by step: maths between dollar signs." />
{/snippet}
