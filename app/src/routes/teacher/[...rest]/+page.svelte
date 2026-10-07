<script lang="ts">
  // The teacher (T43, T45): how the agent teaches here, and what it knows of
  // you. #/teacher shows its picture of you, the sources log, the profile,
  // the skills and the history; #/teacher/profile and #/teacher/sources open
  // those files to read and edit; #/teacher/evidence/<id> is one event cited
  // as evidence; #/teacher/skills/<name> shows one skill, where it can be
  // customised, compared with rdstudio's default and reset. Kept off the main
  // navigation: the defaults are meant to be enough.
  import { untrack } from "svelte";
  import { page } from "$app/state";
  import type { Skill } from "$lib/api/types.gen.ts";
  import { learner, store } from "$lib/data.svelte.ts";
  import { render } from "$lib/markdown.ts";
  import { lineDiff } from "$lib/linediff.ts";
  import { PROFILE_LABEL, teacher } from "$lib/teacher.svelte.ts";
  import Prose from "$lib/components/Prose.svelte";
  import Time from "$lib/components/Time.svelte";
  import TeacherFile from "$lib/components/TeacherFile.svelte";
  import EvidenceView from "$lib/components/EvidenceView.svelte";
  import AiPanel from "$lib/components/AiPanel.svelte";

  const rest = $derived((page.params.rest ?? "").split("/").filter(Boolean));
  const skillName = $derived(rest[0] === "skills" && rest[1] ? rest[1] : null);
  const fileName = $derived(rest[0] === "profile" ? "profile.md" : rest[0] === "sources" ? "sources.md" : null);
  const evidenceId = $derived(rest[0] === "evidence" && rest[1] ? rest[1] : null);
  const FILE_TITLE = { "profile.md": "About you", "sources.md": "Sources" } as const;
  const STATUS: Record<Skill["status"], string> = { default: "default", changed: "customised", own: "your own" };

  $effect(() => { if (!teacher.loaded) void teacher.load(); });

  // ---------------------------------------------------------------- one skill
  let skill = $state<Skill | null>(null);
  let missing = $state(false);
  let draft = $state<string | null>(null); // the text being edited, or null
  let compare = $state<"default" | "update" | null>(null);
  let status = $state(""), busy = $state(false);

  $effect(() => {
    const name = skillName;
    untrack(() => { skill = null; missing = false; draft = null; compare = null; status = ""; });
    if (!name) return;
    void teacher.skill(name).then((s) => { if (skillName === name) { skill = s; missing = !s; } });
  });

  const plain = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
  const writable = $derived(learner.enabled && !store.site.static);

  async function save() {
    if (!skill || draft === null) return;
    busy = true; status = "";
    try {
      skill = await teacher.save(skill.name, draft);
      draft = null; status = "Saved. The agent reads your version from its next request.";
    } catch (err) { status = (err as Error).message; }
    busy = false;
  }
  async function reset() {
    if (!skill) return;
    const own = skill.status === "own";
    if (!confirm(own ? `Delete your skill ${skill.name}?` : `Discard your version of ${skill.name} and use rdstudio's default?`)) return;
    busy = true; status = "";
    try {
      const name = skill.name;
      skill = await teacher.reset(name);
      if (!skill) { missing = true; status = `${name} is deleted.`; } else { compare = null; status = "Back to rdstudio's default."; }
    } catch (err) { status = (err as Error).message; }
    busy = false;
  }
  /** Adopt the new default as the start of your version (the old customisation stays in the history). */
  function startFromDefault() {
    if (skill?.default) { draft = skill.default; compare = null; }
  }
</script>

<svelte:head><title>{skillName ? `${skillName} · Axis` : fileName ? `${FILE_TITLE[fileName]} · Axis` : evidenceId ? "Evidence · Axis" : "Axis"} · {store.site.title}</title></svelte:head>

