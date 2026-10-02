<script lang="ts">
  // One of the teacher's files about you (T45): the profile (what you find
  // easy and hard, how you learn, what to retest, each claim citing its
  // evidence) or the sources log. Agents write them; you can edit them, to
  // dispute a claim say, and the next agent to update the file is told.
  import type { TeacherFile } from "$lib/api/types.gen.ts";
  import { learner } from "$lib/data.svelte.ts";
  import { render } from "$lib/markdown.ts";
  import { linkEvidence, teacher } from "$lib/teacher.svelte.ts";
  import Prose from "./Prose.svelte";
  import Time from "./Time.svelte";

  let { name, full = false }: { name: TeacherFile["name"]; full?: boolean } = $props();

  let file = $state<TeacherFile | null>(null);
  let loaded = $state(false);
  let draft = $state<string | null>(null);
  let status = $state(""), busy = $state(false);

  $effect(() => {
    const n = name;
    void learner.enabled; // again once the record is known to be on
    void teacher.file(n).then((f) => { if (n === name) { file = f; loaded = true; } });
  });

  const EMPTY: Record<TeacherFile["name"], string> = {
    "profile.md": "No profile yet. When you ask an agent to assess you (the teach skill), it writes what the evidence shows: what comes easily, what does not and why, how you learn, and what to retest. Every claim links to the answers behind it.",
    "sources.md": "No sources logged yet. When an agent researches for the knowledge base (the teach skill), it logs what it searched, what it chose and rejected, and why.",
  };

  /** A commit message as you would say it: your own edits are yours. */
  const said = (m: string) => m.replace(/^[a-z]+\.md: edited by the developer$/, "edited by you").replace(/^[a-z]+\.md: /, "");

  async function save() {
    if (draft === null) return;
    busy = true; status = "";
    try {
      file = await teacher.saveFile(name, draft);
      draft = null;
      status = "Saved. The next agent to update this file is told of your edit, and answers it.";
    } catch (err) { status = (err as Error).message; }
    busy = false;
  }
</script>

{#if !loaded}
  <p class="section-note">Loading…</p>
{:else if !file}
  <p class="section-note">The learner record is off, so there is nothing here. Turn it on in the <a href="#/learn">Learn tab</a>.</p>
{:else if draft !== null}
  <p class="section-note">Markdown. Keep the [e:…] citations of claims you leave in; delete a claim you dispute, or say why under it.</p>
  <textarea class="teacher-editor" bind:value={draft} aria-label={`The text of ${name}`}></textarea>
  <div class="teacher-actions">
    <button class="toggle primary" type="button" disabled={busy || draft === (file.text ?? "")} onclick={save}>Save</button>
    <button class="toggle" type="button" onclick={() => { if (draft === (file?.text ?? "") || confirm("Discard your changes?")) draft = null; }}>Cancel</button>
  </div>
{:else}
  {#if file.text}
    <div class="teacher-file"><Prose html={linkEvidence(render(file.text))} /></div>
  {:else}
    <p class="empty">{EMPTY[name]}</p>
  {/if}
  <div class="teacher-actions">
    {#if full}
      <button class="toggle" type="button" onclick={() => (draft = file?.text ?? "")}>{file.text ? "Edit" : "Write it yourself"}</button>
    {:else if file.text}
      <a class="toggle" href={name === "profile.md" ? "#/teacher/profile" : "#/teacher/sources"}>Open{name === "profile.md" ? ", to edit or dispute" : ""}</a>
    {/if}
    {#if file.history[0]}<span class="section-note">Last changed <Time iso={file.history[0].at} />: {said(file.history[0].message)}</span>{/if}
  </div>
  {#if full && file.history.length > 1}
    <h2 class="section-h">Changes</h2>
    <ul class="teacher-history">
      {#each file.history as h (h.commit)}<li><Time iso={h.at} /> {said(h.message)}</li>{/each}
    </ul>
  {/if}
{/if}
<p class="edit-status" role="status">{status}</p>
