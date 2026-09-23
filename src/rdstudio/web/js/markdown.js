// Markdown rendering: markdown-it + footnotes + KaTeX (texmath) + highlight.js,
// with OKF links rewritten to in-app routes.

import { conceptHref, dirHref } from "./util.js";
import { store } from "./data.js";

/* global markdownit, markdownitFootnote, texmath, katex, hljs */

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch { /* fall through */ }
    }
    return "";
  },
})
  .use(markdownitFootnote)
  .use(texmath, { engine: katex, delimiters: ["dollars", "brackets"], katexOptions: { throwOnError: false } });

// Heading ids for outline navigation.
export function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
}
md.core.ruler.push("heading_ids", (state) => {
  const seen = new Map();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "heading_open") continue;
    const text = tokens[i + 1]?.children?.map((t) => t.content).join("") ?? "";
    let slug = slugify(text) || "section";
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    if (n) slug += `-${n}`;
    tokens[i].attrSet("id", "h-" + slug);
  }
});

// Task-list checkboxes: "- [ ]" / "- [x]".
md.core.ruler.push("task_lists", (state) => {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "inline" || tokens[i - 1].type !== "paragraph_open" || tokens[i - 2].type !== "list_item_open") continue;
    const m = /^\[([ xX])\]\s/.exec(t.content);
    if (!m || !t.children?.length) continue;
    const first = t.children[0];
    first.content = first.content.replace(/^\[[ xX]\]\s/, "");
    const box = new state.Token("html_inline", "", 0);
    box.content = `<input type="checkbox" disabled${m[1] !== " " ? " checked" : ""}> `;
    t.children.unshift(box);
    tokens[i - 2].attrJoin("class", "task-item");
    for (let j = i - 3; j >= 0; j--) {
      if (tokens[j].type === "bullet_list_open" && tokens[j].level === tokens[i - 2].level - 1) {
        tokens[j].attrJoin("class", "contains-task-list");
        break;
      }
    }
  }
});

// Wrap tables so wide ones scroll on phones.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => "</table></div>";

function joinPath(dir, target) {
  const parts = (dir ? dir.split("/") : []).concat(target.split("/"));
  const out = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(p);
  }
  return out.join("/");
}

// Resolve an OKF link (absolute "/x.md" or relative) against the current directory.
export function resolveLink(href, dir) {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return null;
  let [path, anchor] = href.split("#");
  path = decodeURIComponent(path.split("?")[0]);
  if (!path) return null;
  const norm = path.startsWith("/") ? joinPath("", path.slice(1)) : joinPath(dir, path);
  if (norm === null) return { kind: "outside", path };
  if (path.endsWith("/") || store.tree[norm]) return { kind: "dir", id: norm, anchor, exists: norm in store.tree };
  if (norm === "index.md" || norm.endsWith("/index.md")) {
    const d = norm === "index.md" ? "" : norm.slice(0, -"/index.md".length);
    return { kind: "dir", id: d, anchor, exists: d in store.tree };
  }
  if (norm.endsWith(".md")) {
    const id = norm.slice(0, -3);
    return { kind: "concept", id, anchor, exists: store.concepts.has(id) };
  }
  return { kind: "file", path: norm };
}

const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = token.attrGet("href") || "";
  const dir = env?.dir ?? "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    if (/^https?:/i.test(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener");
      token.attrJoin("class", "external");
    }
  } else if (href.startsWith("#")) {
    token.attrSet("href", "javascript:void(0)");
    token.attrSet("data-anchor", href.slice(1));
  } else {
    const r = resolveLink(href, dir);
    if (r?.kind === "concept") {
      token.attrSet("href", conceptHref(r.id));
      if (!r.exists) {
        token.attrJoin("class", "broken");
        token.attrSet("title", "Not written yet");
      }
    } else if (r?.kind === "dir") {
      token.attrSet("href", dirHref(r.id));
      if (!r.exists) token.attrJoin("class", "broken");
    } else if (r?.kind === "file") {
      token.attrSet("href", `data/k/${r.path}`);
    }
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src") || "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith("data:")) {
    const path = src.startsWith("/") ? joinPath("", src.slice(1)) : joinPath(env?.dir ?? "", src);
    if (path !== null) token.attrSet("src", `data/k/${path}`);
  }
  token.attrSet("loading", "lazy");
  return defaultImage(tokens, idx, options, env, self);
};

export function render(text, { dir = "" } = {}) {
  return md.render(text || "", { dir });
}

// Make in-page anchors scroll instead of changing the route.
export function wireAnchors(root) {
  root.addEventListener("click", (event) => {
    const a = event.target.closest("a[data-anchor]");
    if (!a) return;
    event.preventDefault();
    const id = a.dataset.anchor;
    const target = root.querySelector(`#${CSS.escape(id)}`) || root.querySelector(`#h-${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
