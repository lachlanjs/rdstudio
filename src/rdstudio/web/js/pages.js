// Changes, Review, Reports and Skills tabs.

import { store } from "./data.js";
import { render } from "./markdown.js";
import { pendingProposals } from "./procedures.js";
import { h, conceptHref, timeEl, trustState, trustBadge, fmtDate } from "./util.js";

// ---------------------------------------------------------------- changes

const CATEGORY_LABEL = { knowledge: "Knowledge", code: "Code", reports: "Reports", agent: "Agent setup", other: "Other" };
const hiddenCats = new Set(JSON.parse(sessionStorage.getItem("rdstudio.hiddenCats") || "[]"));

function fileLink(f) {
  const k = store.site.knowledge + "/";
  if (f.status !== "deleted" && f.path.startsWith(k) && f.path.endsWith(".md")) {
    const id = f.path.slice(k.length, -3);
    if (store.concepts.has(id)) return h("a", { href: conceptHref(id) }, f.path);
  }
  const r = store.site.reports + "/";
  if (f.status !== "deleted" && f.path.startsWith(r) && f.path.endsWith(".html")) {
    return h("a", { href: "#/r/" + f.path.slice(r.length) }, f.path);
  }
  return f.path;
}

const STATUS_MARK = { added: "+", deleted: "−", modified: "~", renamed: "→", copied: "+" };

function commitView(c) {
  const groups = {};
  for (const f of c.files) (groups[f.category] ||= []).push(f);
  const cats = Object.keys(groups).filter((k) => !hiddenCats.has(k));
  if (c.files.length && !cats.length) return null;
  return h("li", { class: `commit${c.pending ? " pending" : ""}` },
    h("div", { class: "commit-head" },
      h("span", { class: "commit-subject" }, c.subject),
      h("span", { class: "commit-sub" },
        c.pending ? "Not committed yet" : [h("code", {}, c.short), "  ", c.author, "  ", timeEl(c.date)],
        c.merge ? "  merge" : "")),
    cats.length ? h("div", { class: "filegroups" }, Object.keys(CATEGORY_LABEL).concat(Object.keys(groups)).filter((k, i, a) => a.indexOf(k) === i && cats.includes(k)).map((k) =>
      h("div", { class: "filegroup" },
        h("span", { class: `cat ${k}` }, CATEGORY_LABEL[k] || k),
        h("ul", { class: "files" }, groups[k].map((f) => h("li", { title: `${f.status}: ${f.path}` },
          h("span", { class: `st ${f.status}`, "aria-label": f.status }, STATUS_MARK[f.status] || "~"), fileLink(f))))))) : "");
}

export function changesView() {
  document.title = `Changes · ${store.site.title}`;
  const ch = store.changes;
  const page = h("div", { class: "page" }, h("h1", {}, "Changes"));
  if (!ch.available) {
    page.append(h("p", { class: "lede" }, "This project is not a git repository, so there is no history to show. Run git init to start tracking changes."));
    return page;
  }
  page.append(h("p", { class: "lede" }, `Commits on ${ch.branch}, newest first, with the files each one touched.`));
  const present = new Set(ch.commits.flatMap((c) => c.files.map((f) => f.category)));
  const bar = h("div", { class: "toggles", role: "group", "aria-label": "Show categories" });
  const list = h("ul", { class: "rows", style: "border-top:0" });
  const draw = () => list.replaceChildren(...ch.commits.map(commitView).filter(Boolean));
  for (const k of Object.keys(CATEGORY_LABEL).filter((x) => present.has(x))) {
    const b = h("button", { class: "toggle", type: "button", "aria-pressed": String(!hiddenCats.has(k)) }, h("span", { class: `cat ${k}` }, CATEGORY_LABEL[k]));
    b.addEventListener("click", () => {
      hiddenCats.has(k) ? hiddenCats.delete(k) : hiddenCats.add(k);
      b.setAttribute("aria-pressed", String(!hiddenCats.has(k)));
      try { sessionStorage.setItem("rdstudio.hiddenCats", JSON.stringify([...hiddenCats])); } catch { /* ignore */ }
      draw();
    });
    bar.append(b);
  }
  draw();
  page.append(bar, list);
  return page;
}

// ----------------------------------------------------------------- review

