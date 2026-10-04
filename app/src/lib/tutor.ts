// Work together (T51), the dashboard's side: ask the teacher about the draft
// (rdstudio serve calls the model; the reply streams back as server-sent
// events), and the shape of a turn as kept with the draft.

import { learner } from "./data.svelte.ts";

export type Mode = "hint" | "feedback" | "discuss";
export type Colour = "red" | "green" | "blue" | "hint";

export interface Pin { colour: Colour; quote: string; from: number | null; to: number | null; comment: string }
export interface Turn {
  id: string; at: string; mode: Mode; rung: number | null; prompt: string | null; selection: string | null; confidence: string | null;
  version: string; reply: string; general: string; pins: Pin[]; model: string; cost: number;
}
export interface Seen { name: string; role: "system" | "user"; tokens: number; shortened: boolean; text: string }

export const MODE_LABEL: Record<Mode, string> = { hint: "Hint", feedback: "Feedback", discuss: "Discussion" };
export const HINT_RUNGS = 3;

export interface Asking { mode: Mode; text: string; working?: string; prompt?: string; selection?: string; confidence?: string }

/** Ask; `onText` gets the reply as it is written. Resolves with the kept turn, or throws with the reason. */
export async function askTutor(exercise: string, body: Asking, onText: (soFar: string) => void, signal?: AbortSignal): Promise<{ turn: Turn; seen: Seen[] }> {
  const url = new URL(`api/teacher/tutor/${encodeURIComponent(exercise)}`, new URL(".", location.href));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...learner.writeHeaders() }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let why = `The teacher could not be asked (${res.status})`;
    try { why = ((await res.json()) as { error?: string }).error ?? why; } catch { /* not JSON */ }
    throw new Error(why);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
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
      const value = JSON.parse(data);
      if (event === "text") { soFar += value as string; onText(soFar); }
      else if (event === "done") return value as { turn: Turn; seen: Seen[] };
      else if (event === "error") throw new Error(value as string);
    }
  }
  throw new Error("The reply stopped before it finished.");
}

/** What a reply looks like while it is still being written: pins' markers shown plainly. */
export const streamingText = (s: string): string => s.replace(/^\s*\[(red|green|blue|hint)\]\s*/gim, "▸ ");
