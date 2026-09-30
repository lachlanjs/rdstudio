<script lang="ts">
  import type { ConceptRecord } from "@rdstudio/core";
  import { TRUST_LABEL, trustState } from "$lib/format.ts";

  let { c }: { c: ConceptRecord } = $props();
  const state = $derived(trustState(c));
</script>

<span class="trust {state}"><span class="dot {state}"></span>{TRUST_LABEL[state]}</span>
