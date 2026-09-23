// Knowledge tab: directory tree, concept and directory pages, frontmatter panel.

import { store, body } from "./data.js";
import { render, wireAnchors } from "./markdown.js";
import { h, conceptHref, dirHref, trustState, trustBadge, timeEl, titleCase, fmtDateTime } from "./util.js";

const openDirs = new Set(JSON.parse(sessionStorage.getItem("rdstudio.openDirs") || "[]"));
let filterText = "";

function saveOpenDirs() {
  try { sessionStorage.setItem("rdstudio.openDirs", JSON.stringify([...openDirs])); } catch { /* private mode */ }
}

function dirLabel(id) {
  if (!id) return store.site.title || "Knowledge";
  const name = id.split("/").pop();
  return titleCase(name.replace(/[-_]/g, " "));
}

// ------------------------------------------------------------------ tree

function matches(c) {
  if (!filterText) return true;
  const q = filterText.toLowerCase();
  return [c.title, c.description, c.type, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
}

function dirHasMatch(id) {
  const d = store.tree[id];
  if (!d) return false;
  return d.concepts.some((cid) => matches(store.concepts.get(cid))) || d.children.some(dirHasMatch);
}

function treeList(id, current) {
  const d = store.tree[id];
  const items = [];
  for (const child of d.children) {
    if (filterText && !dirHasMatch(child)) continue;
    const open = filterText ? true : openDirs.has(child) || (current && (current + "/").startsWith(child + "/"));
    const details = h("details", { open },
      h("summary", { class: `dir${current === child ? " current" : ""}` },
        h("svg:svg", { class: "twisty", width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": "true" },
          h("svg:path", { d: "M4 2l4 4-4 4", fill: "none", stroke: "currentColor", "stroke-width": 1.6 })),
        h("a", { href: dirHref(child) }, dirLabel(child))),
      treeList(child, current));
    details.addEventListener("toggle", () => {
      if (filterText) return;
      details.open ? openDirs.add(child) : openDirs.delete(child);
      saveOpenDirs();
    });
    items.push(h("li", {}, details));
  }
  for (const cid of d.concepts) {
    const c = store.concepts.get(cid);
    if (!c || !matches(c) || (cid === d.overview && !filterText)) continue;
    items.push(h("li", { class: "item" },
      h("a", { href: conceptHref(cid), "aria-current": current === "k:" + cid ? "page" : null, title: c.description || c.title },
        h("span", { class: `dot ${trustState(c)}` }), h("span", {}, c.title))));
  }
  return h("ul", {}, items);
}

function renderTree(aside, current) {
  const input = h("input", {
    class: "filter", type: "search", placeholder: "Filter by title, type or tag", value: filterText,
    "aria-label": "Filter knowledge",
  });
  const list = h("div");
  const draw = () => list.replaceChildren(
    h("a", { class: "root-link", href: "#/" }, dirLabel("")),
    treeList("", current));
  input.addEventListener("input", () => { filterText = input.value.trim(); draw(); });
  aside.replaceChildren(input, list);
  draw();
}

// ------------------------------------------------------------ frontmatter

const HIDDEN_KEYS = new Set(["title", "description"]);

function fmValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return h("span", {}, value.map((v) => h("span", { class: "chip" }, String(v))));
    }
    return h("ul", {}, value.map((v) => h("li", {}, fmValue(v))));
  }
  if (typeof value === "object") {
    // Actor events ({by, at}) read best as "who" over "when".
    if ("by" in value && Object.keys(value).every((k) => k === "by" || k === "at")) {
      return h("span", {}, String(value.by), value.at ? h("span", { class: "sub" }, fmtDateTime(value.at)) : "");
    }
    return h("ul", {}, Object.entries(value).map(([k, v]) => h("li", {}, h("span", { class: "sub" }, k), fmValue(v))));
  }
  const s = String(value);
  if (/^https?:\/\//.test(s)) return h("a", { href: s, target: "_blank", rel: "noopener" }, s);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return h("span", { title: s }, fmtDateTime(s));
  return s;
}

function frontmatterTable(meta) {
  const rows = Object.entries(meta).filter(([k]) => !HIDDEN_KEYS.has(k));
  return h("table", { class: "fm" }, h("tbody", {}, rows.map(([k, v]) => h("tr", {}, h("th", { scope: "row" }, k), h("td", {}, fmValue(v))))));
}

