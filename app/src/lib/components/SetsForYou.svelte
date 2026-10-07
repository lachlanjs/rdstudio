<script lang="ts">
  // What the teacher set for you, on Today in either mode (T54, T59): each set
  // with its exercises as whole-row targets, and in one column the teacher's
  // next step hanging under the row it is about.
  import type { Assignment } from "@rdstudio/core/learning";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";
  import type { Shown } from "$lib/exercises.ts";
  import type { NextStep } from "$lib/teacher.svelte.ts";
  import { store } from "$lib/data.svelte.ts";
  import Prose from "./Prose.svelte";

  let { sets, next, stateOf }: { sets: Assignment[]; next: NextStep | null; stateOf: (id: string) => Shown } = $props();

  const CLASS: Record<Shown, string> = { passed: "st-pass", missed: "st-miss", "in progress": "st-prog", "not tried": "st-none" };
  const title = (id: string) => store.concepts.get(id)?.title ?? id;
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const setHead = (note: string) => {
    const i = note.indexOf(":");
    const desc = i > 0 ? note.slice(i + 1).trim() : "";
    return [i > 0 ? note.slice(0, i) : note, desc.charAt(0).toUpperCase() + desc.slice(1)];
  };
</script>

{#each sets as set (set.id)}
  {@const [head, desc] = setHead(set.note)}
  <section class="sec">
    <div class="sec-head"><span class="kind">Set for you</span><span class="caption">{set.done.length} of {set.exercises.length} answered · set {fmtDay(set.at)} by Axis</span></div>
    <h2>{head}</h2>
    {#if desc}<p class="desc">{desc}</p>{/if}
    <ol class="ex">
      {#each set.exercises as x, i (x)}
        {@const s = stateOf(x)}
        <li data-row={x} class={s === "not tried" ? "none" : ""}>
          <span class="n">{i + 1}</span><a class="t" href={conceptHref(x)}>{title(x)}</a><span class={["st", CLASS[s]]}>{s}</span>
        </li>
        {#if next && next.about === x}
          <!-- In one column the next step hangs under its row by a stem (in two, it is in the margin). -->
          <li class="next-inline">
            <aside class={["pin", "pin-" + next.pen]}><div class="pin-head"><b>Axis’s next step</b></div><Prose html={render(next.text)} /></aside>
          </li>
        {/if}
      {/each}
    </ol>
  </section>
{/each}
