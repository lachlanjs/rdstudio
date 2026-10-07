// Showing an artifact (T76): an HTML document from the knowledge folders, in
// a frame sandboxed to scripts only, so it cannot reach the app's page, its
// storage or the write token. The copy rdstudio serves carries a bridge
// (packages/cli/src/artifacts.ts) that reports its height, when it is ready
// and anything that went wrong, and takes the theme's colours. An embed in a
// note is as tall as its content, is loaded when it nears the screen, and
// when it fails shows one plain line, never breaking the note round it.

import { store } from "./data.svelte.ts";

const segments = (path: string) => path.split("/").map(encodeURIComponent).join("/");
/** The artifact's page in the app. */
export const artifactHref = (path: string): string => "#/a/" + segments(path);
/** The file itself, as served (prepared, sandboxed). */
export const artifactSrc = (path: string): string => "a/" + segments(path);

const VARS = ["--surface", "--surface-1", "--surface-2", "--surface-3", "--rule", "--rule-strong", "--text", "--text-soft", "--text-faint",
  "--pen-red", "--pen-green", "--pen-blue", "--font-text", "--font-ui", "--font-mono"];
function theme(): { rdstudio: "theme"; vars: Record<string, string>; mode: string } {
  const style = getComputedStyle(document.documentElement), vars: Record<string, string> = {};
  for (const v of VARS) vars[v] = style.getPropertyValue(v).trim();
  const bg = style.getPropertyValue("--surface").trim();
  // Light or dark as it is shown now, whatever chose it: from the surface's own lightness.
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
  const light = m ? (parseInt(m[1]!, 16) * 299 + parseInt(m[2]!, 16) * 587 + parseInt(m[3]!, 16) * 114) / 1000 > 140 : false;
  return { rdstudio: "theme", vars, mode: light ? "light" : "dark" };
}

export interface FrameOptions {
  /** As tall as its content (an embed), or filling the box it is given (its own page). */
  fit: "content" | "fill";
  caption?: string;
  /** Told what the bridge reports: for checking an artifact before it is offered. */
  onReport?: (m: { type: "ready" | "error" | "size" | "idle"; ms?: number; message?: string; height?: number; frames?: number }) => void;
  /** Load at once, not when it nears the screen. */
  eager?: boolean;
  /** An artifact not saved yet (T78): where it is held, and what to call it. `path` is then only a name. */
  held?: { src: string; title: string };
}

const READY_WITHIN = 8000;

/** Put an artifact in `host`. Returns what takes it away again, and a way to ask whether it is idle. */
export function mountArtifact(host: HTMLElement, path: string, opts: FrameOptions): { destroy: () => void; probe: (ms: number) => void } {
  const record = opts.held ? { path, title: opts.held.title, aspect: null, network: false } : store.artifacts.find((a) => a.path === path);
  host.classList.add("artifact");
  host.replaceChildren();
  const note = (text: string, withLink = true) => {
    const p = document.createElement("span");
    p.className = "artifact-note";
    p.textContent = text + " ";
    if (withLink && !opts.held) { const a = document.createElement("a"); a.href = artifactHref(path); a.textContent = record?.title ?? path; p.append(a); }
    return p;
  };
  if (!record) { host.append(note(`No artifact at ${path}.`, false)); return { destroy: () => host.replaceChildren(), probe: () => {} }; }

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.title = opts.caption || record.title;
  frame.className = "artifact-frame";
  if (opts.fit === "content") {
    if (record.aspect) frame.style.aspectRatio = record.aspect; else frame.style.height = "240px";
  }
  let done = false, timer = 0, ready = false;
  const send = () => { try { frame.contentWindow?.postMessage(theme(), "*"); } catch { /* gone */ } };
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow) return;
    const m = e.data as { rdstudio?: string; type?: string; height?: number; ms?: number; message?: string; frames?: number } | null;
    if (!m || m.rdstudio !== "artifact") return;
    if (m.type === "size" && opts.fit === "content" && !record.aspect && m.height) frame.style.height = `${Math.min(4000, Math.max(40, m.height))}px`;
    if (m.type === "ready") { ready = true; clearTimeout(timer); host.classList.add("ready"); send(); }
    if (m.type === "error" && !host.classList.contains("errored")) {
      host.classList.add("errored");
      // In a note, an artifact that goes wrong says so in one plain line; the note round it is untouched.
      if (opts.fit === "content") { const line = note("This figure reported an error. Open it on its own:"); line.classList.add("bad"); host.append(line); }
    }
    opts.onReport?.(m as never);
  };
  addEventListener("message", onMessage);
  // The theme follows the app's.
  const watch = new MutationObserver(send);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode", "data-scan"] });

  const load = () => {
    if (done || frame.src) return;
    frame.addEventListener("load", send);
    frame.src = opts.held ? opts.held.src : artifactSrc(path);
    host.append(frame);
    if (opts.caption) { const c = document.createElement("span"); c.className = "artifact-caption"; c.textContent = opts.caption; host.append(c); }
    timer = window.setTimeout(() => {
      if (ready || done) return;
      host.classList.add("failed");
      frame.remove();
      host.prepend(note("This figure did not load:"));
      opts.onReport?.({ type: "error", message: `not ready within ${READY_WITHIN / 1000} seconds` });
    }, READY_WITHIN);
  };
  let near: IntersectionObserver | null = null;
  if (record.network && opts.fit === "content") {
    // Needs the network: never loaded on its own in a note.
    const b = document.createElement("button");
    b.type = "button"; b.className = "toggle"; b.textContent = "Load (it needs the network)";
    b.addEventListener("click", () => { b.remove(); load(); });
    host.append(note("", true), b);
  } else if (opts.eager || typeof IntersectionObserver === "undefined") load();
  else {
    near = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { near?.disconnect(); load(); } }, { rootMargin: "600px" });
    near.observe(host);
  }
  return {
    destroy() { done = true; clearTimeout(timer); near?.disconnect(); watch.disconnect(); removeEventListener("message", onMessage); host.replaceChildren(); },
    probe(ms: number) { try { frame.contentWindow?.postMessage({ rdstudio: "probe", ms }, "*"); } catch { /* gone */ } },
  };
}

/** Mount every embed in rendered Markdown (`.artifact-embed`, from markdown.ts). Returns what takes them away. */
export function mountEmbeds(root: HTMLElement): () => void {
  const mounted = [...root.querySelectorAll<HTMLElement>(".artifact-embed[data-artifact]")].map((el) =>
    mountArtifact(el, el.dataset.artifact ?? "", { fit: "content", caption: el.dataset.caption || undefined }));
  return () => mounted.forEach((m) => m.destroy());
}
