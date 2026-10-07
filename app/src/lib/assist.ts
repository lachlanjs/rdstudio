// An agent in the editor (T74), the dashboard's side: ask the connected model
// about a place in the note being edited, or for text to go there. rdstudio
// serve calls the model; the reply streams back as server-sent events.

import { editing } from "./edit.svelte.ts";

export type Mode = "ask" | "fill" | "figure";
export interface Source { kind: "note" | "code"; id: string; title: string; line?: number }
/** One thing the model looked up for itself (T84): a search, or a note or a file opened, and how it was reached. */
export interface Step {
  tool: string; said: string; how: "search" | "read" | "link" | "code"; notes: string[];
  opened?: string; section?: string; from?: string; code?: { path: string; line: number }; excerpt?: string; failed?: boolean;
}
export interface Reply {
  mode: Mode; reply: string; answer: string; insert: string | null; from: number; to: number;
  sources: Source[]; steps?: Step[]; model: string; tier?: Tier; cost: number;
  /** figure: the artifact written, to be checked and shown before anything is saved. */
  artifact?: { title: string; caption: string; html: string } | null;
}
export type Tier = "low" | "mid" | "max";
export interface Asking { mode: Mode; tier?: Tier; body: string; from: number; to: number; prompt?: string; title?: string; fix?: { html: string; problems: string[] } }

/** Post a request whose reply streams as server-sent events: text, step, then done (whose data is returned), or error. */
async function events<T>(path: string, body: unknown, onText: (soFar: string) => void, signal?: AbortSignal, onStep?: (step: Step) => void, token?: string | null): Promise<T> {
  const url = new URL(path, new URL(".", location.href));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-rdstudio-token": token ?? editing.token ?? "" }, body: JSON.stringify(body), signal });
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
      // Something was looked up: what was written before it was not the reply.
      else if (event === "step") { soFar = ""; onText(""); onStep?.(got as Step); }
      else if (event === "done") return got as T;
      else if (event === "error") throw new Error(got as string);
    }
  }
  throw new Error("The reply stopped before it finished.");
}

/** Ask; `onText` gets the reply as it is written, and `onStep` each thing the model looks up first. Resolves with the reply, or throws with the reason. */
export const askAssist = async (note: string, body: Asking, onText: (soFar: string) => void, signal?: AbortSignal, onStep?: (step: Step) => void): Promise<Reply> =>
  (await events<{ reply: Reply }>(`api/notes/${encodeURIComponent(note)}/assist`, body, onText, signal, onStep)).reply;

// Ask Atlas (T85): a question asked on the map, answered from the notes; what it looked up is what the map draws.

/** A note the answer rests on: a sentence of it, and how the note was reached. */
export interface Used { note: string; title: string; section?: string; quote: string; checked: boolean; how: "search" | "link"; from?: string }
export interface AtlasAnswer { question: string; answer: string; used: Used[]; steps: Step[]; code: Source[]; model: string; tier: Tier; cost: number }

export const askAtlas = async (body: { question: string; start?: string; tier?: Tier }, onText: (soFar: string) => void, signal?: AbortSignal, onStep?: (step: Step) => void, token?: string | null): Promise<AtlasAnswer> =>
  (await events<{ answer: AtlasAnswer }>("api/atlas/ask", body, onText, signal, onStep, token)).answer;

/** An Atlas answer while it is being written: its text, without the tags round it or the list after it. */
export const streamingAnswer = (s: string): string => s.replace(/<used>[\s\S]*$/i, "").replace(/<\/?answer>\n?/gi, "").replace(/<\/?[a-z]*$/i, "").trim();

/** A fill's reply while it is being written: the proposed text, without the tags round it. */
export const streamingFill = (s: string): string => s.replace(/<\/?insert>\n?/g, "").replace(/<why>[\s\S]*$/, "").trim();
