<script lang="ts">
  // Today in project mode (T59, sketch ProjectToday): counters for the week in
  // place of streaks, then what needs you, then where you left off. The margin
  // holds what changed, the teacher's next step, artifacts, and Get up
  // to speed: the learning layer on top of a project. There are no checks to
  // count (rdstudio sees git, not CI), so the fourth counter is notes changed.
  import { onMount } from "svelte";
  import type { DraftSummary } from "$lib/api/types.gen.ts";
  import { changedSince } from "$lib/catchup.ts";
  import { store } from "$lib/data.svelte.ts";
  import { exercisesFor, goalNotes, goalsOf, openSets, progressOf, shownState, tried, waiting, type Shown } from "$lib/exercises.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { reviewItems } from "$lib/review.ts";
  import { drafts as draftsApi, nextStep, type NextStep } from "$lib/teacher.svelte.ts";
  import { understanding } from "$lib/understanding.svelte.ts";
  import { isStudyNote } from "@rdstudio/core/learning";
  import Prose from "./Prose.svelte";
  import SetsForYou from "./SetsForYou.svelte";

  const now = Date.now();
  const DAY = 86400000;
  const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = dayStart(now);
  const weekStart = today - ((new Date(today).getDay() + 6) % 7) * DAY; // Monday

  const commits = $derived(store.changes.commits.filter((c) => !c.pending));
  const at = (iso: string) => new Date(iso).getTime();
  const thisWeek = $derived(commits.filter((c) => at(c.date) >= weekStart));
  const todayCount = $derived(commits.filter((c) => at(c.date) >= today).length);
  // The last seven days, oldest first: whether anything was committed.
  const days = $derived(Array.from({ length: 7 }, (_, i) => today - (6 - i) * DAY).map((d) => commits.some((c) => at(c.date) >= d && at(c.date) < d + DAY)));
  const knowledge = $derived(store.site.knowledge + "/");
  const notesChanged = $derived(new Set(thisWeek.flatMap((c) => c.files.filter((f) => f.path.startsWith(knowledge) && f.path.endsWith(".md")).map((f) => f.path))).size);
  const reportsThisWeek = $derived(store.artifacts.filter((r) => at(r.date) >= weekStart));
  const recentReports = $derived([...store.artifacts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4));
  const reportHref = (path: string) => "#/a/" + path.split("/").map(encodeURIComponent).join("/");

  // What needs you: the review queue, most pressing first. Red only where
  // something is wrong (errors, broken links); the rest are plain tags.
  interface Need { key: string; href: string; title: string; what: string; tag: string; bad?: boolean }
  const needs = $derived.by((): Need[] => {
    const r = reviewItems();
    return [
      ...r.errors.map((i, n): Need => ({ key: "e" + n, href: "#/review", title: i.message, what: i.path ?? "", tag: "error", bad: true })),
      ...r.proposals.map(({ c, p }): Need => ({ key: "p" + c.id + p.id, href: conceptHref(c.id), title: c.title, what: `a change proposed by ${p.by}`, tag: "waiting on you" })),
      ...r.stale.map((c): Need => ({ key: "s" + c.id, href: conceptHref(c.id), title: c.title, what: "changed since a person checked it", tag: "check again" })),
      ...r.unverified.map((c): Need => ({ key: "u" + c.id, href: conceptHref(c.id), title: c.title, what: "written by an agent", tag: "not reviewed" })),
      ...r.broken.map((i, n): Need => ({ key: "b" + n, href: "#/review", title: i.message, what: i.path ?? "", tag: "broken link", bad: true })),
    ];
  });
  const reviewOpen = $derived(needs.length);

  const changed = $derived(understanding.on ? changedSince() : []);
  const due = $derived(understanding.on ? understanding.due() : { due: [], more: 0 });
  const marking = $derived(understanding.on ? waiting() : []);
  const tours = $derived([...store.concepts.values()].filter((c) => c.type === "Tour"));
  const studyIds = $derived([...store.concepts.values()].filter(isStudyNote).map((c) => c.id));
  const cov = $derived(understanding.on ? understanding.coverage("") : null);

  let drafts = $state<DraftSummary[]>([]);
  let next = $state<NextStep | null>(null);
  onMount(() => {
    void draftsApi.list().then((d) => { drafts = d; });
    void nextStep().then((n) => { next = n; });
  });
  // The learning layer on top: what the teacher set for you, as on the learning Today.
  const sets = $derived(understanding.on ? openSets() : []);
  const drafted = $derived(new Set(drafts.map((d) => d.exercise)));
  const attempts = $derived(understanding.on ? tried() : new Map());
  const stateOf = (id: string): Shown => shownState(id, drafted, attempts);
  const cont = $derived(drafts.find((d) => store.concepts.has(d.exercise)) ?? null);
  const title = (id: string) => store.concepts.get(id)?.title ?? id;
  const plural = (n: number, one: string, many = one + "s") => (n === 1 ? one : many);
