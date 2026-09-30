<script lang="ts">
  import KnowledgeLayout from "./KnowledgeLayout.svelte";

  let { what }: { what: string } = $props();
</script>

<KnowledgeLayout current={null}>
  <article class="doc">
    <header class="doc-head"><p class="doc-kind">Not found</p><h1>{what}</h1></header>
    <div class="prose"><p>Nothing is written here yet. The link may point at knowledge that has not been recorded, or the file was moved.</p></div>
  </article>
</KnowledgeLayout>
