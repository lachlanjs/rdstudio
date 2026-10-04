<script lang="ts">
  // Today: the learning Today, or in project mode the project's (T59). It
  // waits for the teacher's state, which says which, so it does not flash.
  import ProjectToday from "$lib/components/ProjectToday.svelte";
  import TodayPage from "$lib/components/TodayPage.svelte";
  import { store } from "$lib/data.svelte.ts";
  import { projectMode } from "$lib/shell.svelte.ts";
  import { teacher } from "$lib/teacher.svelte.ts";
</script>

{#if store.site.static || teacher.loaded}
  {#if projectMode() === "Project"}<ProjectToday />{:else}<TodayPage />{/if}
{/if}
