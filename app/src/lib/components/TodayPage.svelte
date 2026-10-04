<script lang="ts">
  // Today (T54): what to do now, from the sketch MarginaliaToday.
  // - Main column: the streaks, what the teacher set for you, and continue
  //   where you left off.
  // - The margin: reviews due, what changed since you looked, the teacher's
  //   next step pinned beside the row it is about, and goals.
  import { onMount } from "svelte";
  import type { DraftSummary } from "$lib/api/types.gen.ts";
  import { changedSince } from "$lib/catchup.ts";
  import { learner, store } from "$lib/data.svelte.ts";
  import { exercisesFor, goalNotes, goalsOf, openSets, progressOf, shownState, tried, waiting, type Shown } from "$lib/exercises.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import { STREAK_NAME, STREAK_ORDER, STREAK_WHAT, currentStreaks, dateOf, dayOf } from "$lib/streaks.ts";
  import { drafts as draftsApi, nextStep, type NextStep } from "$lib/teacher.svelte.ts";
  import { understanding } from "$lib/understanding.svelte.ts";
  import Prose from "./Prose.svelte";

  const on = $derived(understanding.on);
  const now = Date.now();
  const st = $derived(on ? currentStreaks(now) : null);
  const sets = $derived(on ? openSets() : []);
  const goals = $derived(goalNotes());
  const due = $derived(on ? understanding.due() : { due: [], more: 0 });
  const changed = $derived(on ? changedSince() : []);
  const marking = $derived(on ? waiting() : []);
  const title = (id: string) => store.concepts.get(id)?.title ?? id;

  let drafts = $state<DraftSummary[]>([]);
  let next = $state<NextStep | null>(null);
  onMount(() => {
    void draftsApi.list().then((d) => { drafts = d; });
    void nextStep().then((n) => { next = n; });
  });
  const drafted = $derived(new Set(drafts.map((d) => d.exercise)));
  const attempts = $derived(tried());
  const stateOf = (id: string): Shown => shownState(id, drafted, attempts);
  const CLASS: Record<Shown, string> = { passed: "st-pass", missed: "st-miss", "in progress": "st-prog", "not tried": "st-none" };
  const cont = $derived(drafts.find((d) => store.concepts.has(d.exercise)) ?? null);
  const setHead = (note: string) => {
    const i = note.indexOf(":");
    const desc = i > 0 ? note.slice(i + 1).trim() : "";
    return [i > 0 ? note.slice(0, i) : note, desc.charAt(0).toUpperCase() + desc.slice(1)];
  };
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });

  // The teacher's next step, pinned to the row it is about (when that row is on the page).
  let root = $state<HTMLElement>();
  let pin = $state<HTMLElement>();
  let leader = $state<{ d: string; x: number; y: number } | null>(null);
  let pinTop = $state(0);
  function place() {
    leader = null;
    if (!root || !pin || !next?.about) { pinTop = 0; return; }
    const row = root.querySelector<HTMLElement>(`[data-row="${CSS.escape(next.about)}"] .st`);
    if (!row || getComputedStyle(root).gridTemplateColumns.split(" ").length < 2) { pinTop = 0; return; } // one column: no line
    const rb = root.getBoundingClientRect(), t = row.getBoundingClientRect();
    const y = (t.top + t.bottom) / 2 - rb.top;
    // Where the card would sit without its offset (the DOM still has the last one).
    const natural = pin.getBoundingClientRect().top - rb.top - (parseFloat(pin.style.marginTop) || 0);
    pinTop = Math.max(0, y - 17 - natural);
    requestAnimationFrame(() => {
      if (!pin || !root) return;
      const p = pin.getBoundingClientRect(), x0 = t.right - rb.left + 6, x1 = p.left - rb.left, yc = p.top - rb.top + 17;
      leader = { d: `M${x0} ${y} H${x1 - 40} L${x1} ${yc}`, x: x1, y: yc };
    });
  }
  $effect(() => {
    void next; void sets; void drafts;
    const go = () => requestAnimationFrame(place);
    void document.fonts?.ready.then(go);
    go();
    addEventListener("resize", go);
    return () => removeEventListener("resize", go);
  });
</script>

<svelte:head><title>Today · {store.site.title}</title></svelte:head>

