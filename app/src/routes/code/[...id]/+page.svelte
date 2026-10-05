<script lang="ts">
  // A code item's page (T66): what it is and where, its signature and
  // documentation, what it holds, its links in and out by kind, the notes
  // attached to it, its source, and when it last changed.
  import { page } from "$app/state";
  import type { CodeItem } from "@rdstudio/core";
  import Missing from "$lib/components/Missing.svelte";
  import Prose from "$lib/components/Prose.svelte";
  import { codeHref, codeId, codeMap, healthOf, KIND_LABEL, LINK_LABEL, type LinkKind } from "$lib/code.ts";
  import { store } from "$lib/data.svelte.ts";
  import { conceptHref } from "$lib/format.ts";
  import { render } from "$lib/markdown.ts";

  const id = $derived(codeId(page.params.id ?? ""));
  const map = $derived(codeMap());
  const item = $derived(map?.byId.get(id) ?? null);
  const trail = $derived.by(() => {
    const out: CodeItem[] = [];
    for (let p = item?.parent ? map?.byId.get(item.parent) : null; p; p = p.parent ? map!.byId.get(p.parent) : null) out.unshift(p);
    return out;
  });
  const kids = $derived(item ? (map?.children.get(item.id) ?? []) : []);
  const FENCE: Record<string, string> = { python: "python", cpp: "cpp", cmake: "cmake", yaml: "yaml", toml: "toml" };
  const fence = (lang: string, text: string) => render("```" + (FENCE[lang] ?? "") + "\n" + text.replace(/```/g, "ˋˋˋ") + "\n```", { dir: "" });
  // Links by kind, each end read from this item: [label, items].
  const groups = $derived.by(() => {
    if (!item || !map) return [] as [string, CodeItem[]][];
    const out = new Map<string, CodeItem[]>();
    const add = (label: string, other: string) => { const o = map.byId.get(other); if (o) (out.get(label) ?? out.set(label, []).get(label)!).push(o); };
    for (const [, to, kind] of map.out.get(item.id) ?? []) add(LINK_LABEL[kind as LinkKind][0], to);
    for (const [from, , kind] of map.into.get(item.id) ?? []) add(LINK_LABEL[kind as LinkKind][1], from);
    return [...out];
  });
  const notes = $derived(item ? (map?.notes.get(item.id) ?? []) : []);
  const last = $derived(item ? store.changes.commits.find((c) => c.files.some((f) => f.path === item.path)) ?? null : null);
  const health = $derived(item && map ? healthOf(map, item) : 0);
  const where = (i: CodeItem) => (i.kind === "dir" || i.kind === "file" ? i.path : `${i.path}:${i.line}`);
</script>

<svelte:head><title>{item?.name ?? "Code"} · {store.site.title}</title></svelte:head>

{#if !store.loaded}
  <div class="page"></div>
{:else if !item}
  <Missing what={id || "Code"} />
{:else}
  <div class="page code-page">
    <p class="doc-path caption">
      <a href="#/map">Code</a>{#each trail as t (t.id)}<span class="sep"> / </span><a href={codeHref(t.id)}>{t.name}</a>{/each}
    </p>
    <h1>{item.name} <span class="chip">{KIND_LABEL[item.kind]}</span></h1>
    <p class="caption">
      {where(item)}{#if item.bound} · bound to Python as <code>{item.bound}</code>{/if}
      {#if item.declaration} · declared in <a href={codeHref(item.declaration)}>{map?.byId.get(item.declaration)?.path}</a>{/if}
      · health {health} of 3{#if last} · last changed {new Date(last.date || Date.now()).toLocaleDateString()} ({last.subject}){/if}
    </p>
    {#if item.doc}<div class="code-doc"><Prose html={render(item.doc, { dir: "" })} /></div>{/if}
    {#if item.signature && item.kind !== "file" && item.kind !== "dir"}<div class="code-sig"><Prose html={fence(item.lang, item.signature)} /></div>{/if}

    {#if notes.length}
      <h2 class="section-h">Notes about it</h2>
      <ul class="rows">{#each notes as c (c.id)}<li><a class="title" href={conceptHref(c.id)}>{c.title}</a><div class="desc">{c.description}</div></li>{/each}</ul>
    {/if}

    {#if kids.length}
      <h2 class="section-h">{item.kind === "dir" ? "Holds" : "Defines"}</h2>
      <ul class="rows code-kids">{#each kids as k (k.id)}<li><a class="title" href={codeHref(k.id)}>{k.name}</a> <span class="caption">{KIND_LABEL[k.kind]}{k.kind !== "dir" && k.kind !== "file" ? ` · line ${k.line}` : ""}</span>{#if k.doc}<div class="desc">{k.doc.split("\n")[0]}</div>{/if}</li>{/each}</ul>
    {/if}

    {#if groups.length}
      <h2 class="section-h">Links</h2>
      <dl class="code-links">
        {#each groups as [label, list] (label)}
          <dt>{label}</dt>
          <dd>{#each list as o, n (o.id + n)}{#if n}<span class="sep">, </span>{/if}<a href={codeHref(o.id)} title={where(o)}>{o.kind === "file" || o.kind === "dir" ? o.path : o.qual.split(o.lang === "cpp" ? "::" : ".").slice(-2).join(o.lang === "cpp" ? "::" : ".")}</a>{/each}</dd>
        {/each}
      </dl>
    {/if}

    {#if item.src}
      <h2 class="section-h">Source</h2>
      <div class="code-src"><Prose html={fence(item.lang, item.src)} /></div>
    {/if}
  </div>
{/if}

<style>
  .code-page h1 .chip { font-size: 12px; vertical-align: middle; }
  .code-links { display: grid; grid-template-columns: max-content 1fr; gap: 6px 18px; margin: 0; }
  .code-links dt { color: var(--text-soft); font-size: 13px; }
  .code-links dd { margin: 0; }
  .code-links .sep, .doc-path .sep { white-space: pre; }
  .code-doc { max-width: 72ch; }
</style>
