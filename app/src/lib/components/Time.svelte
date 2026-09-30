<script lang="ts">
  import { fmtDate, fmtDateTime, relTime } from "$lib/format.ts";

  let { iso, rel = true }: { iso: string | null | undefined; rel?: boolean } = $props();
</script>

{#if iso}<time datetime={iso} title={fmtDateTime(iso)}>{rel ? relTime(iso) : fmtDate(iso)}</time>{/if}
