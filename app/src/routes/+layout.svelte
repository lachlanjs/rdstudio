<script lang="ts">
  // The shell (T53): the project and its mode, the four spaces (Today,
  // Library, Atlas, Practice), Project as the quiet link, the command palette
  // and the You menu; then the page. See knowledge/design/redesign.md.
  import "../app.css";
  import "katex/dist/katex.min.css";
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import { store, learner } from "$lib/data.svelte.ts";
  import { editing } from "$lib/edit.svelte.ts";
  import ActionDialogs from "$lib/components/ActionDialogs.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import { reviewCount } from "$lib/review.ts";
  import { setCount } from "$lib/exercises.ts";
  import { MODES, settings } from "$lib/settings.svelte.ts";
  import { palette, projectMode } from "$lib/shell.svelte.ts";
  import { teacher } from "$lib/teacher.svelte.ts";

  let { children }: { children: Snippet } = $props();

  // Which space a route belongs to.
  const SPACES: Record<string, string> = {
    "/": "today",
    "/library": "library", "/d/[...id]": "library", "/k/[...id]": "library",
    "/map/[...focus]": "atlas", "/path/[...id]": "atlas", "/graph": "atlas", "/tour/[...id]": "atlas", "/tours/[...name]": "atlas",
    "/practice/[...rest]": "practice", "/learn": "practice",
    "/project": "project", "/changes": "project", "/review": "project", "/reports": "project", "/r/[...path]": "project",
    "/procedures": "project", "/p/[...id]": "project", "/skills": "project", "/skill/[...name]": "project", "/agent/[...name]": "project",
    "/teacher/[...rest]": "you", "/settings": "you",
  };
  const space = $derived(SPACES[page.route.id ?? ""] ?? "library");
  const review = $derived(store.loaded ? reviewCount() : 0);
  const setForYou = $derived(store.loaded ? setCount() : 0);
  const mode = $derived(projectMode());
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  let drawer = $state(false);
  let you = $state(false);
  let fullscreen = $state(false);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled && !matchMedia("(display-mode: fullscreen)").matches;

  afterNavigate(() => { drawer = false; you = false; });
  // The drawer's styles hang off the body (the page behind it dims).
  $effect(() => { document.body.classList.toggle("drawer-open", drawer); });
  $effect(() => store.watch()); // live updates, stopped if the shell ever goes away
  $effect(() => { if (!store.site.static && !teacher.loaded) void teacher.load(); });

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  }
  const LIVE: Record<string, string> = { live: "Live: the page refreshes when files change", offline: "Offline: showing what was last loaded", static: "An exported snapshot", signin: "The server asks you to sign in again" };
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") { drawer = false; you = false; } }} />
<svelte:document onfullscreenchange={() => (fullscreen = Boolean(document.fullscreenElement))} />

<header class="bar" data-live={store.live}>
  <button class="menu" type="button" aria-label="Show contents" aria-expanded={drawer} hidden={space !== "library"} onclick={() => (drawer = !drawer)}>
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
  </button>
  <a class="brand" href="#/">rdstudio</a>
  <span class="project-name" title={store.site.title}>{store.site.title}</span>
  {#if mode}<span class="mode-tag" title={mode === "Learning" ? "A learning project: the learning layer leads" : "A project: its upkeep leads, the learning layer sits on top"}>{mode}</span>{/if}
  <nav class="tabs" aria-label="Spaces">
    {#snippet link(id: string, href: string, label: string, count?: number)}
      <a {href} data-tab={id} aria-current={space === id ? "page" : undefined}>{label}{#if count}<span class="count"> {count}</span>{/if}</a>
    {/snippet}
    {@render link("today", "#/", "Today", setForYou)}
    {@render link("library", "#/library", "Library")}
    {@render link("atlas", "#/map", "Atlas")}
    {@render link("practice", "#/practice", "Practice")}
  </nav>
  <span class="bar-end">
    {#if store.live === "signin"}
      <!-- The server (a dev tunnel, a proxy) wants you to sign in again: a page
           load with ?signin goes past the offline copy to the sign-in page. -->
      <a class="live offline signin" href="./?signin" data-sveltekit-reload title="The server asks you to sign in again; until then this page cannot update or save">Sign in</a>
    {:else if store.live === "offline"}
      <span class="live offline" title={LIVE.offline}>Offline</span>
    {/if}
    <a class="quiet-link" href="#/project" data-tab="project" aria-current={space === "project" ? "page" : undefined}>Project{#if review}<span class="count"> {review}</span>{/if}</a>
    <button class="palette-box" type="button" onclick={() => (palette.open = true)} aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
      <span class="palette-text">Jump to a note or action</span><kbd>{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
    <span class="you">
      <button class="you-button" type="button" aria-haspopup="menu" aria-expanded={you} aria-current={space === "you" ? "page" : undefined} onclick={() => (you = !you)}>You <span aria-hidden="true">▾</span></button>
      {#if you}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it too) -->
        <div class="you-scrim" onclick={() => (you = false)}></div>
        <div class="you-menu" role="menu" aria-label="You">
          <a role="menuitem" class="you-project" href="#/project">Project<span>changes, review, reports, procedures, skills</span></a>
          <a role="menuitem" href="#/teacher">Teacher<span>how the agent teaches you, and what it knows of you</span></a>
          <a role="menuitem" href="#/settings">Settings</a>
          <div class="you-row" role="group" aria-label="Light or dark">
            {#each MODES as [id, label] (id)}
              <button type="button" role="menuitemradio" aria-checked={settings.mode === id} onclick={() => settings.setMode(id)}>{label}</button>
            {/each}
          </div>
          {#if canFullscreen}<button role="menuitem" type="button" onclick={() => { you = false; toggleFullscreen(); }}>{fullscreen ? "Leave full screen" : "Full screen"}</button>{/if}
          <p class="you-status">{LIVE[store.live] ?? ""}{#if !store.site.static} · learner record {learner.enabled ? "on" : "off"}{/if}</p>
        </div>
      {/if}
    </span>
  </span>
</header>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape closes it too) -->
<div class="scrim" onclick={() => (drawer = false)}></div>
<main id="view" tabindex="-1">
  {@render children()}
</main>
{#if editing.enabled}<ActionDialogs />{/if}
<CommandPalette />
