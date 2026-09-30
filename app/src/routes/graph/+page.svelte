<script lang="ts">
  import Imperative from "$lib/components/Imperative.svelte";
  import { graphView, leaveGraph } from "$lib/views/graph.js";
</script>

<Imperative make={graphView} leave={leaveGraph} />
