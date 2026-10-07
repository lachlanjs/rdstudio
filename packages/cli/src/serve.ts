// rdstudio serve: the dashboard's files, the private learner record's API, and
// a rebuild whenever a source changes. A port of src/rdstudio/serve.py on Hono.
//
// Writes (to the learner record, and edits to notes) are accepted only from
// the dashboard's own pages: the Origin must match the Host, the body must be
// JSON, and the request must carry the token handed out by GET (which other
// sites cannot read). When bound to localhost, the API answers only to
// localhost names, Tailscale names (*.ts.net, which `tailscale serve` passes
// through) and --allow-host names, against DNS rebinding.

import { codeStamp } from "./code.ts";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { serve as nodeServe } from "@hono/node-server";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { MAX_EVENT_BYTES } from "@rdstudio/core";
import { build, WEB_DIR } from "./build.ts";
import type { Config } from "./config.ts";
import { ConflictError, noteSource, saveNote } from "./edit.ts";
import { deleteFolder, deleteNote, moveFolder, moveNote } from "./reshape.ts";
import { StoreError, existingNotePath } from "./store.ts";
import * as learner from "./learner.ts";
import * as teacher from "./teacher.ts";
import * as models from "./models.ts";
import * as tutor from "./tutor.ts";
import * as assist from "./assist.ts";
import * as atlasask from "./atlasask.ts";
import * as embed from "./embed.ts";
import { ArtifactError, SANDBOX, artifactPath, keepPreview, preview, saveArtifact } from "./artifacts.ts";
import { streamSSE } from "hono/streaming";
import { historySince } from "./gitlog.ts";
import { pyDumps } from "./pyjson.ts";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
// Text worth compressing: on a slow link the dashboard's scripts and data shrink to about a third.
const COMPRESSIBLE = [".html", ".js", ".mjs", ".css", ".json", ".md", ".svg", ".txt", ".webmanifest", ".map"];
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".md": "text/markdown", ".svg": "image/svg+xml", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json", ".map": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/vnd.microsoft.icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".pdf": "application/pdf",
  ".wasm": "application/wasm", ".csv": "text/csv", ".xml": "text/xml", ".mp4": "video/mp4", ".webm": "video/webm",
};
const gzipped = new Map<string, Buffer>();

export interface ServerOptions {
  cfg: Config;
  site: string;
  token: string;
  loopback: boolean;
  allowHosts?: Iterable<string>;
  /** Refuse edits to notes (rdstudio serve --read-only). */
  readOnly?: boolean;
  /** Called after a note is written, before the reply: rebuild the site. */
  onWrite?: () => void;
}

const MAX_NOTE_BYTES = 2_000_000;

// ------------------------------------------------------------------ learner API (documented as OpenAPI)

const ErrorBody = z.object({ error: z.string() }).openapi("Error");
const Event = z.record(z.string(), z.unknown()).openapi("LearnerEvent", {
  description: "One event: `event` (a name), optionally `concept`, `hash`, `kind` (autodidactic, interactive or ai), `id` and `device`; the server stamps `at`.",
});
const State = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when writing." }),
  dir: z.string().nullable(),
  events: z.array(Event),
  weekDays: z.number().int().openapi({ description: "Days a week must count for a weekly streak ([learner] week_days, default 4)." }),
}).openapi("LearnerState");

