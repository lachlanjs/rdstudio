<script lang="ts">
  // A page not yet ported to the new dashboard (T38): open it in the current one.
  let { name }: { name: string } = $props();
</script>

<div class="page">
  <h1>{name}</h1>
  <p class="lede">This page is not in the new dashboard yet. The current dashboard (<code>rdstudio serve</code>) has it.</p>
</div>