export function reviewItems() {
  const all = [...store.concepts.values()];
  const byGenerated = (a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || ""));
  const isQuestion = (c) => c.type.toLowerCase() === "question";
  return {
    stale: all.filter((c) => c.verification_stale).sort(byGenerated),
    unverified: all.filter((c) => c.trust === "unverified").sort(byGenerated),
    questions: all.filter((c) => isQuestion(c) && !(c.tags || []).includes("answered") && c.status !== "deprecated"),
    drafts: all.filter((c) => c.status === "draft"),
    expired: all.filter((c) => c.content_stale),
    errors: (store.site.issues || []).filter((i) => i.level === "error"),
    broken: (store.site.issues || []).filter((i) => i.level === "warning" && i.message.startsWith("broken link")),
    proposals: pendingProposals(),
  };
}

export function reviewCount() {
  const r = reviewItems();
  return r.stale.length + r.unverified.length + r.questions.length + r.errors.length + r.proposals.length;
}

function conceptRow(c, extra) {
  return h("li", {},
    h("a", { class: "title", href: conceptHref(c.id) }, c.title),
    h("div", { class: "sub" }, h("span", {}, c.type || "Concept"), h("span", {}, c.id), c.generated_at ? h("span", {}, "updated ", timeEl(c.generated_at)) : "", extra || ""),
    c.description ? h("div", { class: "desc" }, c.description) : "");
}

function section(title, note, items, row) {
  return [
    h("h2", { class: "section-h" }, title, h("span", { class: "count" }, items.length)),
    note ? h("p", { class: "section-note" }, note) : "",
    items.length ? h("ul", { class: "rows" }, items.map(row)) : h("p", { class: "empty" }, "Nothing here."),
  ];
}

export function reviewView() {
  document.title = `Review · ${store.site.title}`;
  const r = reviewItems();
  const human = store.site.human || "human:<you>";
  const issueRow = (i) => {
    const id = i.path.replace(/\.md$/, "");
    return h("li", {}, store.concepts.has(id) ? h("a", { class: "title", href: conceptHref(id) }, i.path) : h("span", { class: "title" }, i.path), h("div", { class: "desc" }, i.message));
  };
  return h("div", { class: "page" },
    h("h1", {}, "Review"),
    h("p", { class: "lede" }, "What needs a human look. Mark a concept as checked with ", h("code", {}, `rdstudio verify <id>`), ` (recorded as ${human}).`),
    section("Changed since review", "Human-reviewed concepts that were meaningfully edited afterwards.", r.stale, (c) => conceptRow(c)),
    section("Open questions", null, r.questions, (c) => conceptRow(c)),
    r.proposals.length ? section("Proposed procedure changes", "Apply or reject with rdstudio procedure apply|reject <procedure> <n>.", r.proposals, ({ c, p }) => h("li", {},
      h("a", { class: "title", href: "#/p/" + c.id }, `${c.title}, proposal #${p.id}`),
      h("div", { class: "sub" }, h("span", {}, p.by || ""), p.at ? h("span", {}, timeEl(p.at)) : ""),
      p.rationale ? h("div", { class: "desc" }, p.rationale) : "")) : "",
    section("Unverified", "Concepts nobody has confirmed yet, newest first.", r.unverified, (c) => conceptRow(c, c.meta?.generated?.by ? h("span", {}, "by " + c.meta.generated.by) : "")),
    r.drafts.length ? section("Drafts", null, r.drafts, (c) => conceptRow(c)) : "",
    r.expired.length ? section("Past their stale date", "stale_after has passed.", r.expired, (c) => conceptRow(c)) : "",
    section("Format errors", "Files that do not conform to OKF.", r.errors, issueRow),
    r.broken.length ? section("Links to unwritten knowledge", null, r.broken, issueRow) : "");
}

// ---------------------------------------------------------------- reports

export function reportsView() {
  document.title = `Reports · ${store.site.title}`;
  const items = store.reports;
  return h("div", { class: "page" },
    h("h1", {}, "Reports"),
    h("p", { class: "lede" }, "Write-ups from agents after significant work, newest first."),
    items.length ? h("ul", { class: "rows" }, items.map((r) => h("li", {},
      h("a", { class: "title", href: "#/r/" + r.path.split("/").map(encodeURIComponent).join("/") }, r.title),
      h("div", { class: "sub" }, h("span", {}, fmtDate(r.date)), r.author ? h("span", {}, r.author) : "", r.activity ? h("span", {}, r.activity) : "",
        r.links.length ? h("span", {}, `${r.links.length} linked concept${r.links.length > 1 ? "s" : ""}`) : ""),
      r.description ? h("div", { class: "desc" }, r.description) : "")))
      : h("p", { class: "empty" }, `No reports yet. Agents write them to ${store.site.reports}/ with the /report skill.`));
}