const getLearner = createRoute({
  method: "get", path: "/api/learner", summary: "The learner record: whether it is on, a write token, and every event",
  responses: {
    200: { description: "The record", content: { "application/json": { schema: State } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const postLearner = createRoute({
  method: "post", path: "/api/learner", summary: "Append one event to the learner record",
  request: {
    headers: z.object({ "x-rdstudio-token": z.string() }),
    body: { content: { "application/json": { schema: Event } }, required: true },
  },
  responses: {
    200: { description: "The event as stored", content: { "application/json": { schema: Event } } },
    400: { description: "Not a valid event", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
    413: { description: "Event too large", content: { "application/json": { schema: ErrorBody } } },
    415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
  },
});

const Tour = z.object({
  name: z.string().openapi({ description: "Lowercase letters, digits and dashes." }),
  title: z.string(),
  description: z.string(),
  body: z.string().openapi({ description: "Markdown: a list whose items each start with a link to a stop, then its narration." }),
}).openapi("PrivateTour");
const TourName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" } }) });
const TourSave = z.object({ title: z.string(), description: z.string().optional(), body: z.string() }).openapi("PrivateTourSave");
const tourErrors = {
  400: { description: "Not a valid tour", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};
const getTours = createRoute({
  method: "get", path: "/api/learner/tours", summary: "Your private tours (none while the learner record is off)",
  responses: {
    200: { description: "The tours", content: { "application/json": { schema: z.array(Tour) } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const putTour = createRoute({
  method: "put", path: "/api/learner/tours/{name}", summary: "Write one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: TourSave } }, required: true } },
  responses: { 200: { description: "The tour as saved", content: { "application/json": { schema: Tour } } }, ...tourErrors },
});
const deleteTourRoute = createRoute({
  method: "delete", path: "/api/learner/tours/{name}", summary: "Delete one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ name: z.string() }) } } }, ...tourErrors },
});

// ------------------------------------------------------------------ notes API

// ------------------------------------------------------------------ teacher API

const SkillInfo = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(["default", "changed", "own"]).openapi({ description: "rdstudio's default, customised here, or written here with no default." }),
  defaultChanged: z.boolean().openapi({ description: "Customised, and rdstudio's default has changed since." }),
}).openapi("SkillInfo");
const SkillSchema = SkillInfo.extend({
  text: z.string().openapi({ description: "What the agent reads." }),
  default: z.string().nullable().openapi({ description: "rdstudio's current default." }),
  base: z.string().nullable().openapi({ description: "The default the customisation was made from." }),
}).openapi("Skill");
const TeacherState = z.object({
  enabled: z.boolean().openapi({ description: "Whether the teacher folder can be written (the learner record is on)." }),
  profile: z.enum(["topic", "codebase", "project"]),
  profileSet: z.boolean().openapi({ description: "False when guessed: set it in rdstudio.toml ([teacher] profile) or with rdstudio teacher profile." }),
  guessed: z.enum(["topic", "codebase", "project"]).openapi({ description: "What the profile would be if it were not set: a codebase where the repository holds code, else a topic." }),
  dir: z.string().nullable(),
  skills: z.array(SkillInfo),
  history: z.array(z.object({ at: z.string(), message: z.string(), commit: z.string() })).openapi({ description: "The teacher folder's commits, newest first." }),
}).openapi("TeacherState");
const TeacherFileSchema = z.object({
  name: z.enum(["profile.md", "sources.md", "next.md"]),
  text: z.string().nullable().openapi({ description: "Null until written." }),
  history: z.array(z.object({ at: z.string(), message: z.string(), commit: z.string() })),
}).openapi("TeacherFile");
const FileName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" }, description: "profile.md, sources.md or next.md" }) });
const FileSave = z.object({ text: z.string() }).openapi("TeacherFileSave");
const SkillName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" } }) });
const SkillSave = z.object({ text: z.string() }).openapi("SkillSave");
const SkillReset = z.object({ skill: SkillSchema.nullable() }).openapi("SkillReset");
const teacherErrors = {
  400: { description: "Bad name or text", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
};
const getTeacher = createRoute({
  method: "get", path: "/api/teacher", summary: "The teacher: profile, skills (default or customised), and its recent history",
  responses: { 200: { description: "The teacher", content: { "application/json": { schema: TeacherState } } }, 403: teacherErrors[403] },
});
const getSkill = createRoute({
  method: "get", path: "/api/teacher/skills/{name}", summary: "One skill as the agent reads it, with rdstudio's default",
  request: { params: SkillName },
  responses: {
    200: { description: "The skill", content: { "application/json": { schema: SkillSchema } } },
    403: teacherErrors[403], 404: { description: "No such skill", content: { "application/json": { schema: ErrorBody } } },
  },
});
const putSkill = createRoute({
  method: "put", path: "/api/teacher/skills/{name}", summary: "Customise a skill (or write one of your own)",
  request: { params: SkillName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: SkillSave } }, required: true } },
  responses: { 200: { description: "Saved", content: { "application/json": { schema: SkillSchema } } }, ...teacherErrors },
});
const getTeacherFile = createRoute({
  method: "get", path: "/api/teacher/files/{name}", summary: "One of the teacher's files about you: the profile or the sources log",
  request: { params: FileName },
  responses: { 200: { description: "The file", content: { "application/json": { schema: TeacherFileSchema } } }, ...teacherErrors },
});
const putTeacherFile = createRoute({
  method: "put", path: "/api/teacher/files/{name}", summary: "Edit one of the teacher's files (to dispute a claim, say); agents see the edit",
  request: { params: FileName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: FileSave } }, required: true } },
  responses: { 200: { description: "Saved", content: { "application/json": { schema: TeacherFileSchema } } }, ...teacherErrors },
});
const DraftVersionSchema = z.object({ id: z.string(), at: z.string(), reason: z.string(), text: z.string(), working: z.string() }).openapi("DraftVersion");
const DraftSchema = z.object({
  exercise: z.string(), text: z.string(), working: z.string(), updated: z.string().nullable(), versions: z.array(DraftVersionSchema),
  turns: z.array(z.record(z.string(), z.unknown())).openapi({ description: "The teacher's replies while working together, oldest first." }),
}).openapi("Draft");
const DraftId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "The exercise's note id (slashes encoded)." }) });
const writeHeader = z.object({ "x-rdstudio-token": z.string() });
const draftRoute = (method: "put" | "post", path: string, summary: string, body: z.ZodTypeAny) => createRoute({
  method, path, summary,
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: body } }, required: true } },
  responses: { 200: { description: "The draft", content: { "application/json": { schema: DraftSchema } } }, ...teacherErrors },
});
const DraftSummarySchema = z.object({
  exercise: z.string(), updated: z.string().nullable(), excerpt: z.string(), hints: z.number(), turns: z.number(), versions: z.number(),
}).openapi("DraftSummary");
const listDraftsRoute = createRoute({
  method: "get", path: "/api/teacher/drafts", summary: "Your drafts in progress, most recently touched first",
  responses: { 200: { description: "The drafts", content: { "application/json": { schema: z.array(DraftSummarySchema) } } }, ...teacherErrors },
});
const getDraft = createRoute({
  method: "get", path: "/api/teacher/drafts/{id}", summary: "Your draft answer to an exercise, with its kept versions",
  request: { params: DraftId },
  responses: { 200: { description: "The draft (empty if none)", content: { "application/json": { schema: DraftSchema } } }, ...teacherErrors },
});
const putDraft = draftRoute("put", "/api/teacher/drafts/{id}", "Save the draft as it is now (as you type)",
  z.object({ text: z.string(), working: z.string().optional() }).openapi("DraftSave"));
const keepDraftVersion = draftRoute("post", "/api/teacher/drafts/{id}/versions", "Keep the draft as it is now as a version",
  z.object({ reason: z.string().optional() }).openapi("DraftKeep"));
const restoreDraft = draftRoute("post", "/api/teacher/drafts/{id}/restore", "Restore a kept version (the draft as it is now is kept first)",
  z.object({ version: z.string() }).openapi("DraftRestore"));
