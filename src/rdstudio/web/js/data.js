// Loads the build's JSON and watches the version stamp for live updates.

import { measure } from "./util.js";

const FILES = ["site", "concepts", "tree", "changes", "reports", "skills"];
const POLL_MS = 2500;

export const store = {
  version: null,
  site: {},
  concepts: new Map(),
  tree: {},
  changes: { commits: [] },
  reports: [],
  skills: { skills: [], agents: [] },
  bodies: new Map(),
};

async function getJSON(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`data/${name}.json: ${res.status}`);
  return res.json();
}

async function currentVersion() {
  try {
    return (await getJSON("version")).version;
  } catch {
    return null;
  }
}

export async function load() {
  const start = performance.now();
  const [version, ...parts] = await Promise.all([currentVersion(), ...FILES.map(getJSON)]);
  const [site, concepts, tree, changes, reports, skills] = parts;
  store.version = version;
  store.site = site;
  store.concepts = new Map(concepts.map((c) => [c.id, c]));
  store.tree = tree;
  store.changes = changes;
  store.reports = reports;
  store.skills = skills;
  store.bodies.clear();
  measure("data", start);
}

export async function body(id) {
  if (store.bodies.has(id)) return store.bodies.get(id);
  const path = id.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`data/k/${path}.md`, { cache: "no-store" });
  const text = res.ok ? await res.text() : "";
  store.bodies.set(id, text);
  return text;
}

// Calls onChange() after new data has been loaded. Returns a status callback setter.
export function watch(onChange, onStatus) {
  let failures = 0;
  async function tick() {
    const v = await currentVersion();
    if (v === null) {
      failures += 1;
      onStatus?.(failures < 3);
    } else {
      failures = 0;
      onStatus?.(true);
      if (v !== store.version) {
        try {
          await load();
          onChange();
        } catch {
          /* a build was mid-write; try again next tick */
        }
      }
    }
    setTimeout(tick, document.hidden ? POLL_MS * 4 : POLL_MS);
  }
  setTimeout(tick, POLL_MS);
}

// ------------------------------------------------------- learner record
// Private to the person running `rdstudio serve`; absent from static exports.

export const learner = { enabled: false, dir: null, events: [], token: null };

export async function loadLearner() {
  if (store.site.static) return;
  try {
    const res = await fetch("api/learner", { cache: "no-store" });
    if (res.ok) Object.assign(learner, await res.json());
  } catch { /* an older server, or no server: the record is off */ }
}

// Appends one event ({event, concept, kind, ...}); resolves to the stored event, or null.
export async function record(event) {
  if (!learner.enabled) return null;
  const c = event.concept ? store.concepts.get(event.concept) : null;
  if (c && !event.hash) event = { ...event, hash: c.hash };
  try {
    const res = await fetch("api/learner", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Rdstudio-Token": learner.token },
      body: JSON.stringify(event),
    });
    if (!res.ok) return null;
    const stored = await res.json();
    learner.events.push(stored);
    return stored;
  } catch {
    return null;
  }
}
