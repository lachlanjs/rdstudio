// The dashboard's data: the JSON files rdstudio build writes, loaded once and
// again whenever the build's version changes (live updates), plus the private
// learner record through rdstudio serve's API (the generated client in api/).

import type { Changes, ConceptRecord, FolderRecord, ReportRecord, SiteInfo, Skills } from "@rdstudio/core";
import { client } from "./api/client.gen.ts";
import { getApiLearner, postApiLearner } from "./api/sdk.gen.ts";
import type { LearnerEvent } from "./api/types.gen.ts";
import { measure } from "./perf.ts";

const POLL_MS = 2500;

async function getJSON<T>(name: string): Promise<T> {
  const res = await fetch(`data/${name}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`data/${name}.json: ${res.status}`);
  return res.json() as Promise<T>;
}

async function currentVersion(): Promise<string | null> {
  try {
    return (await getJSON<{ version: string }>("version")).version;
  } catch {
    return null;
  }
}

class Store {
  // Replaced wholesale on each load, never mutated: raw state, not proxied.
  version = $state.raw<string | null>(null);
  site = $state.raw<SiteInfo>({} as SiteInfo);
  concepts = $state.raw(new Map<string, ConceptRecord>());
  tree = $state.raw<Record<string, FolderRecord>>({});
  changes = $state.raw<Changes>({ available: false, commits: [] });
  reports = $state.raw<ReportRecord[]>([]);
  skills = $state.raw<Skills>({ skills: [], agents: [] });
  loaded = $state(false);
  live = $state<"live" | "offline" | "static">("live");
  private bodies = new Map<string, string>();

  async load(): Promise<void> {
    const start = performance.now();
    const [version, site, concepts, tree, changes, reports, skills] = await Promise.all([
      currentVersion(), getJSON<SiteInfo>("site"), getJSON<ConceptRecord[]>("concepts"), getJSON<Record<string, FolderRecord>>("tree"),
      getJSON<Changes>("changes"), getJSON<ReportRecord[]>("reports"), getJSON<Skills>("skills"),
    ]);
    this.bodies.clear();
    this.version = version;
    this.site = site;
    this.concepts = new Map(concepts.map((c) => [c.id, c]));
    this.tree = tree;
    this.changes = changes;
    this.reports = reports;
    this.skills = skills;
    this.loaded = true;
    measure("data", start);
  }

  /** A note's Markdown body, fetched once per data version. */
  async body(id: string): Promise<string> {
    const hit = this.bodies.get(id);
    if (hit !== undefined) return hit;
    const res = await fetch(`data/k/${id.split("/").map(encodeURIComponent).join("/")}.md`, { cache: "no-store" });
    const text = res.ok ? await res.text() : "";
    this.bodies.set(id, text);
    return text;
  }

  /** Reload whenever the build's version changes. A hidden tab stops asking
   *  (several open dashboards would otherwise share a slow link) and asks at
   *  once when shown again. Returns a function that stops watching. */
  watch(): () => void {
    if (this.site.static) {
      this.live = "static"; // an exported snapshot does not change
      return () => {};
    }
    let failures = 0, timer: ReturnType<typeof setTimeout> | null | -1 = null, stopped = false;
    const tick = async () => {
      const v = await currentVersion();
      if (v === null) {
        failures += 1;
        this.live = failures < 3 ? "live" : "offline";
      } else {
        failures = 0;
        this.live = "live";
        if (v !== this.version) {
          try { await this.load(); } catch { /* a build was mid-write; try again next tick */ }
        }
      }
      schedule();
    };
    const schedule = () => { timer = stopped || document.hidden ? null : setTimeout(tick, POLL_MS); };
    const onVisible = () => {
      if (!document.hidden && timer === null && !stopped) { timer = -1; void tick(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      stopped = true;
      if (typeof timer === "number" && timer !== -1) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }
}

export const store = new Store();

// ------------------------------------------------------------------ learner record
// Private to the person running rdstudio serve; absent from static exports.

class Learner {
  enabled = $state(false);
  dir = $state<string | null>(null);
  events = $state.raw<LearnerEvent[]>([]);
  private token: string | null = null;

  async load(): Promise<void> {
    if (store.site.static) return;
    // The API sits beside the page, wherever the dashboard is served from.
    client.setConfig({ baseUrl: new URL(".", location.href).href.replace(/\/$/, "") });
    try {
      const { data } = await getApiLearner();
      if (!data) return;
      this.enabled = data.enabled;
      this.dir = data.dir;
      this.token = data.token;
      this.events = data.events;
    } catch { /* an older server, or none: the record is off */ }
  }

  /** Append one event ({event, concept, kind, ...}); the stored event, or null. */
  async record(event: Record<string, unknown>): Promise<LearnerEvent | null> {
    if (!this.enabled || !this.token) return null;
    const c = typeof event.concept === "string" ? store.concepts.get(event.concept) : undefined;
    if (c && !event.hash) event = { ...event, hash: c.hash };
    try {
      const { data } = await postApiLearner({ body: event, headers: { "x-rdstudio-token": this.token } });
      if (!data) return null;
      this.events = [...this.events, data];
      return data;
    } catch {
      return null;
    }
  }
}

export const learner = new Learner();