const fileDraftRoute = createRoute({
  method: "post", path: "/api/teacher/drafts/{id}/submitted", summary: "The answer was submitted: file the draft under the attempt",
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: z.object({ attempt: z.string() }).openapi("DraftSubmitted") } }, required: true } },
  responses: { 200: { description: "Filed", content: { "application/json": { schema: z.object({ filed: z.string().nullable() }).openapi("DraftFiled") } } }, ...teacherErrors },
});
const Money = z.record(z.string(), z.number());
const AiState = z.object({
  connected: z.boolean(),
  from: z.enum(["environment", "file", "command", "none"]).nullable().openapi({ description: "Where the key comes from." }),
  provider: z.object({ name: z.string(), host: z.string(), custom: z.boolean().openapi({ description: "True for a gateway set in the user config ([teacher.provider]); false for OpenRouter." }),
    priced: z.boolean().openapi({ description: "Whether spending can be known: OpenRouter reports it; a gateway needs prices set." }) }),
  models: z.record(z.string(), z.string()).openapi({ description: "The model for each job ([teacher.models] in the user config)." }),
  tiers: z.object({ low: z.string(), mid: z.string(), max: z.string() }).openapi({ description: "The model for each tier Axis may be asked at in the editor ([teacher.tiers] in the user config)." }),
  spending: z.object({
    budget: z.number(), spent: z.number(), left: z.number(), warn: z.boolean(), stopped: z.boolean(), weekStart: z.string(),
    byFeature: Money, byModel: Money, byExercise: Money, calls: z.number(),
  }),
}).openapi("AiState");
const getAi = createRoute({
  method: "get", path: "/api/teacher/ai", summary: "Whether a model account is connected, the models by job, and this week's spending",
  responses: { 200: { description: "The state", content: { "application/json": { schema: AiState } } }, 403: teacherErrors[403] },
});
const putTiers = createRoute({
  method: "put", path: "/api/teacher/tiers",
  summary: "Set the model for each tier (low, mid, max) Axis may be asked at in the editor. Written to [teacher.tiers] in the user config, so it is the person's, across projects.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ low: z.string().optional(), mid: z.string().optional(), max: z.string().optional() }).openapi("TiersSet") } }, required: true } },
  responses: { 200: { description: "Set", content: { "application/json": { schema: AiState } } },
    400: { description: "Not a model's id", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } } },
});
const connectAi = createRoute({
  method: "post", path: "/api/teacher/ai/connect", summary: "Start connecting an OpenRouter account: the address to send the browser to",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Where to go", content: { "application/json": { schema: z.object({ url: z.string() }).openapi("AiConnect") } } }, ...teacherErrors },
});
const disconnectAi = createRoute({
  method: "delete", path: "/api/teacher/ai", summary: "Forget the OpenRouter key kept here",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Forgotten", content: { "application/json": { schema: AiState } } }, ...teacherErrors },
});
const checkAi = createRoute({
  method: "post", path: "/api/teacher/ai/check", summary: "Check the connection with a tiny request (its cost is logged as \"check\")",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "The reply", content: { "application/json": { schema: z.object({ text: z.string(), model: z.string(), cost: z.number() }).openapi("AiCheck") } } }, ...teacherErrors },
});
const askTutor = createRoute({
  method: "post", path: "/api/teacher/tutor/{id}",
  summary: "Ask the teacher about your draft (hint, feedback or discuss); the reply streams as server-sent events: text, then done with the turn, or error",
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: z.object({
    mode: z.enum(["hint", "feedback", "discuss"]), text: z.string(), working: z.string().optional(),
    prompt: z.string().optional(), selection: z.string().optional(), confidence: z.string().optional(),
  }).openapi("TutorAsk") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } }, ...teacherErrors },
});
const ArtifactPath = z.object({ path: z.string().openapi({ param: { name: "path", in: "path" }, description: "The artifact's path in the knowledge base, URL-encoded: design%2Ffigure.html" }) });
const putArtifact = createRoute({
  method: "put", path: "/api/artifacts/{path}", summary: "Write an artifact made in the app (an HTML file beside the notes); refused where a file is already there unless `replace`",
  request: { params: ArtifactPath, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ html: z.string(), replace: z.boolean().optional(), author: z.string().optional() }).openapi("ArtifactSave") } }, required: true } },
  responses: { 200: { description: "Written", content: { "application/json": { schema: z.object({ path: z.string(), bytes: z.number() }).openapi("ArtifactSaved") } } },
    400: { description: "Not an artifact's path", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "A file is already there", content: { "application/json": { schema: ErrorBody } } } },
});
const previewArtifact = createRoute({
  method: "post", path: "/api/artifacts/preview", summary: "Hold an artifact that is not saved yet, to be looked at and checked: it is served like a saved one from the address returned, for a while",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ path: z.string(), html: z.string() }).openapi("ArtifactPreview") } }, required: true } },
  responses: { 200: { description: "Held", content: { "application/json": { schema: z.object({ url: z.string() }).openapi("ArtifactPreviewed") } } },
    400: { description: "Not an artifact's path", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } } },
});
const deleteSkill = createRoute({
  method: "delete", path: "/api/teacher/skills/{name}", summary: "Reset a skill to rdstudio's default (a skill of your own is deleted)",
  request: { params: SkillName, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Reset", content: { "application/json": { schema: SkillReset } } }, ...teacherErrors },
});

const Meta = z.record(z.string(), z.unknown()).openapi("NoteMeta", { description: "Frontmatter fields." });
const NoteSourceSchema = z.object({
  id: z.string(),
  path: z.string().openapi({ description: "Relative to the knowledge folder." }),
  version: z.string().openapi({ description: "Of the whole file; send it back as `base` when saving." }),
  meta: Meta,
  frontmatter: z.string().openapi({ description: "The YAML between the --- lines." }),
  body: z.string().openapi({ description: "Everything after the frontmatter, verbatim." }),
}).openapi("NoteSource");
const EditState = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when saving." }),
  actor: z.string().openapi({ description: "Who edits are attributed to, such as human:lachlan." }),
}).openapi("EditState");
const SaveBody = z.object({
  base: z.string().nullable().openapi({ description: "The version the edit started from; null creates the note." }),
  body: z.string().nullable().optional(),
  meta: Meta.nullable().optional().openapi({ description: "Fields to set; null removes one." }),
  assist: z.array(z.string()).optional().openapi({ description: "Models whose proposed text was accepted into this edit: named in the note's stamp." }),
}).openapi("NoteSave");
const SaveReply = z.object({
  note: NoteSourceSchema, created: z.boolean(), changed: z.boolean(), significant: z.boolean(),
}).openapi("NoteSaved");
const Conflict = z.object({ error: z.string(), current: NoteSourceSchema.nullable() }).openapi("NoteConflict");
const NoteId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "The note's id, such as design/model (slashes encoded)." }) });

