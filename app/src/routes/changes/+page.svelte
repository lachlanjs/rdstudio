<script lang="ts">
  import type { ChangedFile, Commit } from "@rdstudio/core";
  import { SvelteSet } from "svelte/reactivity";
  import Time from "$lib/components/Time.svelte";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";

  const CATEGORY_LABEL: Record<string, string> = { knowledge: "Knowledge", code: "Code", reports: "Reports", agent: "Agent setup", other: "Other" };
  const STATUS_MARK: Record<string, string> = { added: "+", deleted: "−", modified: "~", renamed: "→", copied: "+" };

  function saved(): string[] {
    try { return JSON.parse(sessionStorage.getItem("rdstudio.hiddenCats") ?? "[]") as string[]; } catch { return []; }
  }
  const hidden = new SvelteSet<string>(saved());

  function toggle(k: string) {
    if (hidden.has(k)) hidden.delete(k);
    else hidden.add(k);
    try { sessionStorage.setItem("rdstudio.hiddenCats", JSON.stringify([...hidden])); } catch { /* ignore */ }
  }

  const ch = $derived(store.changes);
  const present = $derived(new Set(ch.commits.flatMap((c) => c.files.map((f) => f.category))));

  // A commit's files grouped by category, the known categories first; null when all are hidden.
  function groups(c: Commit): [string, ChangedFile[]][] | null {
    const g: Record<string, ChangedFile[]> = {};
    for (const f of c.files) (g[f.category] ??= []).push(f);
    const cats = Object.keys(g).filter((k) => !hidden.has(k));
    if (c.files.length && !cats.length) return null;
    return [...new Set([...Object.keys(CATEGORY_LABEL), ...Object.keys(g)])].filter((k) => cats.includes(k)).map((k) => [k, g[k]!]);
  }

  function link(f: ChangedFile): string | null {
    const k = store.site.knowledge + "/";
    if (f.status !== "deleted" && f.path.startsWith(k) && f.path.endsWith(".md")) {
      const id = f.path.slice(k.length, -3);
      if (store.concepts.has(id)) return conceptHref(id);
    }
    const r = store.site.reports + "/";
    if (f.status !== "deleted" && f.path.startsWith(r) && f.path.endsWith(".html")) return "#/r/" + f.path.slice(r.length);
    return null;
  }
</script>

<svelte:head><title>Changes · {store.site.title}</title></svelte:head>

<div class="page">
  <h1>Changes</h1>
  {#if !ch.available}
    <p class="lede">This project is not a git repository, so there is no history to show. Run git init to start tracking changes.</p>
  {:else}
    <p class="lede">Commits on {ch.branch}, newest first, with the files each one touched.</p>
    <div class="toggles" role="group" aria-label="Show categories">
      {#each Object.keys(CATEGORY_LABEL).filter((x) => present.has(x)) as k (k)}
        <button class="toggle" type="button" aria-pressed={!hidden.has(k)} onclick={() => toggle(k)}><span class="cat {k}">{CATEGORY_LABEL[k]}</span></button>
      {/each}
    </div>
    <ul class="rows" style="border-top:0">
      {#each ch.commits as c (c.hash || "pending")}
        {@const gs = groups(c)}
        {#if gs}
          <li class={["commit", c.pending && "pending"]}>
            <div class="commit-head">
              <span class="commit-subject">{c.subject}</span>
              <span class="commit-sub">
                {#if c.pending}Not committed yet{:else}<code>{c.short}</code>{"  "}{c.author}{"  "}<Time iso={c.date} />{/if}{#if c.merge}{"  "}merge{/if}
              </span>
            </div>
            {#if gs.length}
              <div class="filegroups">
                {#each gs as [k, files] (k)}
                  <div class="filegroup">
                    <span class="cat {k}">{CATEGORY_LABEL[k] ?? k}</span>
                    <ul class="files">
                      {#each files as f (f.path)}
                        {@const href = link(f)}
                        <li title="{f.status}: {f.path}"><span class="st {f.status}" aria-label={f.status}>{STATUS_MARK[f.status] ?? "~"}</span>{#if href}<a {href}>{f.path}</a>{:else}{f.path}{/if}</li>
                      {/each}
                    </ul>
                  </div>
                {/each}
              </div>
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>
