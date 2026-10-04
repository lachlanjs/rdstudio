<script lang="ts">
  // Streaks (T48): recall, new learning, problem solving and all three, by day
  // and by week, with reprieves earned by keeping a streak. Worked out from the
  // learner record (@rdstudio/core/learning), so every device agrees.
  import { isStudyNote, streaks, weekOf, type DayStatus, type Streak, type StreakKind } from "@rdstudio/core/learning";
  import { learner, store } from "$lib/data.svelte.ts";
  import { understanding } from "$lib/understanding.svelte.ts";

  const DAY = 86_400_000, SHIFT = 4 * 3_600_000;
  /** Local days, starting at 4 a.m., numbered as days since 1970-01-01. */
  const dayOf = (ms: number) => { const d = new Date(ms - SHIFT); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
  const dayStart = (n: number) => { const u = new Date(n * DAY); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 4).getTime(); };
  const dateOf = (n: number) => new Date(n * DAY).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  const now = Date.now();
  const all = $derived(streaks(learner.events, [...store.concepts.values()].filter(isStudyNote), now, { dayOf, dayStart, weekDays: learner.weekDays }));
  const NAMES: Record<StreakKind, string> = { all: "All three", recall: "Recall", learning: "New learning", problems: "Problem solving" };
  const WHAT: Record<StreakKind, string> = {
    all: "Recall, new learning and problem solving, the same day.",
    recall: "Practising the notes due for review. With nothing due, the day rests.",
    learning: "A note newly worked through or understood.",
    problems: "An exercise answered (giving up does not count).",
  };
  const TODAY: Record<DayStatus, string> = { done: "Done today", rest: "Nothing due today", reprieve: "", missed: "", open: "Not yet today" };
  const ORDER: StreakKind[] = ["all", "recall", "learning", "problems"];
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const weeks = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;

  // The last five weeks of "all three", Monday first.
  const calendar = $derived.by(() => {
    const s = all.all, today = dayOf(now);
    const byDay = new Map(s.days.map((d) => [d.day, d.status]));
    const firstMonday = (weekOf(today) - 4) * 7 - 3;
    return Array.from({ length: 35 }, (_, i) => {
      const day = firstMonday + i;
      return { day, status: day > today ? "future" : byDay.get(day) ?? "none", today: day === today };
    });
  });
  const LEGEND: [string, string][] = [["done", "Counted"], ["reprieve", "Reprieve used"], ["missed", "Missed"], ["none", "Before you started"]];
  const load = $derived(understanding.loadNote());
</script>

{#snippet tile(s: Streak)}
  <div class={["streak", "streak-" + s.kind, s.today === "done" || s.today === "rest" ? "kept" : "at-risk"]}>
    <p class="streak-name" title={WHAT[s.kind]}>{NAMES[s.kind]}</p>
    <p class="streak-count"><span>{s.current}</span> {s.current === 1 ? "day" : "days"}</p>
    <p class="streak-today">{TODAY[s.today]}</p>
    <p class="streak-more">This week {Math.min(s.weeks.thisWeek, learner.weekDays)} of {learner.weekDays} days{s.weeks.current ? ` · ${weeks(s.weeks.current)} in a row` : ""}</p>
    <p class="streak-more">Best {days(s.best)}{s.reprieves ? ` · ${s.reprieves} ${s.reprieves === 1 ? "reprieve" : "reprieves"} banked` : ""}</p>
  </div>
{/snippet}

<section class="streaks" aria-label="Streaks">
  <div class="streak-tiles">{#each ORDER as k (k)}{@render tile(all[k])}{/each}</div>
  {#if load}<p class="section-note">Your streaks are safe for today: a break now will do more for what you have learnt than more of it.</p>{/if}
  <details class="streak-more-info">
    <summary>The last five weeks</summary>
    <div class="streak-calendar" role="img" aria-label="Days on which all three counted, over the last five weeks">
      {#each ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as d (d)}<span class="cal-head">{d}</span>{/each}
      {#each calendar as c (c.day)}<span class={["cal-day", "cal-" + c.status, c.today && "cal-today"]} title={`${dateOf(c.day)}: ${c.status === "future" ? "" : c.status === "done" ? "all three" : c.status === "open" ? "not yet" : c.status}`}></span>{/each}
    </div>
    <p class="cal-legend">{#each LEGEND as [k, label] (k)}<span><i class={"cal-day cal-" + k}></i>{label}</span>{/each}</p>
    <p class="section-note">A day starts at 4 a.m. A week counts with {learner.weekDays} days kept. Every {7} days kept earns a reprieve (two at most), used by itself on a day you miss.</p>
  </details>
</section>
