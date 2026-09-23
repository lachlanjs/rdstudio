// rdstudio dashboard: hash router and shell.

import { store, load, watch } from "./js/data.js";
import { conceptView, dirView } from "./js/knowledge.js";
import { graphView, leaveGraph } from "./js/graph.js";
import { changesView, reviewView, reviewCount, reportsView, reportView, skillsView, skillView } from "./js/pages.js";
import { proceduresView, procedureView, procedures } from "./js/procedures.js";
import { settingsView } from "./js/settings.js";
import { h } from "./js/util.js";

const view = document.getElementById("view");
const menu = document.querySelector(".menu");
let current = null; // { tab, key, node }

function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [, head = "", ...rest] = raw.split("/");
  const tail = rest.map(decodeURIComponent).join("/");
  switch (head) {
    case "": return { tab: "knowledge", key: "d:", render: () => dirView("") };
    case "d": return { tab: "knowledge", key: "d:" + tail, render: () => dirView(tail) };
    case "k": return { tab: "knowledge", key: "k:" + tail, render: () => conceptView(tail) };
    case "graph": return { tab: "graph", key: "graph", render: graphView };
    case "changes": return { tab: "changes", key: "changes", render: changesView };
    case "review": return { tab: "review", key: "review", render: reviewView };
    case "reports": return { tab: "reports", key: "reports", render: reportsView };
    case "r": return { tab: "reports", key: "r:" + tail, render: () => reportView(tail) };
    case "procedures": return { tab: "procedures", key: "procedures", render: proceduresView };
    case "p": return { tab: "procedures", key: "p:" + tail, render: () => procedureView(tail) };
    case "settings": return { tab: "settings", key: "settings", render: settingsView };
    case "skills": return { tab: "skills", key: "skills", render: skillsView };
    case "skill": return { tab: "skills", key: "skill:" + tail, render: () => skillView("skill", tail) };
    case "agent": return { tab: "skills", key: "agent:" + tail, render: () => skillView("agent", tail) };
    default: return { tab: "knowledge", key: "404", render: () => h("div", { class: "page" }, h("h1", {}, "Page not found"), h("p", {}, h("a", { href: "#/" }, "Go to knowledge"))) };
  }
}

function updateChrome(tab) {
  for (const a of document.querySelectorAll(".tabs a, .settings-link")) {
    a.toggleAttribute("aria-current", a.dataset.tab === tab);
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
  }
  const brand = document.querySelector(".brand");
  brand.textContent = store.site.title || "rdstudio";
  const review = reviewCount();
  const rc = document.querySelector('[data-count="review"]');
  rc.textContent = review || "";
  rc.hidden = !review;
  const reports = store.reports.length;
  const rp = document.querySelector('[data-count="reports"]');
  rp.textContent = reports || "";
  rp.hidden = !reports;
  menu.hidden = tab !== "knowledge";
  document.querySelector('[data-tab="procedures"]').hidden = !procedures().length && tab !== "procedures";
}

async function route({ keepScroll = false } = {}) {
  const next = parse();
  if (current?.tab === "graph" && next.tab !== "graph") leaveGraph();
  closeDrawer();
  const scroll = keepScroll ? window.scrollY : 0;
  const node = await next.render();
  if (!keepScroll || current?.key !== next.key) {
    view.replaceChildren(node);
    window.scrollTo(0, scroll);
  } else {
    view.replaceChildren(node);
    window.scrollTo(0, scroll);
  }
  current = { ...next, node };
  updateChrome(next.tab);
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
  menu.setAttribute("aria-expanded", "false");
}

menu.addEventListener("click", () => {
  const open = !document.body.classList.contains("drawer-open");
  document.body.classList.toggle("drawer-open", open);
  menu.setAttribute("aria-expanded", String(open));
});
document.querySelector(".scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
window.addEventListener("hashchange", () => route());

async function refresh() {
  // Live update: the graph merges new data in place; other views re-render keeping scroll.
  if (current?.tab === "graph" && current.node?.refresh) {
    current.node.refresh();
    updateChrome("graph");
    return;
  }
  await route({ keepScroll: true });
}

try {
  await load();
  await route();
  const live = document.querySelector(".live");
  if (store.site.static) {
    live.hidden = true; // an exported snapshot does not change
  } else {
    watch(refresh, (ok) => { live.classList.toggle("offline", !ok); live.textContent = ok ? "Live" : "Offline"; });
  }
} catch (err) {
  view.replaceChildren(h("div", { class: "page" }, h("h1", {}, "The dashboard data could not be loaded"),
    h("p", { class: "lede" }, "Run rdstudio build (or rdstudio serve) in the project, then reload this page."),
    h("pre", {}, String(err))));
}