function metaPanel(c) {
  const narrow = matchMedia("(max-width: 760px)").matches;
  const outline = c.headings.filter((x) => x.level <= 3);
  const back = c.backlinks.map((id) => store.concepts.get(id)).filter(Boolean);
  const out = c.links.filter((l) => l.kind === "concept" && !l.broken).map((l) => store.concepts.get(l.target)).filter(Boolean);
  const uniq = (list) => [...new Map(list.map((x) => [x.id, x])).values()];
  return h("aside", { class: "meta", "aria-label": "Details" },
    h("div", { class: "meta-inner" },
      h("h2", {}, "Trust"),
      trustBadge(c),
      c.verification_stale ? h("p", { class: "section-note" }, "Meaningfully edited after the last human review.") : "",
      h("details", { class: "fm-wrap", open: !narrow },
        h("summary", {}, "Frontmatter"),
        h("h2", {}, "Frontmatter"),
        frontmatterTable(c.meta)),
      outline.length > 1 ? [h("h2", {}, "On this page"),
        h("ul", { class: "outline" }, outline.map((x) => h("li", { class: `l${x.level}` },
          h("a", { href: "javascript:void(0)", "data-anchor": "h-" + x.slug }, x.text))))] : "",
      back.length ? [h("h2", {}, "Linked from"), linkList(uniq(back))] : "",
      out.length ? [h("h2", {}, "Links to"), linkList(uniq(out))] : ""));
}

function linkList(concepts) {
  return h("ul", { class: "linklist" }, concepts.map((c) => h("li", {}, h("a", { href: conceptHref(c.id) }, c.title))));
}

// ------------------------------------------------------------------ pages

function layout(current, main, meta) {
  const aside = h("aside", { class: "tree", "aria-label": "Contents" });
  renderTree(aside, current);
  const wrap = h("div", { class: `kn${meta ? "" : " no-meta"}` }, aside, main, meta || "");
  wireAnchors(wrap);
  return wrap;
}

export async function conceptView(id) {
  const c = store.concepts.get(id);
  if (!c) return missing(id);
  const text = await body(id);
  const article = h("article", { class: "doc" },
    h("header", { class: "doc-head" },
      h("p", { class: "doc-kind" },
        h("span", {}, c.type || "Concept"),
        c.status !== "stable" ? h("span", { class: "chip" }, c.status) : "",
        c.generated_at ? h("span", {}, "Updated ", timeEl(c.generated_at)) : ""),
      h("h1", {}, c.title),
      c.description ? h("p", { class: "description" }, c.description) : ""),
    h("div", { class: "prose", html: render(text, { dir: c.directory }) }));
  document.title = `${c.title} · ${store.site.title}`;
  return layout("k:" + id, article, metaPanel(c));
}

export async function dirView(id) {
  const d = store.tree[id];
  if (!d) return missing(id + "/");
  const parts = [];
  const overview = d.overview ? store.concepts.get(d.overview) : null;
  if (overview) {
    const text = await body(overview.id);
    parts.push(h("header", { class: "doc-head" },
      h("p", { class: "doc-kind" }, h("a", { href: conceptHref(overview.id) }, "Overview"), overview.generated_at ? h("span", {}, "Updated ", timeEl(overview.generated_at)) : ""),
      h("h1", {}, id ? dirLabel(id) : overview.title),
      overview.description ? h("p", { class: "description" }, overview.description) : ""));
    parts.push(h("div", { class: "prose" , html: render(text, { dir: overview.directory }) }));
    parts.push(h("hr"));
  } else {
    parts.push(h("header", { class: "doc-head" }, h("p", { class: "doc-kind" }, "Directory"), h("h1", {}, dirLabel(id))));
  }
  // The generated OKF index, minus its frontmatter.
  const index = d.index.replace(/^---\n[\s\S]*?\n---\n/, "");
  parts.push(h("div", { class: "prose index", html: render(index, { dir: id }) }));
  document.title = `${dirLabel(id)} · ${store.site.title}`;
  return layout(id, h("article", { class: "doc" }, parts), null);
}

function missing(what) {
  return layout(null, h("article", { class: "doc" },
    h("header", { class: "doc-head" }, h("p", { class: "doc-kind" }, "Not found"), h("h1", {}, what)),
    h("div", { class: "prose" }, h("p", {}, "Nothing is written here yet. The link may point at knowledge that has not been recorded, or the file was moved."))), null);
}