<div class="today" bind:this={root}>
  {#if leader}
    <svg class="leaders" aria-hidden="true"><path class={"ld-" + (next?.pen ?? "red")} d={leader.d} /><circle class={"dot-" + (next?.pen ?? "red")} cx={leader.x} cy={leader.y} r="3.5" /></svg>
  {/if}
  <div class="today-main">
    <div class="page-head"><h1>Today</h1><span class="caption">{new Date(now).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {store.site.title}</span></div>

    {#if !on}
      <p class="section-note">{store.site.static ? "This is an exported snapshot: Today needs your learner record, which is private to whoever runs rdstudio serve." : "Your learner record is off, so there is nothing to show here yet. Turn it on with [learner] enabled = true in ~/.config/rdstudio/config.toml, and restart rdstudio serve."}</p>
    {:else if st}
      {@const week = st.all.weeks}
      <section class="streak-strip" aria-label="Streaks">
        <div class="s-row">
          {#each STREAK_ORDER as k (k)}
            {@const s = st[k]}
            {@const kept = s.today === "done" || s.today === "rest"}
            <div class="s-tile" title={STREAK_WHAT[k]}>
              <div class="s-label">{STREAK_NAME[k]}</div>
              <div class="s-num"><b>{s.current}</b><span>{s.current === 1 ? "day" : "days"}</span></div>
              <div class="s-state"><i class={["box", kept && "on"]} aria-hidden="true"></i>{s.today === "done" ? "done today" : s.today === "rest" ? "nothing due today" : "not yet today"}</div>
              <div class="s-best">{s.best > s.current ? `best ${s.best}` : ""}</div>
            </div>
          {/each}
        </div>
        <div class="week">This week
          <span class="segs" aria-hidden="true">{#each Array.from({ length: learner.weekDays }) as _, i (i)}<i class={i < week.thisWeek ? "on" : ""}></i>{/each}</span>
          {Math.min(week.thisWeek, learner.weekDays)} of {learner.weekDays} days
          {#if week.current}<span>·</span> {week.current} {week.current === 1 ? "week" : "weeks"} in a row{/if}
          {#if st.all.reprieves}<span>·</span> {st.all.reprieves} {st.all.reprieves === 1 ? "reprieve" : "reprieves"} banked{/if}
          <details class="cal-toggle"><summary>Last five weeks</summary>
            <div class="streak-calendar" role="img" aria-label="Days on which all three counted, over the last five weeks">
              {#each ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as d (d)}<span class="cal-head">{d}</span>{/each}
              {#each Array.from({ length: 35 }, (_, i) => (Math.floor((dayOf(now) + 3) / 7) - 4) * 7 - 3 + i) as d (d)}
                {@const status = d > dayOf(now) ? "future" : st.all.days.find((x) => x.day === d)?.status ?? "none"}
                <span class={["cal-day", "cal-" + status, d === dayOf(now) && "cal-today"]} title={`${dateOf(d)}: ${status}`}></span>
              {/each}
            </div>
          </details>
        </div>
      </section>
      {#if understanding.loadNote()}<p class="section-note load">Your streaks are safe for today: a break now will do more for what you have learnt than more of it.</p>{/if}

      {#each sets as set (set.id)}
        {@const [head, desc] = setHead(set.note)}
        <section class="sec">
          <div class="sec-head"><span class="kind">Set for you</span><span class="caption">{set.done.length} of {set.exercises.length} answered · set {fmtDay(set.at)} by the teacher</span></div>
          <h2>{head}</h2>
          {#if desc}<p class="desc">{desc}</p>{/if}
          <ol class="ex">
            {#each set.exercises as x, i (x)}
              {@const s = stateOf(x)}
              <li data-row={x} class={s === "not tried" ? "none" : ""}>
                <span class="n">{i + 1}</span><a class="t" href={conceptHref(x)}>{title(x)}</a><span class={["st", CLASS[s]]}>{s}</span>
              </li>
            {/each}
          </ol>
        </section>
      {/each}

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

      {#if !sets.length && !cont && !due.due.length}
        <p class="empty">Nothing is waiting for you. Ask the teacher what is next, or open the <a href="#/practice">Practice</a> space.</p>
      {/if}
    {/if}
  </div>

  {#if on}
    <aside class="today-margin">
      <div class="mblock">
        <div class="kind-row"><span class="kind">Reviews due</span><span class="caption">{due.due.length}{due.more ? ` + ${due.more}` : ""}</span></div>
        {#if due.due.length}
          <ul>{#each due.due as r (r.id)}<li><a href={conceptHref(r.id)}>{title(r.id)}</a></li>{/each}</ul>
          <p class="mblock-go"><a href="#/practice/recall">Review them</a></p>
        {:else}<p class="caption mblock-empty">Nothing is due{understanding.nextDue() ? `; the next review is ${new Date(understanding.nextDue()!).toLocaleDateString(undefined, { weekday: "long" })}` : ""}.</p>{/if}
      </div>
      {#if marking.length}
        <div class="mblock waiting-marking">
          <div class="kind-row"><span class="kind">Waiting for marking</span><span class="caption">{marking.length}</span></div>
          <ul>{#each marking.slice(0, 6) as a (a.id)}<li><a href={conceptHref(a.exercise)}>{title(a.exercise)}</a><span class="caption">{a.result === null ? "answer" : "working"}</span></li>{/each}</ul>
          <p class="caption mblock-empty">An agent marks them next time you ask to be taught or tested, or you can mark one yourself on its page.</p>
        </div>
      {/if}
      <div class="mblock">
        <div class="kind-row"><span class="kind">Changed since you looked</span><span class="caption">{changed.length} {changed.length === 1 ? "note" : "notes"}</span></div>
        {#if changed.length}
          <ul>{#each changed.slice(0, 6) as { c } (c.id)}<li><a href={conceptHref(c.id)}>{c.title}</a></li>{/each}</ul>
        {:else}<p class="caption mblock-empty">Nothing you have looked at has changed.</p>{/if}
      </div>
      {#if next}
        <aside class={["pin", "pin-" + next.pen, "today-pin"]} bind:this={pin} style:margin-top="{pinTop}px">
          <div class="pin-head"><b>The teacher’s next step</b></div>
          {#if next.about && store.concepts.has(next.about)}<div class="pin-quote"><span>{store.concepts.get(next.about)?.type === "Exercise" ? stateOf(next.about) : title(next.about)}</span></div>{/if}
          <Prose html={render(next.text)} />
        </aside>
      {/if}
      {#if goals.length}
        <div class="mblock goals">
          <div class="kind-row"><span class="kind">Goals</span></div>
          <ul>
            {#each goals as g (g.id)}
              {@const ex = exercisesFor(g.id)}
              {@const p = progressOf(g)}
              <li><a href={conceptHref(g.id)}>{g.title}</a><span class="caption">{ex.length ? (p.met ? "met" : `${p.exercises.filter((e) => e.status === "passed").length} of ${ex.length}`) : "none yet"}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
      <p class="caption mblock-more"><a href="#/learn">Where you stand, tours and reading order</a></p>
    </aside>
  {/if}
</div>