const History = z.object({
  available: z.boolean().openapi({ description: "Whether the project is a git repository." }),
  commits: z.array(z.object({ hash: z.string(), short: z.string(), author: z.string(), date: z.string(), subject: z.string() })),
  diff: z.string().nullable().openapi({ description: "The note then against now, as a unified diff, uncommitted changes included." }),
  base: z.string().nullable(),
  existed: z.boolean(),
}).openapi("NoteHistory");
const getHistory = createRoute({
  method: "get", path: "/api/history/{id}", summary: "What changed in a note since a time: commits and a diff (catching up)",
  request: { params: NoteId, query: z.object({ since: z.string().openapi({ description: "An ISO time, such as when you last looked." }) }) },
  responses: {
    200: { description: "The history", content: { "application/json": { schema: History } } },
    400: { description: "Not a valid note or time", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});

const getEdit = createRoute({
  method: "get", path: "/api/edit", summary: "Whether notes can be edited here, and the token to do it with",
  responses: {
    200: { description: "The editing state", content: { "application/json": { schema: EditState } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
const getNote = createRoute({
  method: "get", path: "/api/notes/{id}", summary: "A note's source, to edit",
  request: { params: NoteId },
  responses: {
    200: { description: "The note", content: { "application/json": { schema: NoteSourceSchema } } },
    400: { description: "Not a valid note id", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
    404: { description: "No such note", content: { "application/json": { schema: ErrorBody } } },
  },
});
const putProfile = createRoute({
  method: "put", path: "/api/teacher/profile",
  summary: "Set the project's profile, and so its mode: topic is Learning; codebase and project are Project. Written to rdstudio.toml ([teacher] profile), so it is the project's, for everyone who opens it.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ profile: z.enum(["topic", "codebase", "project"]) }).openapi("ProfileSet") } }, required: true } },
  responses: { 200: { description: "Set", content: { "application/json": { schema: TeacherState } } },
    400: { description: "Not a profile", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } } },
});
const assistNote = createRoute({
  method: "post", path: "/api/notes/{id}/assist",
  summary: "Ask the connected model about a place in a note being edited (ask), or have text proposed for it (fill). The model may first look things up in the knowledge base and the code. The reply streams as server-sent events: step for each thing looked up, text, then done with the reply, or error. Nothing is written.",
  request: { params: NoteId, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({
    mode: z.enum(["ask", "fill", "figure"]), tier: z.enum(["low", "mid", "max"]).optional().openapi({ description: "How strong a model to ask: the tier's model is used. Left out, the mode's usual tier." }), fix: z.object({ html: z.string(), problems: z.array(z.string()) }).optional(), body: z.string(), from: z.number().int(), to: z.number().int(), prompt: z.string().optional(), title: z.string().optional(),
  }).openapi("NoteAssist") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } },
    400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "No model account is connected", content: { "application/json": { schema: ErrorBody } } } },
});
const askAtlas = createRoute({
  method: "post", path: "/api/atlas/ask",
  summary: "Ask the connected model a question about the project, from the Atlas (T85). It looks things up in the knowledge base and the code, and says which notes its answer rests on. Server-sent events: step for each thing looked up (what the map draws), text, then done with the answer, or error. Nothing is written.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({
    question: z.string(), start: z.string().optional().openapi({ description: "Where the asker is on the map: a note's id or a folder. Left out, the whole map." }), tier: z.enum(["low", "mid", "max"]).optional(),
  }).openapi("AtlasAsk") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } },
    400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "No model account is connected", content: { "application/json": { schema: ErrorBody } } } },
});
const putNote = createRoute({
  method: "put", path: "/api/notes/{id}", summary: "Save an edit to a note, or create it",
  request: {
    params: NoteId,
    headers: z.object({ "x-rdstudio-token": z.string() }),
    body: { content: { "application/json": { schema: SaveBody } }, required: true },
  },
  responses: {
    200: { description: "Saved", content: { "application/json": { schema: SaveReply } } },
    400: { description: "Not a valid edit", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "The note changed since `base` (or exists, when creating): the current note is included", content: { "application/json": { schema: Conflict } } },
    413: { description: "Too large", content: { "application/json": { schema: ErrorBody } } },
    415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
  },
});