export function reportView(path) {
  const r = store.reports.find((x) => x.path === path);
  document.title = `${r ? r.title : path} · ${store.site.title}`;
  const src = "reports/" + path.split("/").map(encodeURIComponent).join("/");
  const frame = h("iframe", { class: "report-frame", src, title: r ? r.title : path });
  frame.addEventListener("load", () => {
    // Knowledge links inside a report open in the dashboard.
    try {
      const doc = frame.contentDocument;
      doc.addEventListener("click", (event) => {
        const a = event.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        const k = "/" + store.site.knowledge + "/";
        let id = null;
        if (href.startsWith("#/k/")) id = href.slice(4);
        else if (href.startsWith(k) && href.endsWith(".md")) id = href.slice(k.length, -3);
        else if (href.includes(store.site.knowledge + "/") && href.endsWith(".md")) id = href.split(store.site.knowledge + "/").pop().slice(0, -3);
        if (id) { event.preventDefault(); location.hash = conceptHref(decodeURIComponent(id)); }
      });
    } catch { /* cross-origin: leave links alone */ }
  });
  return h("div", { class: "report-frame-wrap" },
    h("div", { class: "report-bar" },
      h("a", { href: "#/reports" }, "All reports"),
      h("strong", {}, r ? r.title : path),
      r ? h("span", {}, fmtDate(r.date)) : "",
      h("a", { href: src, target: "_blank", rel: "noopener", style: "margin-left:auto" }, "Open on its own")),
    frame);
}

// ----------------------------------------------------------------- skills

export function skillsView() {
  document.title = `Skills & agents · ${store.site.title}`;
  const { skills, agents } = store.skills;
  const row = (kind) => (s) => h("li", {},
    h("a", { class: "title", href: `#/${kind}/${encodeURIComponent(s.name)}` }, kind === "skill" ? "/" + s.name : s.name),
    h("div", { class: "sub" }, s.scope === "user" ? h("span", { class: "chip" }, "user-level") : "", h("span", {}, s.path), s.meta?.model ? h("span", {}, "model: " + s.meta.model) : ""),
    s.description ? h("div", { class: "desc" }, s.description) : "");
  return h("div", { class: "page" },
    h("h1", {}, "Skills & agents"),
    h("p", { class: "lede" }, "Skills are procedures an agent runs on request. Agents are subagent profiles the main agent can delegate to. User-level ones apply to every project; move a skill between scopes with rdstudio skills to-user|to-project <name>."),
    h("h2", { class: "section-h" }, "Skills", h("span", { class: "count" }, skills.length)),
    skills.length ? h("ul", { class: "rows" }, skills.map(row("skill"))) : h("p", { class: "empty" }, "No skills in .claude/skills yet. Run rdstudio init to add the standard set."),
    h("h2", { class: "section-h" }, "Agents", h("span", { class: "count" }, agents.length)),
    agents.length ? h("ul", { class: "rows" }, agents.map(row("agent"))) : h("p", { class: "empty" }, "No agent profiles in .claude/agents yet."));
}

export function skillView(kind, name) {
  const list = kind === "skill" ? store.skills.skills : store.skills.agents;
  const s = list.find((x) => x.name === name);
  if (!s) return h("div", { class: "page" }, h("h1", {}, "Not found"), h("p", {}, h("a", { href: "#/skills" }, "All skills and agents")));
  document.title = `${s.name} · ${store.site.title}`;
  const meta = Object.entries(s.meta).filter(([k]) => k !== "description");
  return h("div", { class: "page" },
    h("p", { class: "doc-kind" }, h("a", { href: "#/skills" }, "Skills & agents"), h("span", {}, kind === "skill" ? "Skill" : "Agent"), h("span", {}, s.path)),
    h("h1", {}, kind === "skill" ? "/" + s.name : s.name),
    s.description ? h("p", { class: "lede" }, s.description) : "",
    meta.length ? h("table", { class: "fm", style: "max-width:560px;margin-bottom:28px" }, h("tbody", {}, meta.map(([k, v]) => h("tr", {}, h("th", {}, k), h("td", {}, Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)))))) : "",
    h("div", { class: "prose", html: render(s.body) }));
}

export { trustBadge, trustState };
