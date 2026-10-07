<script lang="ts">
  // Rendered Markdown: in-page anchors scroll, and Mermaid diagrams are drawn
  // once the HTML is in the page.
  import { renderDiagrams } from "$lib/diagrams.ts";
  import { mountEmbeds } from "$lib/artifactFrame.ts";
  import { wireAnchors } from "$lib/markdown.ts";

  let { html, class: cls = "prose" }: { html: string; class?: string } = $props();

  function enhance(node: HTMLElement) {
    void html; // redraw diagrams whenever the content changes
    void renderDiagrams(node);
    const unmount = mountEmbeds(node), unwire = wireAnchors(node);
    return () => { unmount(); unwire(); };
  }
</script>

<!-- html is rendered Markdown, sanitised by render() in markdown.ts -->
<div class={cls} {@attach enhance}>{@html html}</div>
