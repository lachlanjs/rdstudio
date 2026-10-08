// An agent in the editor (T74), the dashboard's side: ask the connected model
// about a place in the note being edited, or for text to go there. rdstudio
// serve calls the model; the reply streams back as server-sent events.

import { editing } from "./edit.svelte.ts";

export type Mode = "ask" | "fill" | "figure" | "chat";
export interface Source { kind: "note" | "code"; id: string; title: string; line?: number }
/** One thing the model looked up for itself (T84): a search, or a note or a file opened, and how it was reached. */
export interface Step {
  tool: string; said: string; how: "search" | "read" | "link" | "code" | "meaning" | "propose" | "write"; notes: string[];
  opened?: string; section?: string; from?: string; code?: { path: string; line: number }; excerpt?: string; failed?: boolean;
}
export interface Reply {
  mode: Mode; reply: string; answer: string; insert: string | null; from: number; to: number;
  sources: Source[]; steps?: Step[]; model: string; tier?: Tier; cost: number;
  /** figure: the artifact written, to be checked and shown before anything is saved. */
  artifact?: { title: string; caption: string; html: string } | null;
  spent?: Spent;
  /** chat: the changes proposed, placed in the text that was sent. */
  edits?: Edit[];
  dropped?: string[];
}
export interface Spent { calls: number; input: number; output: number; cached: number }
/** A change proposed to the note (T98): `insert` in place of from..to. */
export interface Edit { kind: "passage" | "insert" | "change"; from: number; to: number; insert: string }
export type Tier = "low" | "mid" | "max";
export interface Asking {
  mode: Mode; tier?: Tier; body: string; from: number; to: number; prompt?: string; title?: string; fix?: { html: string; problems: string[] };
  /** chat: where new text is to go, apart from the passage; what it may change; the turns before; the kept chat it goes on from. */
  at?: number | null; may?: { passage?: boolean; note?: boolean }; thread?: { question: string; answer: string }[]; chat?: string | null;
}

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

// A chat beside the note (T97): its turns, as they are shown and as they are kept in the learner record.

export interface Turn {
  at: string; question: string; passage: string | null; here: { line: number; after: string } | null; may: { passage: boolean; note: boolean };
  answer: string; edits: { kind: Edit["kind"]; line: number; old: string; new: string }[]; dropped: string[];
  steps: Step[]; sources: Source[]; model: string; tier: string; cost: number; spent?: Spent;
  /** Where a limit shaped the reply (T110): it was cut off, or it stopped looking things up. */
  notices?: string[];
}
export interface Chat { id: string; note: string; title: string; at: string; updated: string; turns: Turn[] }
export interface ChatSummary { id: string; note: string; title: string; at: string; updated: string; question: string; turns: number; cost: number }

/** One turn of a chat: resolves with the reply (the changes placed in the text sent), the turn as it is kept, and the id of the chat it is kept in (null where chats are not kept). */
export const askChat = (note: string, body: Asking, onText: (soFar: string) => void, signal?: AbortSignal, onStep?: (step: Step) => void): Promise<{ reply: Reply; turn: Turn; chat: string | null }> =>
  events<{ reply: Reply; turn: Turn; chat: string | null }>(`api/notes/${encodeURIComponent(note)}/assist`, { ...body, mode: "chat" }, onText, signal, onStep);

/** A chat turn's reply while it is being written: the answer, without the tags round it or the changes after it. */
export const streamingChat = (s: string): string => s.replace(/<(passage|insert|change)>[\s\S]*$/i, "").replace(/<\/?answer>\n?/gi, "").replace(/<\/?[a-z]*$/i, "").trim();

// Ask Atlas (T85): a question asked on the map, answered from the notes; what it looked up is what the map draws.

/** A note the answer rests on: a sentence of it, and how the note was reached. */
export interface Used { note: string; title: string; section?: string; quote: string; checked: boolean; how: "search" | "link" | "meaning"; from?: string }
/** Something Axis proposed on the Atlas (T101): a new note, a change to one, or a move. Nothing is written until it is accepted. */
export type Proposal =
  | { kind: "create"; id: string; type: string; title: string; description: string; tags: string[]; body: string }
  | { kind: "change"; id: string; title: string; edits: { old: string; new: string }[] }
  | { kind: "move"; from: string; to: string; title: string; links: number };
export interface AtlasAnswer { question: string; answer: string; used: Used[]; steps: Step[]; code: Source[]; model: string; tier: Tier; cost: number; spent?: { calls: number; input: number; output: number; cached: number };
  /** Where a limit shaped the answer (T110). */ notices?: string[]; proposals?: Proposal[] }

/** Ask; resolves with the answer and, where the learner record is on, the id it is kept under (T94). */
export const askAtlas = async (body: { question: string; start?: string; tier?: Tier; may?: { propose?: boolean } }, onText: (soFar: string) => void, signal?: AbortSignal, onStep?: (step: Step) => void, token?: string | null): Promise<{ answer: AtlasAnswer; kept: string | null }> => {
  const done = await events<{ answer: AtlasAnswer; kept?: string | null }>("api/atlas/ask", body, onText, signal, onStep, token);
  return { answer: done.answer, kept: done.kept ?? null };
};

