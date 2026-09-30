<script lang="ts">
  // One frontmatter value, readably: lists as chips, {by, at} events as who
  // over when, links as links, times as local times.
  import { fmtDateTime } from "$lib/format.ts";
  import FmValue from "./FmValue.svelte";

  let { value }: { value: unknown } = $props();

  const scalar = (v: unknown) => typeof v !== "object" || v === null;
  const isEvent = (v: object) => "by" in v && Object.keys(v).every((k) => k === "by" || k === "at");
</script>

{#if value === null || value === undefined}
  <!-- nothing -->
{:else if Array.isArray(value)}
  {#if value.every(scalar)}
    <span>{#each value as v, i (i)}<span class="chip">{String(v)}</span>{/each}</span>
  {:else}
    <ul>{#each value as v, i (i)}<li><FmValue value={v} /></li>{/each}</ul>
  {/if}
{:else if typeof value === "object"}
  {#if isEvent(value)}
    {@const e = value as { by: unknown; at?: string }}
    <span>{String(e.by)}{#if e.at}<span class="sub">{fmtDateTime(e.at)}</span>{/if}</span>
  {:else}
    <ul>{#each Object.entries(value) as [k, v] (k)}<li><span class="sub">{k}</span><FmValue value={v} /></li>{/each}</ul>
  {/if}
{:else if /^https?:\/\//.test(String(value))}
  <a href={String(value)} target="_blank" rel="noopener">{String(value)}</a>
{:else if /^\d{4}-\d{2}-\d{2}T/.test(String(value))}
  <span title={String(value)}>{fmtDateTime(String(value))}</span>
{:else}
  {String(value)}
{/if}