const MoveBody = z.object({
  to: z.string().openapi({ description: "The new id, such as philosophy/motivation." }),
  base: z.string().nullable().optional().openapi({ description: "The note's version; refused if it changed since." }),
}).openapi("NoteMove");
const Moved = z.object({
  moved: z.array(z.object({ from: z.string(), to: z.string() })),
  rewritten: z.array(z.string()).openapi({ description: "Files whose links were updated." }),
}).openapi("Moved");
const FolderMoveBody = z.object({ from: z.string(), to: z.string() }).openapi("FolderMove");
const Deleted = z.object({
  deleted: z.string(),
  backlinks: z.array(z.string()).openapi({ description: "Notes that linked to it; those links are now broken." }),
}).openapi("NoteDeleted");
const FolderDeleted = z.object({
  deleted: z.string(),
  notes: z.array(z.string()).openapi({ description: "The notes deleted with it." }),
  backlinks: z.array(z.string()).openapi({ description: "Notes elsewhere that linked into it; those links are now broken." }),
}).openapi("FolderDeleted");
const FolderPath = z.object({ path: z.string().openapi({ param: { name: "path", in: "path" }, description: "The folder, such as design/old (slashes encoded)." }) });
const Token = z.object({ "x-rdstudio-token": z.string() });
const writeErrors = {
  400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The note changed since `base`, or is gone", content: { "application/json": { schema: Conflict } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};

const postMove = createRoute({
  method: "post", path: "/api/notes/{id}/move", summary: "Move or rename a note, updating the links to it",
  request: { params: NoteId, headers: Token, body: { content: { "application/json": { schema: MoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
const deleteNoteRoute = createRoute({
  method: "delete", path: "/api/notes/{id}", summary: "Delete a note",
  request: { params: NoteId, headers: Token, query: z.object({ base: z.string().optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: Deleted } } }, ...writeErrors },
});
const postFolderMove = createRoute({
  method: "post", path: "/api/folders/move", summary: "Move or rename a folder with everything in it, updating links",
  request: { headers: Token, body: { content: { "application/json": { schema: FolderMoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
const deleteFolderRoute = createRoute({
  method: "delete", path: "/api/folders/{path}", summary: "Delete a folder (with the notes in it, given withNotes)",
  request: { params: FolderPath, headers: Token, query: z.object({ withNotes: z.enum(["true", "false"]).optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: FolderDeleted } } }, ...writeErrors },
});

export function createApp({ cfg, site, token, loopback, allowHosts = [], readOnly = false, onWrite }: ServerOptions): OpenAPIHono {
  const allowed = new Set([...allowHosts].map((h) => h.toLowerCase()));
  // No automatic validation: the checks below run in a fixed order, as in the Python server.
  const app = new OpenAPIHono({ defaultHook: () => undefined });

  const hostOk = (c: Context): boolean => {
    let host = "";
    try { host = new URL("http://" + (c.req.header("host") ?? "")).hostname.replace(/^\[|\]$/g, "").toLowerCase(); } catch { /* none */ }
    return !loopback || LOOPBACK.has(host) || host.endsWith(".ts.net") || allowed.has(host);
  };
  const json = (c: Context, status: number, value: unknown, close = false) => {
    const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (close) headers.Connection = "close";
    return c.body(pyDumps(value, { ensureAscii: false }), status as 200, headers);
  };

  app.openapi(getLearner, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const on = learner.enabled(cfg);
    return json(c, 200, { enabled: on, token: on ? token : null, dir: on ? learner.recordDir(cfg) : null, events: on ? learner.events(cfg) : [], weekDays: learner.weekDays() });
  }) as never);

  // A refused body is never read, so that connection is not reused.
  const refuse = (c: Context, status: number, error: string) => json(c, status, { error }, true);
  /** Why a write is refused (the Origin, the token, the content type), or null. */
  const writeRefused = (c: Context, json = true) => {
    let origin = "";
    try { origin = new URL(c.req.header("origin") ?? "").host; } catch { /* no origin */ }
    if (!hostOk(c) || !c.req.header("origin") || origin !== c.req.header("host")) return refuse(c, 403, "cross-origin request refused");
    if (c.req.header("x-rdstudio-token") !== token) return refuse(c, 403, "bad token");
    if (json && !(c.req.header("content-type") ?? "").startsWith("application/json")) return refuse(c, 415, "JSON only");
    return null;
  };

  /** Run a change to the bundle for an endpoint: the checks, then `act`, a
   *  rebuild, and errors as replies. */
  const change = async (c: Context, act: (body: Record<string, unknown>) => unknown, json = true) => {
    const refused = writeRefused(c, json);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: Record<string, unknown> = {};
    if (json) {
      try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return refuse(c, 400, "expected a JSON object");
    }
    try {
      const result = act(body);
      onWrite?.();
      return jsonReply(c, result);
    } catch (err) {
      if (err instanceof ConflictError) return jsonReply(c, { error: err.message, current: err.current }, 409);
      if (err instanceof StoreError || (err as Error).name === "FrontmatterError") return refuse(c, 400, (err as Error).message);
      throw err;
    }
  };
  const jsonReply = (c: Context, value: unknown, status = 200) => json(c, status, value, true);
  const str = (v: unknown, name: string): string => {
    if (typeof v !== "string" || !v) throw new StoreError(`expected '${name}'`);
    return v;
  };

  app.openapi(postLearner, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES) return refuse(c, 413, "event too large");
    const raw = await c.req.text();
    let event: unknown;
    try { event = raw ? JSON.parse(raw) : null; } catch (err) { return refuse(c, 400, (err as Error).message); }
    try {
      return json(c, 200, learner.append(cfg, event), true);
    } catch (err) {
      return refuse(c, 400, (err as Error).message);
    }
  }) as never);

  app.openapi(getTours, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, learner.enabled(cfg) ? learner.tours(cfg) : []);
  }) as never);
  /** A write to your private tours or the teacher folder: the same checks as the record's. */
  const tourChange = async (c: Context, act: (body: Record<string, unknown>) => unknown, withBody = true) => {
    const refused = writeRefused(c, withBody);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    let body: Record<string, unknown> = {};
    if (withBody) {
      try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return refuse(c, 400, "expected a JSON object");
    }
    try {
      return json(c, 200, act(body), true);
    } catch (err) {
      return refuse(c, 400, (err as Error).message);
    }
  };
  app.openapi(putTour, ((c: Context) => tourChange(c, (b) => learner.saveTour(cfg, c.req.param("name") ?? "", b))) as never);
  app.openapi(deleteTourRoute, ((c: Context) => tourChange(c, () => learner.deleteTour(cfg, c.req.param("name") ?? ""), false)) as never);

  const teacherState = () => {
    const on = learner.enabled(cfg), p = teacher.profile(cfg);
    return { enabled: on, profile: p.profile, profileSet: p.set, guessed: teacher.guessProfile(cfg), dir: on ? teacher.teacherDir(cfg) : null,
      skills: teacher.skills(cfg), history: on ? teacher.history(cfg) : [] };
  };
  app.openapi(getTeacher, ((c: Context) => (hostOk(c) ? json(c, 200, teacherState()) : json(c, 403, { error: "host not allowed" }))) as never);
  // The mode, switched from the app (the tag beside the project's name, or Settings): the profile in rdstudio.toml.
  app.openapi(putProfile, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: { profile?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    try { teacher.setProfile(cfg, String(body.profile ?? "")); } catch (err) { return refuse(c, 400, (err as Error).message); }
    onWrite?.(); // whether the code is indexed follows the profile
    return json(c, 200, teacherState(), true);
  }) as never);
  app.openapi(getSkill, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    let found: teacher.Skill | null = null;
    try { found = teacher.skill(cfg, c.req.param("name") ?? ""); } catch { /* a bad name */ }
    return found ? json(c, 200, found) : json(c, 404, { error: "no such skill" });
  }) as never);
  app.openapi(getTeacherFile, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    if (!learner.enabled(cfg)) return json(c, 409, { error: "the learner record is off ([learner] enabled in the user config)" });
    try { return json(c, 200, teacher.readFile(cfg, c.req.param("name") ?? "")); } catch (err) { return json(c, 400, { error: (err as Error).message }); }
  }) as never);
  app.openapi(putTeacherFile, ((c: Context) => tourChange(c, (b) => teacher.writeFile(cfg, c.req.param("name") ?? "", b.text, teacher.BY_DEVELOPER))) as never);
  // ---------------------------------------------------------------- models (OpenRouter)
  const aiState = () => {
    const k = models.apiKey();
    const p = models.provider();
    let host = p.url;
    try { host = new URL(p.url).host; } catch { /* as written */ }
    return { connected: !!k, from: k?.from ?? null, provider: { name: p.custom ? p.name : "OpenRouter", host, custom: p.custom, priced: !p.custom || Object.keys(p.prices).length > 0 },
      models: models.models(), tiers: models.tiers(), spending: models.spending(cfg) };
  };
  app.openapi(getAi, ((c: Context) => (hostOk(c) ? json(c, 200, aiState()) : json(c, 403, { error: "host not allowed" }))) as never);
  // Connecting: OAuth with PKCE. The verifier waits here, by state, for ten minutes.
  const pending = new Map<string, { verifier: string; until: number }>();
  const b64url = (b: Buffer) => b.toString("base64url");
  app.openapi(connectAi, ((c: Context) => tourChange(c, () => {
    if (models.provider().custom) throw new StoreError(`models come from ${models.provider().name}, set in the user config ([teacher.provider]): there is no account to connect here`);
    for (const [k, v] of pending) if (v.until < Date.now()) pending.delete(k);
    const verifier = b64url(randomBytes(32)), state = b64url(randomBytes(16));
    pending.set(state, { verifier, until: Date.now() + 10 * 60_000 });
    const callback = `${new URL(c.req.url).protocol}//${c.req.header("host")}/api/teacher/ai/callback?state=${state}`;
    const q = new URLSearchParams({ callback_url: callback, code_challenge: b64url(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", key_label: "rdstudio" });
    return { url: `https://openrouter.ai/auth?${q}` };
  }, false)) as never);
  app.get("/api/teacher/ai/callback", async (c) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const state = c.req.query("state") ?? "", code = c.req.query("code") ?? "";
    const wait = pending.get(state);
    pending.delete(state);
    const back = (result: string) => c.redirect(`/?ai=${result}#/teacher`);
    if (!wait || wait.until < Date.now() || !code) return back("expired");
    try {
      const res = await fetch(`${models.OPENROUTER}/auth/keys`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, code_verifier: wait.verifier, code_challenge_method: "S256" }) });
      const key = res.ok ? ((await res.json()) as { key?: string }).key : undefined;
      if (!key) return back("refused");
      models.saveKey(key);
      return back("connected");
    } catch {
      return back("failed");
    }
  });
  app.openapi(disconnectAi, ((c: Context) => tourChange(c, () => { if (!models.provider().custom) models.forgetKey(); return aiState(); }, false)) as never);
  app.openapi(putTiers, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const next: Partial<Record<models.Tier, string>> = {};
    for (const t of models.TIERS) if (typeof body[t] === "string") next[t] = body[t] as string;
    try { models.setTiers(next); } catch (err) { return refuse(c, err instanceof models.ModelError ? err.status : 400, (err as Error).message); }
    return json(c, 200, aiState(), true);
  }) as never);
  app.openapi(checkAi, (async (c: Context) => {
    const refused = writeRefused(c, false);
    if (refused) return refused;
    try {
      const r = await models.complete({ cfg, job: "check", maxTokens: 10, messages: [{ role: "user", content: "Reply with the one word: ready" }] });
      return json(c, 200, { text: r.text.trim(), model: r.usage.model, cost: r.usage.cost }, true);
    } catch (err) {
      if (err instanceof models.ModelError) return refuse(c, err.status, err.message);
      throw err;
    }
  }) as never);

  app.openapi(askTutor, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (!learner.enabled(cfg)) return refuse(c, 409, "the learner record is off ([learner] enabled in the user config)");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const a: tutor.Ask = { exercise: c.req.param("id") ?? "", mode: body.mode as tutor.Mode, text: str(body.text) ?? "", working: str(body.working),
      prompt: str(body.prompt), selection: str(body.selection), confidence: str(body.confidence) };
    // Problems found before anything is sent are plain errors; after, they are events.
    if (!(tutor.MODES as readonly string[]).includes(a.mode)) return refuse(c, 400, `a mode is one of ${tutor.MODES.join(", ")}`);
    if (!models.apiKey()) return refuse(c, 409, "No OpenRouter key: connect an account on the Teacher page.");
    return streamSSE(c, async (stream) => {
      try {
        const { turn, seen } = await tutor.ask(cfg, a, (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ turn, seen }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);

  // An agent in the editor (T74): the note is the editor's text, not the file's, so nothing need be saved first.
  app.openapi(assistNote, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (Number(c.req.header("content-length") ?? 0) > MAX_NOTE_BYTES) return refuse(c, 413, "note too large");
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const str = (v: unknown) => (typeof v === "string" ? v : undefined), num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
    const a: assist.Ask = { note: c.req.param("id") ?? "", mode: body.mode as assist.Mode, body: str(body.body) ?? "", from: num(body.from), to: num(body.to), prompt: str(body.prompt), title: str(body.title) };
    if ((models.TIERS as readonly string[]).includes(body.tier as string)) a.tier = body.tier as models.Tier;
    const fix = body.fix as { html?: unknown; problems?: unknown } | undefined;
    if (fix && typeof fix.html === "string" && Array.isArray(fix.problems)) a.fix = { html: fix.html, problems: fix.problems.filter((x) => typeof x === "string").slice(0, 12) as string[] };
    if (!(assist.MODES as readonly string[]).includes(a.mode)) return refuse(c, 400, `a mode is one of ${assist.MODES.join(", ")}`);
    if (!models.apiKey()) return refuse(c, 409, "No model account is connected: connect one on the Teacher page.");
    try { assist.prepare(cfg, a); } catch (err) { return refuse(c, 400, (err as Error).message); } // what is wrong with the request, before anything is sent
    return streamSSE(c, async (stream) => {
      try {
        const { reply, seen } = await assist.ask(cfg, a, {
          onText: (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); },
          // Something looked up: what was written before it was not the reply, so the text starts again.
          onStep: (step) => { void stream.writeSSE({ event: "step", data: JSON.stringify(step) }); },
        });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ reply, seen }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);

  // Ask Atlas (T85): the same lookups, asked from the map.
  app.openapi(askAtlas, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    let body: Record<string, unknown>;
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const q: atlasask.Question = { question: typeof body.question === "string" ? body.question : "", start: typeof body.start === "string" ? body.start : undefined };
    if ((models.TIERS as readonly string[]).includes(body.tier as string)) q.tier = body.tier as models.Tier;
    if (!models.apiKey()) return refuse(c, 409, "No model account is connected: connect one on the Axis page.");
    try { atlasask.prepare(cfg, q); } catch (err) { return refuse(c, 400, (err as Error).message); }
    return streamSSE(c, async (stream) => {
      try {
        const { answer, seen } = await atlasask.ask(cfg, q, {
          onText: (piece) => { void stream.writeSSE({ event: "text", data: JSON.stringify(piece) }); },
          onStep: (step) => { void stream.writeSSE({ event: "step", data: JSON.stringify(step) }); },
        });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ answer, seen }) });
      } catch (err) {
        await stream.writeSSE({ event: "error", data: JSON.stringify((err as Error).message) });
      }
    });
  }) as never);

  app.openapi(listDraftsRoute, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, learner.enabled(cfg) ? teacher.listDrafts(cfg) : []);
  }) as never);
  app.openapi(getDraft, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    if (!learner.enabled(cfg)) return json(c, 409, { error: "the learner record is off ([learner] enabled in the user config)" });
    try { return json(c, 200, teacher.readDraft(cfg, c.req.param("id") ?? "")); } catch (err) { return json(c, 400, { error: (err as Error).message }); }
  }) as never);
  const draftId = (c: Context) => c.req.param("id") ?? "";
  app.openapi(putDraft, ((c: Context) => tourChange(c, (b) => teacher.saveDraft(cfg, draftId(c), b))) as never);
  app.openapi(keepDraftVersion, ((c: Context) => tourChange(c, (b) => teacher.keepVersion(cfg, draftId(c), b.reason))) as never);
  app.openapi(restoreDraft, ((c: Context) => tourChange(c, (b) => teacher.restoreVersion(cfg, draftId(c), b.version))) as never);
  app.openapi(fileDraftRoute, ((c: Context) => tourChange(c, (b) => teacher.fileDraft(cfg, draftId(c), b.attempt))) as never);
  app.openapi(putSkill, ((c: Context) => tourChange(c, (b) => teacher.saveSkill(cfg, c.req.param("name") ?? "", b.text))) as never);
  app.openapi(deleteSkill, ((c: Context) => tourChange(c, () => ({ skill: teacher.resetSkill(cfg, c.req.param("name") ?? "") }), false)) as never);

  const actor = cfg.human || "human:unknown";
  app.openapi(getEdit, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    return json(c, 200, { enabled: !readOnly, token: readOnly ? null : token, actor });
  }) as never);

  app.openapi(getHistory, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    const since = c.req.query("since") ?? "";
    if (Number.isNaN(Date.parse(since))) return json(c, 400, { error: "'since' is an ISO time" });
    try {
      const path = existingNotePath(cfg.knowledgeDir, c.req.param("id") ?? "");
      return json(c, 200, historySince(cfg.root, relative(cfg.root, path).split("\\").join("/"), new Date(since).toISOString()));
    } catch (err) {
      return json(c, 400, { error: (err as Error).message });
    }
  }) as never);

  app.openapi(getNote, ((c: Context) => {
    if (!hostOk(c)) return json(c, 403, { error: "host not allowed" });
    try {
      return json(c, 200, noteSource(cfg.knowledgeDir, c.req.param("id") ?? ""));
    } catch (err) {
      return json(c, String((err as Error).message).startsWith("no such note") ? 404 : 400, { error: (err as Error).message });
    }
  }) as never);

  app.openapi(postMove, ((c: Context) => change(c, (b) =>
    moveNote(cfg.knowledgeDir, c.req.param("id") ?? "", str(b.to, "to"), typeof b.base === "string" ? b.base : null))) as never);
  app.openapi(deleteNoteRoute, ((c: Context) => change(c, () =>
    deleteNote(cfg.knowledgeDir, c.req.param("id") ?? "", c.req.query("base") ?? null), false)) as never);
  app.openapi(postFolderMove, ((c: Context) => change(c, (b) =>
    moveFolder(cfg.knowledgeDir, str(b.from, "from"), str(b.to, "to")))) as never);
  app.openapi(deleteFolderRoute, ((c: Context) => change(c, () =>
    deleteFolder(cfg.knowledgeDir, c.req.param("path") ?? "", c.req.query("withNotes") === "true"), false)) as never);

  app.openapi(putNote, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    if (Number(c.req.header("content-length") ?? 0) > MAX_NOTE_BYTES) return refuse(c, 413, "note too large");
    let edit: { base?: unknown; body?: unknown; meta?: unknown };
    try { edit = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof edit !== "object" || edit === null || !("base" in edit) || (edit.base !== null && typeof edit.base !== "string")
      || (edit.body != null && typeof edit.body !== "string")
      || (edit.meta != null && (typeof edit.meta !== "object" || Array.isArray(edit.meta)))) {
      return refuse(c, 400, "expected {base, body?, meta?}");
    }
    try {
      const saved = saveNote(cfg.knowledgeDir, c.req.param("id") ?? "", {
        actor, base: edit.base as string | null, body: edit.body as string | null | undefined, meta: edit.meta as Record<string, unknown> | null | undefined,
        assist: Array.isArray((edit as { assist?: unknown }).assist) ? ((edit as { assist: unknown[] }).assist.filter((m) => typeof m === "string") as string[]) : null,
      });
      if (saved.changed) onWrite?.();
      return json(c, 200, saved, true);
    } catch (err) {
      if (err instanceof ConflictError) return json(c, 409, { error: err.message, current: err.current }, true);
      if (err instanceof StoreError || (err as Error).name === "FrontmatterError") return refuse(c, 400, (err as Error).message);
      throw err;
    }
  }) as never);

  app.doc31("/api/openapi.json", { openapi: "3.1.0", info: { title: "rdstudio serve", version: "0.1.0" } });
  // Artifacts made in the app (T78): held to be checked, then written beside the notes.
  app.openapi(previewArtifact, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    let body: { path?: unknown; html?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof body.path !== "string" || typeof body.html !== "string") return refuse(c, 400, "expected {path, html}");
    try { artifactPath(cfg.knowledgeDir, body.path); } catch (err) { return refuse(c, 400, (err as Error).message); }
    const path = body.path.replace(/^\/+/, "");
    return json(c, 200, { url: `p/${keepPreview(path, body.html)}/${path.split("/").map(encodeURIComponent).join("/")}` }, true);
  }) as never);
  app.openapi(putArtifact, (async (c: Context) => {
    const refused = writeRefused(c);
    if (refused) return refused;
    if (readOnly) return refuse(c, 403, "this server is read-only (rdstudio serve --read-only)");
    let body: { html?: unknown; replace?: unknown; author?: unknown };
    try { body = JSON.parse(await c.req.text()); } catch (err) { return refuse(c, 400, (err as Error).message); }
    if (typeof body.html !== "string") return refuse(c, 400, "expected {html}");
    try {
      const made = typeof body.author === "string" && /^[\w./:@ -]{1,160}$/.test(body.author) ? body.author : actor;
      const saved = saveArtifact(cfg.knowledgeDir, c.req.param("path") ?? "", body.html, { author: made, replace: body.replace === true });
      onWrite?.();
      return json(c, 200, saved, true);
    } catch (err) {
      if (err instanceof ArtifactError) return refuse(c, err.status, err.message);
      throw err;
    }
  }) as never);
  app.get("/p/:id/*", (c) => {
    if (!hostOk(c)) return c.text("Host not allowed", 403);
    const html = preview(c.req.param("id"));
    return html === null ? c.text("Not found", 404) : c.body(html, 200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": SANDBOX, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  });

  app.all("/api/*", (c) => json(c, 404, { error: "not found" }));
  app.on(["GET", "HEAD"], "*", (c) => staticFile(c, site));
  return app;
}

// ------------------------------------------------------------------ static files

function cacheControl(path: string): string | null {
  if (path.startsWith("/vendor/")) return "public, max-age=604800"; // changes only when rdstudio is upgraded
  if (path.startsWith("/data/") || /\.(html|js|css)$/.test(path) || path === "/") return "no-cache"; // revalidate (cheap: 304)
  return null;
}

const httpDate = (seconds: number) => new Date(seconds * 1000).toUTCString();

function staticFile(c: Context, site: string): Response {
  const url = new URL(c.req.url);
  let rel: string;
  try { rel = decodeURIComponent(url.pathname); } catch { return c.text("Bad request", 400); }
  let file = resolve(site, "." + rel);
  if (file !== resolve(site) && !file.startsWith(resolve(site) + sep)) return c.text("File not found", 404);
  const headers: Record<string, string> = {};
  const cc = cacheControl(url.pathname);
  if (cc) headers["Cache-Control"] = cc;
  // An artifact is sandboxed, so to it the app's fonts are another origin's: without this it could not load
  // the theme's type. Fonts only: they are rdstudio's own files and say nothing of the project.
  if (/\.(woff2?|ttf|otf)$/i.test(url.pathname)) headers["Access-Control-Allow-Origin"] = "*";
  let st;
  try { st = statSync(file); } catch { return c.body("File not found", 404, headers); }
  if (st.isDirectory()) {
    if (!url.pathname.endsWith("/")) return c.body(null, 301, { ...headers, Location: url.pathname + "/" + url.search });
    file = join(file, "index.html");
    try { st = statSync(file); } catch { return c.body("File not found", 404, headers); }
  }
  if (!st.isFile()) return c.body("File not found", 404, headers);
  const mtime = Math.floor(st.mtimeMs / 1000);
  const since = c.req.header("if-modified-since");
  const gzip = (c.req.header("accept-encoding") ?? "").includes("gzip") && COMPRESSIBLE.some((e) => file.endsWith(e));
  if (gzip) headers.Vary = "Accept-Encoding";
  if (since && !c.req.header("if-none-match")) {
    const t = Date.parse(since);
    if (!Number.isNaN(t) && mtime <= t / 1000) return c.body(null, 304, headers);
  }
  headers["Content-Type"] = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  // An artifact (T76) runs apart from the app, whether framed or opened on its own: no access to the
  // app's page, its storage or the write token.
  if (/^\/a\//.test(url.pathname)) { headers["Content-Security-Policy"] = SANDBOX; headers["X-Content-Type-Options"] = "nosniff"; }
  headers["Last-Modified"] = httpDate(mtime);
  let body: Buffer;
  if (gzip) {
    const key = `${file}\0${st.mtimeMs}\0${st.size}`;
    body = gzipped.get(key) ?? gzipSync(readFileSync(file), { level: 6 });
    if (gzipped.size > 512) gzipped.clear();
    gzipped.set(key, body);
    headers["Content-Encoding"] = "gzip";
  } else {
    body = readFileSync(file);
  }
  headers["Content-Length"] = String(body.length);
  if (c.req.method === "HEAD") return c.body(null, 200, headers);
  return c.body(new Uint8Array(body), 200, headers);
}

// ------------------------------------------------------------------ watching

/** A cheap summary of everything the build reads. */
function fingerprint(cfg: Config): string {
  const stamp: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(p); continue; }
      try { const st = statSync(p); stamp.push(`${p}\0${st.mtimeMs}\0${st.size}`); } catch { /* gone */ }
    }
  };
  for (const root of [cfg.knowledgeDir, cfg.reportsDir, join(cfg.root, ".claude"), WEB_DIR]) walk(root);
  for (const f of [join(cfg.root, "rdstudio.toml"), join(cfg.root, ".git", "HEAD"), join(cfg.root, ".git", "index")]) {
    if (existsSync(f)) { const st = statSync(f); stamp.push(`${f}\0${st.mtimeMs}\0${st.size}`); }
  }
  return stamp.sort().join("\n") + "\n" + codeStamp(cfg); // the code map follows the code
}

