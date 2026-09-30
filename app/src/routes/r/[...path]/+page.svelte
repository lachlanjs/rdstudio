<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref, fmtDate } from "$lib/format.ts";

  const path = $derived(page.params.path ?? "");
  const r = $derived(store.reports.find((x) => x.path === path));
  const src = $derived("reports/" + path.split("/").map(encodeURIComponent).join("/"));

  // Knowledge links inside a report open in the dashboard.
  function wire(frame: HTMLIFrameElement) {
    const onLoad = () => {
      try {
        frame.contentDocument?.addEventListener("click", (event) => {
          const a = (event.target as Element | null)?.closest("a[href]");
          if (!a) return;
          const href = a.getAttribute("href") ?? "";
          const k = "/" + store.site.knowledge + "/";
          let id: string | null = null;
          if (href.startsWith("#/k/")) id = href.slice(4);
          else if (href.startsWith(k) && href.endsWith(".md")) id = href.slice(k.length, -3);
          else if (href.includes(store.site.knowledge + "/") && href.endsWith(".md")) id = href.split(store.site.knowledge + "/").pop()!.slice(0, -3);
          if (id) {
            event.preventDefault();
            void goto(conceptHref(decodeURIComponent(id)));
          }
        });
      } catch { /* cross-origin: leave links alone */ }
    };
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }
</script>

<svelte:head><title>{r ? r.title : path} · {store.site.title}</title></svelte:head>

<div class="report-frame-wrap">
  <div class="report-bar">
    <a href="#/reports">All reports</a>
    <strong>{r ? r.title : path}</strong>
    {#if r}<span>{fmtDate(r.date)}</span>{/if}
    <a href={src} target="_blank" rel="noopener" style="margin-left:auto">Open on its own</a>
  </div>
  <iframe class="report-frame" {src} title={r ? r.title : path} {@attach wire}></iframe>
</div>