<div class="page teacher">
  {#if store.site.static}
    <h1>Axis</h1>
    <p class="lede">This is an exported snapshot, so Axis's side, which is private to whoever runs rdstudio serve, is not part of it.</p>

  {:else if fileName}
    <p class="doc-kind"><a href="#/learn">Learn</a><a href="#/teacher">Axis</a></p>
    <h1>{FILE_TITLE[fileName]}</h1>
    <p class="lede">{fileName === "profile.md" ? "What the agent has learnt about how you learn, from the evidence in your learner record. Private to you. If a claim is wrong, edit it: the next agent to update the profile is told, and answers." : "Where the knowledge base's sources came from: what was searched, what was chosen and rejected, and why."}</p>
    <TeacherFile name={fileName} full />

  {:else if evidenceId}
    <p class="doc-kind"><a href="#/learn">Learn</a><a href="#/teacher">Axis</a><a href="#/teacher/profile">About you</a><span>Evidence</span></p>
    <EvidenceView id={evidenceId} />

  {:else if !skillName}
    <p class="doc-kind"><a href="#/learn">Learn</a></p>
    <h1>Axis</h1>
    <p class="lede">Axis is the agent that works with you here: your teacher in a learning project, and the one that keeps a project in order. This is how it works, and what it has learnt about you. The skills it follows are rdstudio's defaults unless you change them; all of this stays private, beside your learner record.</p>

    {#if learner.enabled}
      <h2 class="section-h">About you</h2>
      <TeacherFile name="profile.md" />
      <h2 class="section-h">Sources</h2>
      <details class="teacher-sources"><summary>The research log</summary><TeacherFile name="sources.md" /></details>
    {/if}

    <h2 class="section-h">Models and spending</h2>
    <AiPanel />

    {#if !teacher.loaded}
      <p class="section-note">Loading…</p>
    {:else if !teacher.state}
      <p class="empty">This server does not have Axis yet. Update rdstudio and restart rdstudio serve.</p>
    {:else}
      {@const t = teacher.state}
      <h2 class="section-h">Profile</h2>
      <p><strong>{PROFILE_LABEL[t.profile]}</strong>{t.profileSet ? "" : ", guessed from what is in the repository"}.</p>
      <p class="section-note">The profile changes what the skills treat as ground truth and what an exercise looks like. It belongs to the project, so it is set in <code>rdstudio.toml</code>:
        run <code>rdstudio teacher profile topic</code>, <code>codebase</code> or <code>project</code>.</p>

      <h2 class="section-h">Skills</h2>
      <p class="section-note">The defaults are meant to be enough. Change one only when the agent keeps teaching in a way that does not work for you.</p>
      <ul class="rows teacher-skills">
        {#each t.skills as s (s.name)}
          <li>
            <a class="title" href={"#/teacher/skills/" + s.name}>{s.name}</a>
            <span class={["chip", "skill-" + s.status]}>{STATUS[s.status]}</span>
            {#if s.defaultChanged}<span class="chip stale-note" title="rdstudio's default has changed since you customised it">default updated</span>{/if}
            {#if s.description}<div class="desc">{s.description}</div>{/if}
          </li>
        {/each}
      </ul>

      <h2 class="section-h">History</h2>
      {#if !t.enabled}
        <p class="section-note">The learner record is off, so there is no teacher folder yet. Turn it on in the <a href="#/learn">Learn tab</a> to keep goals, exercises and changes to the skills.</p>
      {:else if t.history.length}
        <ul class="teacher-history">
          {#each t.history as h, i (i)}<li><Time iso={h.at} /> {h.message}</li>{/each}
        </ul>
        <p class="section-note">Kept in <code>{t.dir}</code>, in a git repository of its own.</p>
      {:else}
        <p class="section-note">Nothing yet. Each change to Axis's folder (<code>{t.dir}</code>) is kept in its own git history.</p>
      {/if}
    {/if}

  {:else}
    <p class="doc-kind"><a href="#/learn">Learn</a><a href="#/teacher">Axis</a><span>Skill</span></p>
    {#if missing}
      <h1>{skillName}</h1>
      <p class="empty">{status || "There is no skill by that name."} <a href="#/teacher">All skills</a></p>
    {:else if !skill}
      <h1>{skillName}</h1>
      <p class="section-note">Loading…</p>
    {:else}
      <h1>{skill.name} <span class={["chip", "skill-" + skill.status]}>{STATUS[skill.status]}</span></h1>
      {#if skill.description}<p class="lede">{skill.description}</p>{/if}

      {#if skill.defaultChanged && draft === null}
        <div class="catch-up" role="note">
          <p>rdstudio's default has changed since you customised this.
            <button class="link" type="button" onclick={() => (compare = compare === "update" ? null : "update")}>{compare === "update" ? "Hide" : "What changed"}</button>
            <button class="link" type="button" onclick={startFromDefault} disabled={!writable}>Start again from the new default</button></p>
        </div>
      {/if}

      <div class="teacher-actions">
        {#if draft === null}
          {#if writable}<button class="toggle primary" type="button" onclick={() => (draft = skill!.text)}>{skill.status === "default" ? "Customise" : "Edit your version"}</button>{/if}
          {#if skill.status === "changed"}<button class="toggle" type="button" onclick={() => (compare = compare === "default" ? null : "default")}>{compare === "default" ? "Hide the comparison" : "Compare with the default"}</button>{/if}
          {#if skill.status !== "default" && writable}<button class="toggle" type="button" onclick={reset} disabled={busy}>{skill.status === "own" ? "Delete" : "Reset to the default"}</button>{/if}
        {/if}
        {#if !writable}<span class="section-note">Turn the learner record on to customise skills.</span>{/if}
      </div>
      <p class="edit-status" role="status">{status}</p>

      {#if compare && draft === null}
        {@const from = compare === "default" ? skill.default ?? "" : skill.base ?? ""}
        {@const to = compare === "default" ? skill.text : skill.default ?? ""}
        <p class="section-note">{compare === "default" ? "rdstudio's default (−) against your version (+)." : "The default you customised (−) against rdstudio's default now (+)."}</p>
        <div class="catch-diff" aria-label="Removed lines marked −, added lines +">
          {#each lineDiff(from, to) as l, i (i)}<div class={"d-" + l.kind}>{l.kind === "add" ? "+ " : l.kind === "del" ? "− " : l.kind === "hunk" ? "⋯ " : "  "}{l.text}</div>{/each}
        </div>
      {/if}

      {#if draft !== null}
        <p class="section-note">Markdown, as the agent reads it. Keep the frontmatter's description: it tells the agent when to use the skill.{skill.status === "default" ? " Your version is private, and rdstudio's default stays available to go back to." : ""}</p>
        <textarea class="teacher-editor" bind:value={draft} spellcheck="true" aria-label="The skill's text"></textarea>
        <div class="teacher-actions">
          <button class="toggle primary" type="button" onclick={save} disabled={busy || !draft.trim() || draft === skill.text}>Save</button>
          <button class="toggle" type="button" onclick={() => { if (draft === skill!.text || confirm("Discard your changes?")) draft = null; }}>Cancel</button>
        </div>
      {:else}
        <Prose html={render(plain(skill.text))} />
      {/if}
    {/if}
  {/if}
</div>
