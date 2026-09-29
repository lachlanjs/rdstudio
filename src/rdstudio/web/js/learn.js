// Learn tab: reading order from `requires` links, and the private learner record.

import { store, learner } from "./data.js";
import { h, conceptHref, titleCase } from "./util.js";

export function hasRequires() {
  for (const c of store.concepts.values()) if (c.requires?.length) return true;
  return false;
}

// Everything `id` requires, directly or through a chain, in reading order.
export function prerequisites(id) {
  const seen = new Set();
  const todo = [...(store.concepts.get(id)?.requires || [])];
  while (todo.length) {
    const v = todo.pop();
    if (seen.has(v) || !store.concepts.has(v)) continue;
    seen.add(v);
    todo.push(...store.concepts.get(v).requires);
  }
  seen.delete(id);
  return [...seen].map((x) => store.concepts.get(x)).sort((a, b) => a.order - b.order);
}

function folderLabel(dir) {
  return dir ? dir.split("/").map((p) => titleCase(p.replace(/[-_]/g, " "))).join(" / ") : "Top level";
}

export function depthLabel(c) {
  return h("span", { class: "depth", title: "The longest chain of prerequisites below this note" },
    c.depth ? `level ${c.depth}` : "start");
}

function readingOrder() {
  const notes = [...store.concepts.values()].filter((c) => c.type !== "Tour").sort((a, b) => a.order - b.order);
  const list = h("ol", { class: "reading" });
  let dir = null;
  for (const c of notes) {
    if (c.directory !== dir) {
      dir = c.directory;
      list.append(h("li", { class: "folder", "aria-hidden": "true" }, folderLabel(dir)));
    }
    list.append(h("li", { class: "step", value: c.order + 1 },
      h("a", { href: conceptHref(c.id), title: c.description || c.title }, c.title),
      depthLabel(c),
      c.depth ? h("a", { class: "path-link", href: "#/path/" + encodeURIComponent(c.id), title: `Study path to ${c.title} on the map` }, "path") : ""));
  }
  return list;
}

function recordSection() {
  if (store.site.static) {
    return h("p", { class: "section-note" }, "This is an exported snapshot, so nothing you do here is recorded.");
  }
  if (!learner.enabled) {
    return [
      h("p", { class: "section-note" },
        "Off. When it is on, rdstudio keeps a private record of what you study in this project, outside the repository, for the exercises and review to come. To turn it on, add this to ~/.config/rdstudio/config.toml and restart rdstudio serve:"),
      h("pre", {}, "[learner]\nenabled = true"),
    ];
  }
  return h("p", { class: "section-note" },
    `On. ${learner.events.length} ${learner.events.length === 1 ? "event" : "events"}, stored privately in `,
    h("code", {}, learner.dir), ". Only you see it; it is never part of the project or an export.");
}

export function learnView() {
  document.title = `Learn · ${store.site.title}`;
  const page = h("div", { class: "page" }, h("h1", {}, "Learn"));
  page.append(h("p", { class: "lede" },
    "A reading order for this knowledge base, from the links rated requires: each note comes after everything it needs."));
  page.append(h("h2", { class: "section-h" }, "Reading order"));
  if (hasRequires()) {
    page.append(h("p", { class: "section-note" },
      "Notes stay with their folder where they can. The level is the longest chain of prerequisites below a note; path shows that chain on the map."),
    readingOrder());
  } else {
    page.append(h("p", { class: "empty" },
      "No links are rated requires yet, so there is no order to give. Rate a link by giving it the title \"requires\", as in [Topology](/topology.md \"requires\")."));
  }
  page.append(h("h2", { class: "section-h" }, "Your learner record"), recordSection());
  return page;
}
