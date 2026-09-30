<script lang="ts">
  // A note in a list: title, type, id, when it changed, and its description.
  import type { ConceptRecord } from "@rdstudio/core";
  import type { Snippet } from "svelte";
  import { conceptHref } from "$lib/format.ts";
  import Time from "./Time.svelte";

  let { c, extra }: { c: ConceptRecord; extra?: Snippet } = $props();
</script>

<li>
  <a class="title" href={conceptHref(c.id)}>{c.title}</a>
  <div class="sub">
    <span>{c.type || "Concept"}</span><span>{c.id}</span>
    {#if c.generated_at}<span>updated <Time iso={c.generated_at} /></span>{/if}
    {@render extra?.()}
  </div>
  {#if c.description}<div class="desc">{c.description}</div>{/if}
</li>