/** Accept one proposal: the note is written, changed or moved, with the model named in its stamp. */
export async function acceptProposal(proposal: Proposal, model: string, token: string | null): Promise<{ kind: Proposal["kind"]; id: string }> {
  const r = await fetch("api/atlas/proposals", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "x-rdstudio-token": token } : {}) }, body: JSON.stringify({ proposal, model }) });
  const j = (await r.json().catch(() => null)) as { error?: string; kind?: Proposal["kind"]; id?: string } | null;
  if (!r.ok || !j?.id) throw new Error(j?.error ?? `HTTP ${r.status}`);
  return { kind: j.kind!, id: j.id };
}

// What agents outside the app did in the base (T107): sessions of the MCP server and of a harness's file tools.
export interface AgentSession { id: string; client: string; sources: ("mcp" | "hook")[]; started: string; last: string; steps: number; notes: number; wrote: number }
export interface AgentEvent { at: string; source: "mcp" | "hook"; step: Step; session?: string; client?: string }
export const agentSessions = (): Promise<{ enabled: boolean; quietMs: number; sessions: AgentSession[] }> => got("api/agents/sessions");
export const agentSession = (id: string): Promise<{ id: string; client: string; events: AgentEvent[] }> => got(`api/agents/sessions/${encodeURIComponent(id)}`);
export const forgetAgentSession = (id: string, token: string | null): Promise<{ id: string }> =>
  got(`api/agents/sessions/${encodeURIComponent(id)}`, { method: "DELETE", headers: token ? { "x-rdstudio-token": token } : {} });
/** Listen for what agents do from now on. Returns a function that stops listening. The browser connects again by itself if the stream drops. */
export function followAgents(onStep: (e: AgentEvent & { session: string; client: string }) => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const es = new EventSource("api/agents/live");
  es.addEventListener("step", (m) => { try { onStep(JSON.parse((m as MessageEvent).data)); } catch { /* not ours */ } });
  return () => es.close();
}

// From the app to a terminal agent (T109): what was sent, and whether an agent has taken it.
export interface SentToAgent { id: string; at: string; text: string; ref?: string; kind?: "note" | "folder"; taken?: { by: string; at: string } }
export const sentToAgent = (): Promise<{ sent: SentToAgent[] }> => got("api/agents/inbox");
export const sendToAgent = (body: { text: string; ref?: string }, token: string | null): Promise<SentToAgent> =>
  got("api/agents/inbox", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "x-rdstudio-token": token } : {}) }, body: JSON.stringify(body) });
export const unsendToAgent = (id: string, token: string | null): Promise<{ id: string }> =>
  got(`api/agents/inbox/${encodeURIComponent(id)}`, { method: "DELETE", headers: token ? { "x-rdstudio-token": token } : {} });

// The questions kept in the learner record (T94).
export interface AskFrom { ref: string; kind: "note" | "folder" }
export interface AskSummary { id: string; at: string; question: string; from: AskFrom | null; tier: Tier; model: string; cost: number; notes: number }
/** What is no longer as it was when a kept question was answered. */
export interface AskSince { gone: string[]; changed: string[]; links: { from: string; to: string }[]; quotes: Record<string, boolean> }
export interface KeptAsk { id: string; at: string; from: AskFrom | null; answer: AtlasAnswer; since: AskSince }

const got = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(path, { cache: "no-store", ...init });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${r.status}`);
  return (await r.json()) as T;
};
export const keptChats = (note: string): Promise<{ enabled: boolean; chats: ChatSummary[] }> => got(`api/assist/chats?note=${encodeURIComponent(note)}`);
export const keptChat = (id: string): Promise<Chat> => got(`api/assist/chats/${encodeURIComponent(id)}`);
export const forgetChat = (id: string, token: string | null): Promise<{ id: string }> =>
  got(`api/assist/chats/${encodeURIComponent(id)}`, { method: "DELETE", headers: token ? { "x-rdstudio-token": token } : {} });
export const keptAsks = (): Promise<{ enabled: boolean; asks: AskSummary[] }> => got("api/atlas/asks");
export const keptAsk = (id: string): Promise<KeptAsk> => got(`api/atlas/asks/${encodeURIComponent(id)}`);
export const forgetAsk = (id: string, token: string | null): Promise<{ id: string }> =>
  got(`api/atlas/asks/${encodeURIComponent(id)}`, { method: "DELETE", headers: token ? { "x-rdstudio-token": token } : {} });

/** An Atlas answer while it is being written: its text, without the tags round it or the list after it. */
export const streamingAnswer = (s: string): string => s.replace(/<used>[\s\S]*$/i, "").replace(/<\/?answer>\n?/gi, "").replace(/<\/?[a-z]*$/i, "").trim();

/** A fill's reply while it is being written: the proposed text, without the tags round it. */
export const streamingFill = (s: string): string => s.replace(/<\/?insert>\n?/g, "").replace(/<why>[\s\S]*$/, "").trim();