</script>

<svelte:head><title>Today · {store.site.title}</title></svelte:head>

<div class="today project-today">
  <div class="today-main">
    <div class="page-head"><h1>Today</h1><span class="caption">{new Date(now).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {store.site.title}</span></div>

    <section class="streak-strip" aria-label="This week">
      <div class="s-row">
        <a class="s-tile" href="#/changes">
          <div class="s-label">Commits</div>
          <div class="s-num"><b>{thisWeek.length}</b><span>this week</span></div>
          <div class="s-state"><i class={["box", todayCount && "on"]} aria-hidden="true"></i>{todayCount} today</div>
          <div class="s-best">{store.changes.available ? (store.changes.branch ? `on ${store.changes.branch}` : "") : "no git history"}</div>
        </a>
        <a class="s-tile" href="#/review">
          <div class="s-label">Reviews open</div>
          <div class="s-num"><b>{reviewOpen}</b><span>{plural(reviewOpen, "item")}</span></div>
          <div class="s-state"><i class={["box", !reviewOpen && "on"]} aria-hidden="true"></i>{reviewOpen ? "waiting on you" : "nothing waiting"}</div>
          <div class="s-best"></div>
        </a>
        <a class="s-tile" href="#/changes">
          <div class="s-label">Notes changed</div>
          <div class="s-num"><b>{notesChanged}</b><span>this week</span></div>
          <div class="s-state"><i class={["box", notesChanged && "on"]} aria-hidden="true"></i>in the knowledge base</div>
          <div class="s-best"></div>
        </a>
        <a class="s-tile" href="#/artifacts">
          <div class="s-label">Artifacts</div>
          <div class="s-num"><b>{reportsThisWeek.length}</b><span>this week</span></div>
          <div class="s-state"><i class={["box", reportsThisWeek.length && "on"]} aria-hidden="true"></i>{store.artifacts.length} in all</div>
          <div class="s-best"></div>
        </a>
      </div>
      <div class="week">Last 7 days
        <span class="segs" aria-hidden="true">{#each days as d, i (i)}<i class={d ? "on" : ""}></i>{/each}</span>
        commits on {days.filter(Boolean).length} of 7 days
      </div>
    </section>

    <section class="sec">
      <div class="sec-head"><span class="kind">Needs you</span><span class="caption">{needs.length ? `${needs.length} in review` : "nothing"}</span></div>
      {#if needs.length}
        <ol class="ex needs">
          {#each needs.slice(0, 8) as n, i (n.key)}
            <li><span class="n">{i + 1}</span><a class="t" href={n.href}>{n.title}{#if n.what}<span class="caption need-what">{n.what}</span>{/if}</a><span class={["st", n.bad ? "st-miss" : "st-prog"]}>{n.tag}</span></li>
          {/each}
        </ol>
        {#if needs.length > 8}<p class="caption"><a href="#/review">All {needs.length} in review</a></p>{/if}
      {:else}
        <p class="section-note">Nothing waits for review: every note a person checked is unchanged since, and no proposal is open.</p>
      {/if}
    </section>

    <SetsForYou {sets} {next} {stateOf} />

    {#if cont}
      {@const c = store.concepts.get(cont.exercise)!}
      {@const g = goalsOf(c)}
      <section class="sec cont">
        <div class="sec-head"><span class="kind">Continue where you left off</span></div>
        <div class="cont-body">
          <div>
            <h3>{c.title}</h3>
            {#if g.length}<p class="for">For: {g.map(title).join(", ")}</p>{/if}
            <div class="draft"><Prose html={render(cont.excerpt.length >= 400 ? cont.excerpt + " …" : cont.excerpt)} /></div>
          </div>
          <div class="cont-go">
            <a class="toggle primary" href={conceptHref(c.id)}>Continue writing</a>
            <div class="caption">Draft saved{cont.hints ? ` · ${cont.hints} of 3 hints used` : ""}</div>
          </div>
        </div>
      </section>
    {/if}
  </div>

  <aside class="today-margin">
    {#if understanding.on}
      <div class="mblock">
        <div class="kind-row"><span class="kind">Changed since you looked</span><span class="caption">{changed.length} {plural(changed.length, "note")}</span></div>
        {#if changed.length}
          <ul>{#each changed.slice(0, 6) as { c } (c.id)}<li><a href={conceptHref(c.id)}>{c.title}</a></li>{/each}</ul>
        {:else}<p class="caption mblock-empty">Nothing you have looked at has changed.</p>{/if}
      </div>
    {/if}
    {#if next}
      <aside class={["pin", "pin-" + next.pen, "today-pin", next.about && sets.some((x) => x.exercises.includes(next!.about!)) && "has-inline"]}>
        <div class="pin-head"><b>The teacher’s next step</b></div>
        {#if next.about && store.concepts.has(next.about)}<div class="pin-quote"><span>{title(next.about)}</span></div>{/if}
        <Prose html={render(next.text)} />
      </aside>
    {/if}
    <div class="mblock">
      <div class="kind-row"><span class="kind">Artifacts</span><span class="caption">{store.artifacts.length} {plural(store.artifacts.length, "artifact")}</span></div>
      {#if recentReports.length}
        <ul>{#each recentReports as r (r.path)}<li><a href={reportHref(r.path)}>{r.title}</a><span class="caption">{new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></li>{/each}</ul>
      {:else}<p class="caption mblock-empty">No artifacts yet. They are .html files beside the notes in {store.site.knowledge}/.</p>{/if}
    </div>
    {#if due.due.length}
      <div class="mblock">
        <div class="kind-row"><span class="kind">Reviews due</span><span class="caption">{due.due.length}{due.more ? ` + ${due.more}` : ""}</span></div>
        <ul>{#each due.due as r (r.id)}<li><a href={conceptHref(r.id)}>{title(r.id)}</a></li>{/each}</ul>
        <p class="mblock-go"><a href="#/practice/recall">Review them</a></p>
      </div>
    {/if}
    {#if marking.length}
      <div class="mblock waiting-marking">
        <div class="kind-row"><span class="kind">Waiting for marking</span><span class="caption">{marking.length}</span></div>
        <ul>{#each marking.slice(0, 6) as a (a.id)}<li><a href={conceptHref(a.exercise)}>{title(a.exercise)}</a><span class="caption">{a.result === null ? "answer" : "working"}</span></li>{/each}</ul>
        <p class="caption mblock-empty">An agent marks them next time you ask to be taught or tested, or you can mark one yourself on its page.</p>
      </div>
    {/if}
    {#if goalNotes().length}
      <div class="mblock goals">
        <div class="kind-row"><span class="kind">Goals</span></div>
        <ul>
          {#each goalNotes() as g (g.id)}
            {@const ex = exercisesFor(g.id)}
            {@const p = progressOf(g)}
            <li><a href={conceptHref(g.id)}>{g.title}</a><span class="caption">{ex.length ? (p.met ? "met" : `${p.exercises.filter((e) => e.status === "passed").length} of ${ex.length}`) : "none yet"}</span></li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="mblock">
      <div class="kind-row"><span class="kind">Get up to speed</span><span class="caption">learning</span></div>
      <ul>
        {#each tours.slice(0, 3) as t (t.id)}<li><a href={"#/tour/" + t.id}>Tour: {t.title}</a></li>{/each}
        <li><a href="#/learn">Your understanding of {store.site.title}</a><span class="caption">{cov ? `${cov.processed + cov.understood} of ${studyIds.length} notes` : "record off"}</span></li>
      </ul>
    </div>
  </aside>
</div>
