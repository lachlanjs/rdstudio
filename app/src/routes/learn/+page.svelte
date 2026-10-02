<script lang="ts">
  // Reading order from requires links, and the private learner record.
  import { learner, store } from "$lib/data.svelte.ts";
  import { conceptHref, dirHref, titleCase } from "$lib/format.ts";
  import { hasRequires } from "$lib/learn.ts";
  import { sharedTours, tourHref } from "$lib/tours.ts";
  import { understanding } from "$lib/understanding.svelte.ts";
  import { RESULT_LABEL, answers, openQuestions } from "$lib/explain.ts";
  import { allPrerequisitesChanged, changedSince } from "$lib/catchup.ts";

  const folderLabel = (dir: string) => (dir ? dir.split("/").map((p) => titleCase(p.replace(/[-_]/g, " "))).join(" / ") : "Top level");
  const shared = $derived(sharedTours());
  const explained = $derived(understanding.on ? answers() : []);
  const waiting = $derived(explained.filter((a) => !a.marked));
  const asked = $derived(understanding.on ? openQuestions() : []);
  const changed = $derived(changedSince());
  const shaken = $derived(allPrerequisitesChanged());
  const sinceDay = (iso: string) => new Date(iso).toLocaleDateString();
  const folders = $derived(Object.keys(store.tree).filter((d) => d && !d.includes("/")).sort());
  const due = $derived(understanding.due());
  const next = $derived(due.due.length ? null : understanding.nextDue());
  const load = $derived(understanding.loadNote());
  const SEGMENTS = [["understood", "understood"], ["processed", "worked through"], ["discovered", "opened"]] as const;
  const inDays = (ms: number) => { const d = Math.max(1, Math.round((ms - Date.now()) / 86_400_000)); return d === 1 ? "tomorrow" : `in ${d} days`; };
  const notes = $derived([...store.concepts.values()].filter((c) => c.type !== "Tour").sort((a, b) => a.order - b.order));
</script>

