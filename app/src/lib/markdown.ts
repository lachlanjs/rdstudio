// Markdown rendering: markdown-it with footnotes, KaTeX (texmath) and
// highlight.js, with OKF links rewritten to in-app routes. A port of the old
// dashboard's js/markdown.js; the output is the same HTML.

import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import texmath from "markdown-it-texmath";
import katex from "katex";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import latex from "highlight.js/lib/languages/latex";
import julia from "highlight.js/lib/languages/julia";
import matlab from "highlight.js/lib/languages/matlab";
import { store } from "./data.svelte.ts";
import { conceptHref, dirHref } from "./format.ts";

hljs.registerLanguage("latex", latex);
hljs.registerLanguage("julia", julia);
hljs.registerLanguage("matlab", matlab);

type Env = { dir?: string };

const md = new MarkdownIt({
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
  .use(footnote)
  .use(texmath, { engine: katex, delimiters: ["dollars", "brackets"], katexOptions: { throwOnError: false } });

/** Heading ids for outline navigation. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
}

md.core.ruler.push("heading_ids", (state) => {
  const seen = new Map<string, number>();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type !== "heading_open") continue;
    const text = tokens[i + 1]?.children?.map((t) => t.content).join("") ?? "";
    let slug = slugify(text) || "section";
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    if (n) slug += `-${n}`;
    tokens[i]!.attrSet("id", "h-" + slug);
  }
});

// Task-list checkboxes: "- [ ]" and "- [x]".
md.core.ruler.push("task_lists", (state) => {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type !== "inline" || tokens[i - 1]!.type !== "paragraph_open" || tokens[i - 2]!.type !== "list_item_open") continue;
    const m = /^\[([ xX])\]\s/.exec(t.content);
    if (!m || !t.children?.length) continue;
    const first = t.children[0]!;
    first.content = first.content.replace(/^\[[ xX]\]\s/, "");
    const box = new state.Token("html_inline", "", 0);
    box.content = `<input type="checkbox" disabled${m[1] !== " " ? " checked" : ""}> `;
    t.children.unshift(box);
    tokens[i - 2]!.attrJoin("class", "task-item");
    for (let j = i - 3; j >= 0; j--) {
      if (tokens[j]!.type === "bullet_list_open" && tokens[j]!.level === tokens[i - 2]!.level - 1) {
        tokens[j]!.attrJoin("class", "contains-task-list");
        break;
      }
    }
  }
});

// ```mermaid fences become diagram placeholders, drawn by diagrams.ts; until
// then (or if drawing fails) the source stays readable.
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  if (token.info.trim().split(/\s+/)[0]!.toLowerCase() === "mermaid") {
    const src = md.utils.escapeHtml(token.content);
    return `<div class="mermaid-block" data-src="${src}"><pre class="mermaid-source"><code>${src}</code></pre></div>\n`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Wrap tables so wide ones scroll on phones.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => "</table></div>";

function joinPath(dir: string, target: string): string | null {
  const out: string[] = [];
  for (const p of (dir ? dir.split("/") : []).concat(target.split("/"))) {
    if (!p || p === ".") continue;
    if (p === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(p);
  }
  return out.join("/");
}

export type Resolved =
  | { kind: "outside"; path: string }
  | { kind: "dir"; id: string; anchor?: string; exists: boolean }
  | { kind: "concept"; id: string; anchor?: string; exists: boolean }
  | { kind: "file"; path: string };

/** Resolve an OKF link (absolute "/x.md" or relative) against the current folder. */
export function resolveLink(href: string, dir: string): Resolved | null {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return null;
  const [raw = "", anchor] = href.split("#");
  let path: string;
  try { path = decodeURIComponent(raw.split("?")[0]!); } catch { path = raw; }
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

type Rule = NonNullable<MarkdownIt["renderer"]["rules"]["link_open"]>;
const defaultLinkOpen: Rule = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env: Env, self) => {
  const token = tokens[idx]!;
  const href = token.attrGet("href") ?? "";
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
    const r = resolveLink(href, env?.dir ?? "");
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

const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env: Env, self) => {
  const token = tokens[idx]!;
  const src = token.attrGet("src") ?? "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith("data:")) {
    const path = src.startsWith("/") ? joinPath("", src.slice(1)) : joinPath(env?.dir ?? "", src);
    if (path !== null) token.attrSet("src", `data/k/${path}`);
  }
  token.attrSet("loading", "lazy");
  return defaultImage(tokens, idx, options, env, self);
};

// Notes may contain HTML (and come from agents and other people), so the
// rendered page is sanitised: no scripts or event handlers. KaTeX's MathML and
// styles, data- attributes and the in-page anchor links are kept.
DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "href" && data.attrValue === "javascript:void(0)") data.forceKeepAttr = true;
});

export function render(text: string, { dir = "" }: { dir?: string } = {}): string {
  const html = md.render(text || "", { dir } satisfies Env);
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "loading"] });
}

/** Make in-page anchors scroll instead of changing the route. */
export function wireAnchors(root: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    const a = (event.target as Element | null)?.closest<HTMLElement>("a[data-anchor]");
    if (!a) return;
    event.preventDefault();
    const id = a.dataset.anchor ?? "";
    const target = root.querySelector(`#${CSS.escape(id)}`) ?? root.querySelector(`#h-${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