const clock = () => new Date().toTimeString().slice(0, 8);

export function serve(cfg: Config, { host = "127.0.0.1", port = 8000, watch = true, allowHosts = [] as string[], readOnly = false } = {}): void {
  const site = build(cfg);
  let last = fingerprint(cfg);
  // After an edit, rebuild at once, so the page sees it on its next look.
  const onWrite = () => {
    try { build(cfg); } catch (err) { console.error(`[${clock()}] build failed: ${(err as Error).message}`); }
    last = fingerprint(cfg);
    embed.refreshInBackground(cfg); // the sections that changed, for search by meaning (T89); the save does not wait
  };
  embed.refreshInBackground(cfg); // and whatever changed while this was not running
  const app = createApp({ cfg, site, token: randomBytes(24).toString("base64url"), loopback: LOOPBACK.has(host), allowHosts, readOnly, onWrite });
  const server = nodeServe({ fetch: app.fetch, hostname: host, port });
  if (watch) {
    setInterval(() => {
      const current = fingerprint(cfg);
      if (current === last) return;
      try {
        build(cfg);
        console.log(`[${clock()}] rebuilt`);
      } catch (err) {
        console.error(`[${clock()}] build failed: ${(err as Error).message}`); // keep serving the last good build
      }
      last = fingerprint(cfg); // the build may regenerate index.md files
    }, 1000).unref();
  }
  const shown = host === "127.0.0.1" || host === "0.0.0.0" ? "localhost" : host;
  console.log(`Serving ${cfg.title} at http://${shown}:${port}/  (Ctrl+C to stop)`);
  if (host === "0.0.0.0") console.log("Listening on all interfaces (reachable over your tailnet/LAN).");
  if (!readOnly) console.log("Notes can be edited from the dashboard (--read-only to turn that off).");
  const stop = () => { server.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

