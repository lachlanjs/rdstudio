<script lang="ts">
  // The command palette (T53): ⌘K or Ctrl+K, or the box in the top bar. Jump
  // to any note, or do anything the app does, by typing a few letters of it.
  // With nothing typed it offers the spaces and the notes you opened last.
  import { goto } from "$app/navigation";
  import { tick } from "svelte";
  import { actions } from "$lib/actions.svelte.ts";
  import { learner, store } from "$lib/data.svelte.ts";
  import { editing } from "$lib/edit.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { settings } from "$lib/settings.svelte.ts";
  import { palette } from "$lib/shell.svelte.ts";

  interface Item { id: string; kind: "note" | "action"; label: string; detail: string; run: () => void }

  const go = (href: string) => () => { void goto(href); };
  const ACTIONS = (): Item[] => [
    ["Today", "#/", "What to do now"], ["Library", "#/library", "Notes and folders"], ["Atlas", "#/map", "The map of the knowledge base"],
    ["Practice", "#/practice", "Goals, exercises and drills"], ["Project", "#/project", "Changes, review, artifacts, procedures, skills"],
    ["Changes", "#/changes", "What changed, from git"], ["Review", "#/review", "What waits for your review"], ["Artifacts", "#/artifacts", "Interactive pages kept beside the notes"],
    ["Procedures", "#/procedures", "Recorded procedures"], ["Skills and agents", "#/skills", "What agents can do here"],
    ["Graph", "#/graph", "Every note and link"], ["Axis", "#/teacher", "The agent: how it teaches and helps here, and what it knows of you"],
    ["Settings", "#/settings", "Light or dark, the graph"], ["Practise recall", "#/practice/recall", "A round of recall, reviews due first"],
  ].map(([label, href, detail]) => ({ id: "go:" + href, kind: "action" as const, label: label!, detail: detail!, run: go(href!) }))
    .concat(editing.enabled ? [
      { id: "new-note", kind: "action", label: "New note", detail: "At the top level", run: () => actions.open({ kind: "new-note", folder: "" }) },
      { id: "new-folder", kind: "action", label: "New folder", detail: "At the top level", run: () => actions.open({ kind: "new-folder", folder: "" }) },
    ] : [])
    .concat([{ id: "mode", kind: "action", label: settings.mode === "light" ? "Switch to dark" : "Switch to light", detail: "Light or dark",
      run: () => settings.setMode(settings.mode === "light" ? "dark" : "light") }]);

  const notes = (): Item[] => [...store.concepts.values()].map((c) => ({
    id: "note:" + c.id, kind: "note" as const, label: c.title, detail: [c.type, c.directory].filter(Boolean).join(" · "), run: go(conceptHref(c.id)),
  }));

  /** How well `q` matches `text`: its letters in order, scoring runs, word starts and an early start. */
  function score(q: string, text: string): number {
    const t = text.toLowerCase();
    if (!q) return 1;
    const at = t.indexOf(q);
    if (at >= 0) return 100 - Math.min(at, 50) + (at === 0 || /\W/.test(t[at - 1] ?? "") ? 30 : 0);
    let s = 0, i = 0, run = 0;
    for (const ch of q) {
      const j = t.indexOf(ch, i);
      if (j < 0) return 0;
      run = j === i ? run + 1 : 0;
      s += 1 + run * 2 + (j === 0 || /\W/.test(t[j - 1] ?? "") ? 3 : 0);
      i = j + 1;
    }
    return s;
  }

  let query = $state("");
  let active = $state(0);
  let input = $state<HTMLInputElement>();

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Recent notes (from your record), then the actions.
      const seen = learner.events.filter((e) => e.event === "seen" && typeof e.concept === "string").map((e) => String(e.concept));
      const recent = [...new Set(seen.reverse())].map((id) => store.concepts.get(id)).filter((c) => !!c).slice(0, 5)
        .map((c) => ({ id: "note:" + c!.id, kind: "note" as const, label: c!.title, detail: "Opened recently", run: go(conceptHref(c!.id)) }));
      return [...recent, ...ACTIONS()];
    }
    return [...ACTIONS(), ...notes()]
      // Letters in order count only in the name; a description counts when it holds what was typed.
      .map((it) => ({ it, s: Math.max(score(q, it.label), it.detail.toLowerCase().includes(q) ? 20 : 0) }))
      .filter((x) => x.s > 0).map((x) => ({ ...x, s: x.s + (x.it.kind === "action" ? 5 : 0) })).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.it);
  });

  $effect(() => {
    if (palette.open) { query = ""; active = 0; void tick().then(() => input?.focus()); }
  });
  $effect(() => { void query; active = 0; });

  function choose(it: Item | undefined) {
    if (!it) return;
    palette.open = false;
    it.run();
  }
  function keys(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(results.length - 1, active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") { e.preventDefault(); palette.open = false; }
  }
</script>

<svelte:window onkeydown={(e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.open = !palette.open; }
}} />

{#if palette.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it too) -->
  <div class="palette-scrim" onclick={() => (palette.open = false)}></div>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Jump to a note or action">
    <input bind:this={input} bind:value={query} onkeydown={keys} placeholder="Jump to a note or action" aria-label="Jump to a note or action"
      role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[active] ? "pal-" + active : undefined} autocomplete="off" spellcheck="false" />
    <ul id="palette-list" role="listbox" aria-label="Results">
      {#each results as it, i (it.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events (the input handles keys) -->
        <li id={"pal-" + i} role="option" aria-selected={i === active} class={[it.kind, i === active && "active"]}
          onclick={() => choose(it)} onmousemove={() => (active = i)}>
          <span class="pal-label">{it.label}</span><span class="pal-detail">{it.detail}</span>
        </li>
      {:else}
        <li class="pal-none" role="presentation">Nothing matches "{query}".</li>
      {/each}
    </ul>
    <p class="pal-keys">↑↓ to choose · Enter to go · Esc to close</p>
  </div>
{/if}
