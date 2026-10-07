// An agent in the editor (T74), the dashboard's side: ask the connected model
// about a place in the note being edited, or for text to go there. rdstudio
// serve calls the model; the reply streams back as server-sent events.

import { editing } from "./edit.svelte.ts";

export type Mode = "ask" | "fill" | "figure";
export interface Source { kind: "note" | "code"; id: string; title: string; line?: number }
export interface Reply {
  mode: Mode; reply: string; answer: string; insert: string | null; from: number; to: number;
  sources: Source[]; model: string; tier?: Tier; cost: number;
  /** figure: the artifact written, to be checked and shown before anything is saved. */
  artifact?: { title: string; caption: string; html: string } | null;
}
export type Tier = "low" | "mid" | "max";
export interface Asking { mode: Mode; tier?: Tier; body: string; from: number; to: number; prompt?: string; title?: string; fix?: { html: string; problems: string[] } }

/** Ask; `onText` gets the reply as it is written. Resolves with the reply, or throws with the reason. */
export async function askAssist(note: string, body: Asking, onText: (soFar: string) => void, signal?: AbortSignal): Promise<Reply> {
  const url = new URL(`api/notes/${encodeURIComponent(note)}/assist`, new URL(".", location.href));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-rdstudio-token": editing.token ?? "" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let why = `The model could not be asked (${res.status})`;
    try { why = ((await res.json()) as { error?: string }).error ?? why; } catch { /* not JSON */ }
    throw new Error(why);
  }
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = "", soFar = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: ?(.*)$/m.exec(block)?.[1] ?? "message";
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).replace(/^ /, "")).join("\n");
      if (!data) continue;
      const got = JSON.parse(data);
      if (event === "text") { soFar += got as string; onText(soFar); }
      else if (event === "done") return (got as { reply: Reply }).reply;
      else if (event === "error") throw new Error(got as string);
    }
  }
  throw new Error("The reply stopped before it finished.");
}

/** A fill's reply while it is being written: the proposed text, without the tags round it. */
export const streamingFill = (s: string): string => s.replace(/<\/?insert>\n?/g, "").replace(/<why>[\s\S]*$/, "").trim();
