// Making an artifact from the editor (T78): what the model wrote is held by
// the server, loaded in a hidden sandboxed frame, and checked before it is
// offered: that it raises no error, is not too heavy, is ready quickly, and
// does nothing while untouched. One that fails goes back to the model to be
// put right; one that still fails is not offered. Only when the person
// accepts it is it written beside the note.

import { mountArtifact } from "./artifactFrame.ts";
import { editing } from "./edit.svelte.ts";

export const LIMITS = { bytes: 200_000, readyMs: 500, idleFrames: 3 };

const headers = () => ({ "Content-Type": "application/json", "x-rdstudio-token": editing.token ?? "" });
const api = (path: string) => new URL(path, new URL(".", location.href));

async function said(res: Response, fallback: string): Promise<never> {
  let why = `${fallback} (${res.status})`;
  try { why = ((await res.json()) as { error?: string }).error ?? why; } catch { /* not JSON */ }
  throw new Error(why);
}

/** Hold an unsaved artifact on the server; the address it is served from. */
export async function hold(path: string, html: string): Promise<string> {
  const res = await fetch(api("api/artifacts/preview"), { method: "POST", headers: headers(), body: JSON.stringify({ path, html }) });
  if (!res.ok) await said(res, "The artifact could not be previewed");
  return ((await res.json()) as { url: string }).url;
}

export interface Checked { url: string; problems: string[]; readyMs: number | null; bytes: number }

/** Load it out of sight and report what is wrong with it, if anything. */
export async function check(path: string, title: string, html: string): Promise<Checked> {
  const bytes = new Blob([html]).size;
  const url = await hold(path, html);
  const host = document.createElement("div");
  // In the window but not seen: a frame off the screen is not animated by the browser, and would always look idle.
  host.style.cssText = "position:fixed;left:0;top:0;width:720px;max-width:100vw;opacity:0;pointer-events:none;z-index:-1";
  document.body.append(host);
  const errors: string[] = [];
  let readyMs: number | null = null, idle: number | null = null;
  let wake: () => void = () => {};
  const m = mountArtifact(host, path, { fit: "content", eager: true, held: { src: url, title }, onReport: (r) => {
    if (r.type === "error" && r.message && !errors.includes(r.message)) errors.push(r.message);
    if (r.type === "ready") readyMs = r.ms ?? 0;
    if (r.type === "idle") idle = r.frames ?? 0;
    wake();
  } });
  const until = (done: () => boolean, ms: number) => new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    wake = () => { if (done()) { clearTimeout(t); resolve(); } };
    wake();
  });
  await until(() => readyMs !== null || errors.some((e) => e.startsWith("not ready")), 9000);
  if (readyMs !== null) {
    await new Promise((r) => setTimeout(r, 500)); // let anything that runs at the start finish
    m.probe(1000);
    await until(() => idle !== null, 2500);
  }
  m.destroy();
  host.remove();
  const problems = errors.map((e) => `It raised an error: ${e}`);
  if (readyMs === null && !errors.length) problems.push("It did not finish loading.");
  if (bytes > LIMITS.bytes) problems.push(`It is ${Math.round(bytes / 1000)} kB; the limit is ${LIMITS.bytes / 1000} kB.`);
  if (readyMs !== null && readyMs > LIMITS.readyMs) problems.push(`It took ${readyMs} ms to be ready; the limit is ${LIMITS.readyMs} ms. Do less on load.`);
  if (idle !== null && idle > LIMITS.idleFrames) problems.push(`It kept animating while untouched (${idle} frames in a second). Nothing should run until the reader asks, and it should stop when done.`);
  return { url, problems, readyMs, bytes };
}

/** Write the artifact beside the note, under a name not taken: the path it was given. */
export async function save(dir: string, name: string, html: string, author: string): Promise<string> {
  for (let n = 1; n <= 9; n++) {
    const path = `${dir ? dir + "/" : ""}${name}${n > 1 ? "-" + n : ""}.html`;
    const res = await fetch(api(`api/artifacts/${encodeURIComponent(path)}`), { method: "PUT", headers: headers(), body: JSON.stringify({ html, author }) });
    if (res.ok) return path;
    if (res.status !== 409) await said(res, "The artifact could not be saved");
  }
  throw new Error("No free name was found for the artifact.");
}