<svelte:head><title>Learn · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Learn</h1>
  <p class="lede">Ways into this knowledge base: where you stand, practice, tours, and a reading order from the links rated requires.</p>
  {#if understanding.on}
    <h2 class="section-h">Where you stand</h2>
    <p class="section-note">From your record: notes you have opened, worked through or understood (by marking them, or by evidence from exercises and explain-back). No single score: each area on its own.</p>
    {#if load}<p class="load-note">{load}</p>{/if}
    <table class="coverage">
      <tbody>
        {#each folders as f (f)}
          {@const cov = understanding.coverage(f)}
          {#if cov.total}
            <tr>
              <th scope="row"><a href={dirHref(f)}>{folderLabel(f)}</a></th>
              <td>
                <span class="cov-bar" role="img" aria-label={`${cov.understood} understood, ${cov.processed} worked through, ${cov.discovered} opened, ${cov.undiscovered} not yet, of ${cov.total}`}>
                  {#each SEGMENTS as [k] (k)}{#if cov[k]}<span class={"cov-" + k} style:width={`${(100 * cov[k]) / cov.total}%`}></span>{/if}{/each}
                </span>
              </td>
              <td class="cov-text">{SEGMENTS.filter(([k]) => cov[k]).map(([k, label]) => `${cov[k]} ${label}`).join(", ") || "not started"} <span>of {cov.total}</span></td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
    <h3 class="sub-h">Due for review</h3>
    {#if due.due.length}
      <ul class="rows due">
        {#each due.due as r (r.id)}
          {@const c = store.concepts.get(r.id)}
          {#if c}<li><a class="title" href={conceptHref(c.id)}>{c.title}</a><div class="sub"><span>{folderLabel(c.directory)}</span>{#if r.last}<span>last recalled {new Date(r.last).toLocaleDateString()}</span>{:else}<span>not recalled yet</span>{/if}</div></li>{/if}
        {/each}
      </ul>
      <p><a class="toggle primary" href="#/practice/recall">Review them</a>
        {#if due.more}<span class="section-note"> {due.more} more {due.more === 1 ? "is" : "are"} waiting; they come a few at a time so the pile never grows.</span>{/if}</p>
    {:else}
      <p class="empty">Nothing is due.{#if next} The next review is {inDays(next)}.{:else} Mark a note worked through or understood, or practise recall, and it comes back for review.{/if}</p>
    {/if}
  {/if}
  {#if understanding.on}
    <h3 class="sub-h">Changed since you looked</h3>
    {#if changed.length || shaken.length}
      <ul class="rows changed-since">
        {#each changed.slice(0, 10) as { c, look } (c.id)}
          {@const s = understanding.state(c.id)}
          <li><a class="title" href={conceptHref(c.id)}>{c.title}</a>
            <div class="sub"><span>last looked {sinceDay(look.at)}</span>{#if s && (s.state === "understood" || s.state === "processed")}<span class="stale-note">you {s.state === "understood" ? "understood" : "worked through"} an older version</span>{/if}</div></li>
        {/each}
        {#each shaken.slice(0, 10) as { c, changed: moved } (c.id)}
          <li><a class="title" href={conceptHref(c.id)}>{c.title}</a>
            <div class="sub"><span class="stale-note">requires {moved.map((p) => p.title).join(", ")}, changed since you understood it</span></div></li>
        {/each}
      </ul>
      {#if changed.length > 10}<p class="section-note">And {changed.length - 10} more; opening a note counts as looking.</p>{/if}
    {:else}
      <p class="empty">Nothing you have looked at has changed since.</p>
    {/if}
    <h3 class="sub-h">Explain-back</h3>
    <p class="section-note">Explain a note in your own words (under each note); an agent marks it against the note the next time you use the explain-back skill in your harness. The dashboard never calls a model.</p>
    {#if asked.length}
      <p>Questions for you:</p>
      <ul class="rows explain-asked-list">
        {#each asked.slice(0, 8) as q (q.id)}{@const c = store.concepts.get(q.concept)}
          {#if c}<li><a class="title" href={conceptHref(c.id)}>{c.title}</a><div class="desc">{q.question}</div></li>{/if}
        {/each}
      </ul>
    {/if}
    {#if explained.length}
      <p class="section-note">{waiting.length ? `${waiting.length} waiting for marking.` : "Nothing waiting for marking."}</p>
      <ul class="rows explained">
        {#each explained.filter((a) => a.marked).slice(0, 5) as a (a.id)}{@const c = store.concepts.get(a.concept)}
          <li><a class="title" href={conceptHref(a.concept)}>{c?.title ?? a.concept}</a>
            <div class="sub"><span class={"result-" + a.marked!.result}>{RESULT_LABEL[a.marked!.result] ?? a.marked!.result}</span><span>{new Date(a.marked!.at).toLocaleDateString()}</span></div>
            <div class="desc">{a.marked!.feedback}</div></li>
        {/each}
      </ul>
    {:else if !asked.length}
      <p class="empty">None yet.</p>
    {/if}
  {/if}
  <h2 class="section-h">Practice</h2>
  <p class="section-note">Short rounds of exercises, checked here: recall with a self-grade, fill the gap, placement, and naming the landmarks.</p>
  <p><a class="toggle" href="#/practice">Practise</a></p>
  <h2 class="section-h">Tours</h2>
  <p class="section-note">Walks through the notes in a chosen order, with a sentence at each stop. Following one shows its route on the map. Tours are kept off the map and graph.</p>
  {#if shared.length}
    <ul class="rows tours">
      {#each shared as t (t.id)}
        <li><a class="title" href={tourHref(t.id)}>{t.title}</a>{#if t.description}<div class="desc">{t.description}</div>{/if}
          <div class="sub"><a href={tourHref(t.id)}>Follow</a><a href={conceptHref(t.id)}>Read as a note</a></div></li>
      {/each}
    </ul>
  {/if}
  {#if learner.enabled}
    <h3 class="sub-h">Your tours</h3>
    {#if learner.tours.length}
      <ul class="rows tours">
        {#each learner.tours as t (t.name)}
          <li><a class="title" href={tourHref("~" + t.name)}>{t.title}</a>{#if t.description}<div class="desc">{t.description}</div>{/if}
            <div class="sub"><a href={tourHref("~" + t.name)}>Follow</a><a href={"#/tours/" + t.name}>Edit</a><span>private</span></div></li>
        {/each}
      </ul>
    {:else}
      <p class="empty">None yet. Writing a tour is a good way to find out what you know about a part of the map.</p>
    {/if}
    <p><a class="toggle" href="#/tours/new">Write a tour</a></p>
  {:else if !shared.length}
    <p class="empty">No tours yet. Shared tours are notes of type Tour; with the learner record on you can write your own.</p>
  {/if}
  <h2 class="section-h">Reading order</h2>
  {#if hasRequires()}
    <p class="section-note">Notes stay with their folder where they can. The level is the longest chain of prerequisites below a note; path shows that chain on the map.</p>
    <ol class="reading">
      {#each notes as c, i (c.id)}
        {#if i === 0 || c.directory !== notes[i - 1]!.directory}<li class="folder" aria-hidden="true">{folderLabel(c.directory)}</li>{/if}
        <li class="step" value={c.order + 1}>
          <a href={conceptHref(c.id)} title={c.description || c.title}>{c.title}</a>
          <span class="depth" title="The longest chain of prerequisites below this note">{c.depth ? `level ${c.depth}` : "start"}</span>
          {#if c.depth}<a class="path-link" href={"#/path/" + encodeURIComponent(c.id)} title="Study path to {c.title} on the map">path</a>{/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty">No links are rated requires yet, so there is no order to give. Rate a link by giving it the title "requires", as in [Topology](/topology.md "requires").</p>
  {/if}
  <h2 class="section-h">Your learner record</h2>
  {#if store.site.static}
    <p class="section-note">This is an exported snapshot, so nothing you do here is recorded.</p>
  {:else if !learner.enabled}
    <p class="section-note">Off. When it is on, rdstudio keeps a private record of what you study in this project, outside the repository, for the exercises and review to come. To turn it on, add this to ~/.config/rdstudio/config.toml and restart rdstudio serve:</p>
    <pre>[learner]
enabled = true</pre>
  {:else}
    <p class="section-note">On. {learner.events.length} {learner.events.length === 1 ? "event" : "events"}, stored privately in <code>{learner.dir}</code>. Only you see it; it is never part of the project or an export.</p>
  {/if}
</div>
