// What rdstudio serve's API is: each route's address, what it takes and what it
// answers, as zod schemas, from which the OpenAPI description and the app's
// typed client are made (npm run generate). What each route does is in the
// files beside this one, by area.

import { createRoute, z } from "@hono/zod-openapi";

export const ErrorBody = z.object({ error: z.string() }).openapi("Error");
export const Event = z.record(z.string(), z.unknown()).openapi("LearnerEvent", {
  description: "One event: `event` (a name), optionally `concept`, `hash`, `kind` (autodidactic, interactive or ai), `id` and `device`; the server stamps `at`.",
});
export const State = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when writing." }),
  dir: z.string().nullable(),
  events: z.array(Event),
  weekDays: z.number().int().openapi({ description: "Days a week must count for a weekly streak ([learner] week_days, default 4)." }),
}).openapi("LearnerState");

export const getLearner = createRoute({
  method: "get", path: "/api/learner", summary: "The learner record: whether it is on, a write token, and every event",
  responses: {
    200: { description: "The record", content: { "application/json": { schema: State } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
export const postLearner = createRoute({
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

export const Tour = z.object({
  name: z.string().openapi({ description: "Lowercase letters, digits and dashes." }),
  title: z.string(),
  description: z.string(),
  body: z.string().openapi({ description: "Markdown: a list whose items each start with a link to a stop, then its narration." }),
}).openapi("PrivateTour");
export const TourName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" } }) });
export const TourSave = z.object({ title: z.string(), description: z.string().optional(), body: z.string() }).openapi("PrivateTourSave");
export const tourErrors = {
  400: { description: "Not a valid tour", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};
export const getTours = createRoute({
  method: "get", path: "/api/learner/tours", summary: "Your private tours (none while the learner record is off)",
  responses: {
    200: { description: "The tours", content: { "application/json": { schema: z.array(Tour) } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
export const putTour = createRoute({
  method: "put", path: "/api/learner/tours/{name}", summary: "Write one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: TourSave } }, required: true } },
  responses: { 200: { description: "The tour as saved", content: { "application/json": { schema: Tour } } }, ...tourErrors },
});
export const deleteTourRoute = createRoute({
  method: "delete", path: "/api/learner/tours/{name}", summary: "Delete one of your private tours",
  request: { params: TourName, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ name: z.string() }) } } }, ...tourErrors },
});

// ------------------------------------------------------------------ notes API

// ------------------------------------------------------------------ teacher API

export const SkillInfo = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(["default", "changed", "own"]).openapi({ description: "rdstudio's default, customised here, or written here with no default." }),
  defaultChanged: z.boolean().openapi({ description: "Customised, and rdstudio's default has changed since." }),
}).openapi("SkillInfo");
export const SkillSchema = SkillInfo.extend({
  text: z.string().openapi({ description: "What the agent reads." }),
  default: z.string().nullable().openapi({ description: "rdstudio's current default." }),
  base: z.string().nullable().openapi({ description: "The default the customisation was made from." }),
}).openapi("Skill");
export const TeacherState = z.object({
  enabled: z.boolean().openapi({ description: "Whether the teacher folder can be written (the learner record is on)." }),
  profile: z.enum(["topic", "codebase", "project"]),
  profileSet: z.boolean().openapi({ description: "False when guessed: set it in rdstudio.toml ([teacher] profile) or with rdstudio teacher profile." }),
  guessed: z.enum(["topic", "codebase", "project"]).openapi({ description: "What the profile would be if it were not set: a codebase where the repository holds code, else a topic." }),
  dir: z.string().nullable(),
  skills: z.array(SkillInfo),
  history: z.array(z.object({ at: z.string(), message: z.string(), commit: z.string() })).openapi({ description: "The teacher folder's commits, newest first." }),
}).openapi("TeacherState");
export const TeacherFileSchema = z.object({
  name: z.enum(["profile.md", "sources.md", "next.md"]),
  text: z.string().nullable().openapi({ description: "Null until written." }),
  history: z.array(z.object({ at: z.string(), message: z.string(), commit: z.string() })),
}).openapi("TeacherFile");
export const FileName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" }, description: "profile.md, sources.md or next.md" }) });
export const FileSave = z.object({ text: z.string() }).openapi("TeacherFileSave");
export const SkillName = z.object({ name: z.string().openapi({ param: { name: "name", in: "path" } }) });
export const SkillSave = z.object({ text: z.string() }).openapi("SkillSave");
export const SkillReset = z.object({ skill: SkillSchema.nullable() }).openapi("SkillReset");
export const teacherErrors = {
  400: { description: "Bad name or text", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The learner record is off", content: { "application/json": { schema: ErrorBody } } },
};
export const getTeacher = createRoute({
  method: "get", path: "/api/teacher", summary: "The teacher: profile, skills (default or customised), and its recent history",
  responses: { 200: { description: "The teacher", content: { "application/json": { schema: TeacherState } } }, 403: teacherErrors[403] },
});
export const getSkill = createRoute({
  method: "get", path: "/api/teacher/skills/{name}", summary: "One skill as the agent reads it, with rdstudio's default",
  request: { params: SkillName },
  responses: {
    200: { description: "The skill", content: { "application/json": { schema: SkillSchema } } },
    403: teacherErrors[403], 404: { description: "No such skill", content: { "application/json": { schema: ErrorBody } } },
  },
});
export const putSkill = createRoute({
  method: "put", path: "/api/teacher/skills/{name}", summary: "Customise a skill (or write one of your own)",
  request: { params: SkillName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: SkillSave } }, required: true } },
  responses: { 200: { description: "Saved", content: { "application/json": { schema: SkillSchema } } }, ...teacherErrors },
});
export const getTeacherFile = createRoute({
  method: "get", path: "/api/teacher/files/{name}", summary: "One of the teacher's files about you: the profile or the sources log",
  request: { params: FileName },
  responses: { 200: { description: "The file", content: { "application/json": { schema: TeacherFileSchema } } }, ...teacherErrors },
});
export const putTeacherFile = createRoute({
  method: "put", path: "/api/teacher/files/{name}", summary: "Edit one of the teacher's files (to dispute a claim, say); agents see the edit",
  request: { params: FileName, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: FileSave } }, required: true } },
  responses: { 200: { description: "Saved", content: { "application/json": { schema: TeacherFileSchema } } }, ...teacherErrors },
});
export const DraftVersionSchema = z.object({ id: z.string(), at: z.string(), reason: z.string(), text: z.string(), working: z.string() }).openapi("DraftVersion");
export const DraftSchema = z.object({
  exercise: z.string(), text: z.string(), working: z.string(), updated: z.string().nullable(), versions: z.array(DraftVersionSchema),
  turns: z.array(z.record(z.string(), z.unknown())).openapi({ description: "The teacher's replies while working together, oldest first." }),
}).openapi("Draft");
export const DraftId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "The exercise's note id (slashes encoded)." }) });
export const writeHeader = z.object({ "x-rdstudio-token": z.string() });
export const draftRoute = (method: "put" | "post", path: string, summary: string, body: z.ZodTypeAny) => createRoute({
  method, path, summary,
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: body } }, required: true } },
  responses: { 200: { description: "The draft", content: { "application/json": { schema: DraftSchema } } }, ...teacherErrors },
});
export const DraftSummarySchema = z.object({
  exercise: z.string(), updated: z.string().nullable(), excerpt: z.string(), hints: z.number(), turns: z.number(), versions: z.number(),
}).openapi("DraftSummary");
export const listDraftsRoute = createRoute({
  method: "get", path: "/api/teacher/drafts", summary: "Your drafts in progress, most recently touched first",
  responses: { 200: { description: "The drafts", content: { "application/json": { schema: z.array(DraftSummarySchema) } } }, ...teacherErrors },
});
export const getDraft = createRoute({
  method: "get", path: "/api/teacher/drafts/{id}", summary: "Your draft answer to an exercise, with its kept versions",
  request: { params: DraftId },
  responses: { 200: { description: "The draft (empty if none)", content: { "application/json": { schema: DraftSchema } } }, ...teacherErrors },
});
export const putDraft = draftRoute("put", "/api/teacher/drafts/{id}", "Save the draft as it is now (as you type)",
  z.object({ text: z.string(), working: z.string().optional() }).openapi("DraftSave"));
export const keepDraftVersion = draftRoute("post", "/api/teacher/drafts/{id}/versions", "Keep the draft as it is now as a version",
  z.object({ reason: z.string().optional() }).openapi("DraftKeep"));
export const restoreDraft = draftRoute("post", "/api/teacher/drafts/{id}/restore", "Restore a kept version (the draft as it is now is kept first)",
  z.object({ version: z.string() }).openapi("DraftRestore"));
export const fileDraftRoute = createRoute({
  method: "post", path: "/api/teacher/drafts/{id}/submitted", summary: "The answer was submitted: file the draft under the attempt",
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: z.object({ attempt: z.string() }).openapi("DraftSubmitted") } }, required: true } },
  responses: { 200: { description: "Filed", content: { "application/json": { schema: z.object({ filed: z.string().nullable() }).openapi("DraftFiled") } } }, ...teacherErrors },
});
export const Money = z.record(z.string(), z.number());
export const Limit = z.object({ input: z.number().nullable(), output: z.number().nullable() }).openapi("Limit");
export const LimitSet = z.object({ input: z.number().nullable().optional(), output: z.number().nullable().optional() }).openapi("LimitSet");
export const AiState = z.object({
  connected: z.boolean(),
  from: z.enum(["environment", "file", "command", "none"]).nullable().openapi({ description: "Where the key comes from." }),
  provider: z.object({ name: z.string(), host: z.string(), custom: z.boolean().openapi({ description: "True for a gateway set in the user config ([teacher.provider]); false for OpenRouter." }),
    priced: z.boolean().openapi({ description: "Whether spending can be known: OpenRouter reports it; a gateway needs prices set." }) }),
  models: z.record(z.string(), z.string()).openapi({ description: "The model for each job ([teacher.models] in the user config)." }),
  tiers: z.object({ low: z.string(), mid: z.string(), max: z.string() }).openapi({ description: "The model for each tier Axis may be asked at in the editor ([teacher.tiers] in the user config)." }),
  limits: z.object({ low: Limit, mid: Limit, max: Limit }).openapi({ description: "For each tier, the most tokens sent in one call and the longest reply asked for ([teacher.limits] in the user config); null where none is set." }),
  spending: z.object({
    budget: z.number(), spent: z.number(), left: z.number(), warn: z.boolean(), stopped: z.boolean(), weekStart: z.string(),
    byFeature: Money, byModel: Money, byExercise: Money, calls: z.number(),
  }),
}).openapi("AiState");
export const getAi = createRoute({
  method: "get", path: "/api/teacher/ai", summary: "Whether a model account is connected, the models by job, and this week's spending",
  responses: { 200: { description: "The state", content: { "application/json": { schema: AiState } } }, 403: teacherErrors[403] },
});
export const putTiers = createRoute({
  method: "put", path: "/api/teacher/tiers",
  summary: "Set the model for each tier (low, mid, max) Axis may be asked at in the editor. Written to [teacher.tiers] in the user config, so it is the person's, across projects.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ low: z.string().optional(), mid: z.string().optional(), max: z.string().optional() }).openapi("TiersSet") } }, required: true } },
  responses: { 200: { description: "Set", content: { "application/json": { schema: AiState } } },
    400: { description: "Not a model's id", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } } },
});
export const putLimits = createRoute({
  method: "put", path: "/api/teacher/limits",
  summary: "Set, for each tier, the most tokens sent to its model in one call (input) and the longest reply asked of it (output); null takes a limit off. Written to [teacher.limits] in the user config, so it is the person's, across projects.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ low: LimitSet.optional(), mid: LimitSet.optional(), max: LimitSet.optional() }).openapi("LimitsSet") } }, required: true } },
  responses: { 200: { description: "Set", content: { "application/json": { schema: AiState } } },
    400: { description: "Not a number of tokens that can be set", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } } },
});
export const connectAi = createRoute({
  method: "post", path: "/api/teacher/ai/connect", summary: "Start connecting an OpenRouter account: the address to send the browser to",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Where to go", content: { "application/json": { schema: z.object({ url: z.string() }).openapi("AiConnect") } } }, ...teacherErrors },
});
export const disconnectAi = createRoute({
  method: "delete", path: "/api/teacher/ai", summary: "Forget the OpenRouter key kept here",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Forgotten", content: { "application/json": { schema: AiState } } }, ...teacherErrors },
});
export const checkAi = createRoute({
  method: "post", path: "/api/teacher/ai/check", summary: "Check the connection with a tiny request (its cost is logged as \"check\")",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "The reply", content: { "application/json": { schema: z.object({ text: z.string(), model: z.string(), cost: z.number() }).openapi("AiCheck") } } }, ...teacherErrors },
});
export const askTutor = createRoute({
  method: "post", path: "/api/teacher/tutor/{id}",
  summary: "Ask the teacher about your draft (hint, feedback or discuss); the reply streams as server-sent events: text, then done with the turn, or error",
  request: { params: DraftId, headers: writeHeader, body: { content: { "application/json": { schema: z.object({
    mode: z.enum(["hint", "feedback", "discuss"]), text: z.string(), working: z.string().optional(),
    prompt: z.string().optional(), selection: z.string().optional(), confidence: z.string().optional(),
  }).openapi("TutorAsk") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } }, ...teacherErrors },
});
export const ArtifactPath = z.object({ path: z.string().openapi({ param: { name: "path", in: "path" }, description: "The artifact's path in the knowledge base, URL-encoded: design%2Ffigure.html" }) });
export const putArtifact = createRoute({
  method: "put", path: "/api/artifacts/{path}", summary: "Write an artifact made in the app (an HTML file beside the notes); refused where a file is already there unless `replace`",
  request: { params: ArtifactPath, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ html: z.string(), replace: z.boolean().optional(), author: z.string().optional() }).openapi("ArtifactSave") } }, required: true } },
  responses: { 200: { description: "Written", content: { "application/json": { schema: z.object({ path: z.string(), bytes: z.number() }).openapi("ArtifactSaved") } } },
    400: { description: "Not an artifact's path", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "A file is already there", content: { "application/json": { schema: ErrorBody } } } },
});
export const previewArtifact = createRoute({
  method: "post", path: "/api/artifacts/preview", summary: "Hold an artifact that is not saved yet, to be looked at and checked: it is served like a saved one from the address returned, for a while",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ path: z.string(), html: z.string() }).openapi("ArtifactPreview") } }, required: true } },
  responses: { 200: { description: "Held", content: { "application/json": { schema: z.object({ url: z.string() }).openapi("ArtifactPreviewed") } } },
    400: { description: "Not an artifact's path", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } } },
});
export const deleteSkill = createRoute({
  method: "delete", path: "/api/teacher/skills/{name}", summary: "Reset a skill to rdstudio's default (a skill of your own is deleted)",
  request: { params: SkillName, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Reset", content: { "application/json": { schema: SkillReset } } }, ...teacherErrors },
});

export const Meta = z.record(z.string(), z.unknown()).openapi("NoteMeta", { description: "Frontmatter fields." });
export const NoteSourceSchema = z.object({
  id: z.string(),
  path: z.string().openapi({ description: "Relative to the knowledge folder." }),
  version: z.string().openapi({ description: "Of the whole file; send it back as `base` when saving." }),
  meta: Meta,
  frontmatter: z.string().openapi({ description: "The YAML between the --- lines." }),
  body: z.string().openapi({ description: "Everything after the frontmatter, verbatim." }),
}).openapi("NoteSource");
export const EditState = z.object({
  enabled: z.boolean(),
  token: z.string().nullable().openapi({ description: "Send as X-Rdstudio-Token when saving." }),
  actor: z.string().openapi({ description: "Who edits are attributed to, such as human:lachlan." }),
}).openapi("EditState");
export const SaveBody = z.object({
  base: z.string().nullable().openapi({ description: "The version the edit started from; null creates the note." }),
  body: z.string().nullable().optional(),
  meta: Meta.nullable().optional().openapi({ description: "Fields to set; null removes one." }),
  assist: z.array(z.string()).optional().openapi({ description: "Models whose proposed text was accepted into this edit: named in the note's stamp." }),
}).openapi("NoteSave");
export const SaveReply = z.object({
  note: NoteSourceSchema, created: z.boolean(), changed: z.boolean(), significant: z.boolean(),
}).openapi("NoteSaved");
export const Conflict = z.object({ error: z.string(), current: NoteSourceSchema.nullable() }).openapi("NoteConflict");
export const NoteId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "The note's id, such as design/model (slashes encoded)." }) });

export const History = z.object({
  available: z.boolean().openapi({ description: "Whether the project is a git repository." }),
  commits: z.array(z.object({ hash: z.string(), short: z.string(), author: z.string(), date: z.string(), subject: z.string() })),
  diff: z.string().nullable().openapi({ description: "The note then against now, as a unified diff, uncommitted changes included." }),
  base: z.string().nullable(),
  existed: z.boolean(),
}).openapi("NoteHistory");
export const getHistory = createRoute({
  method: "get", path: "/api/history/{id}", summary: "What changed in a note since a time: commits and a diff (catching up)",
  request: { params: NoteId, query: z.object({ since: z.string().openapi({ description: "An ISO time, such as when you last looked." }) }) },
  responses: {
    200: { description: "The history", content: { "application/json": { schema: History } } },
    400: { description: "Not a valid note or time", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});

export const getEdit = createRoute({
  method: "get", path: "/api/edit", summary: "Whether notes can be edited here, and the token to do it with",
  responses: {
    200: { description: "The editing state", content: { "application/json": { schema: EditState } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
  },
});
export const getNote = createRoute({
  method: "get", path: "/api/notes/{id}", summary: "A note's source, to edit",
  request: { params: NoteId },
  responses: {
    200: { description: "The note", content: { "application/json": { schema: NoteSourceSchema } } },
    400: { description: "Not a valid note id", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Host not allowed", content: { "application/json": { schema: ErrorBody } } },
    404: { description: "No such note", content: { "application/json": { schema: ErrorBody } } },
  },
});
export const putProfile = createRoute({
  method: "put", path: "/api/teacher/profile",
  summary: "Set the project's profile, and so its mode: topic is Learning; codebase and project are Project. Written to rdstudio.toml ([teacher] profile), so it is the project's, for everyone who opens it.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ profile: z.enum(["topic", "codebase", "project"]) }).openapi("ProfileSet") } }, required: true } },
  responses: { 200: { description: "Set", content: { "application/json": { schema: TeacherState } } },
    400: { description: "Not a profile", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } } },
});
export const assistNote = createRoute({
  method: "post", path: "/api/notes/{id}/assist",
  summary: "Ask the connected model about a note being edited. chat is a turn of a conversation beside the note (T97): it answers, and may propose changes where it is let (T98): at a place set for new text, to a marked passage, or anywhere in the note. figure has an artifact made; ask and fill are the two chat replaced. The model may first look things up in the knowledge base and the code. The reply streams as server-sent events: step for each thing looked up, text, then done with the reply (for chat, also the turn as it is kept and the id of the chat it is kept in, where the learner record is on), or error. No note is written.",
  request: { params: NoteId, headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({
    mode: z.enum(["ask", "fill", "figure", "chat"]), tier: z.enum(["low", "mid", "max"]).optional().openapi({ description: "How strong a model to ask: the tier's model is used. Left out, the mode's usual tier." }), fix: z.object({ html: z.string(), problems: z.array(z.string()) }).optional(), body: z.string(), from: z.number().int(), to: z.number().int(), prompt: z.string().optional(), title: z.string().optional(),
    at: z.number().int().nullable().optional().openapi({ description: "chat: where new text is to go, apart from the passage (from..to)." }),
    may: z.object({ passage: z.boolean().optional(), note: z.boolean().optional() }).optional().openapi({ description: "chat: what it may change: the marked passage, or anything in the note." }),
    thread: z.array(z.object({ question: z.string(), answer: z.string() })).optional().openapi({ description: "chat: the turns before this one, oldest first." }),
    chat: z.string().nullable().optional().openapi({ description: "chat: the kept chat this turn goes on from; left out, a new one." }),
  }).openapi("NoteAssist") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } },
    400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "No model account is connected", content: { "application/json": { schema: ErrorBody } } } },
});
export const askAtlas = createRoute({
  method: "post", path: "/api/atlas/ask",
  summary: "Ask the connected model a question about the project, from the Atlas (T85). It looks things up in the knowledge base and the code, and says which notes its answer rests on. Server-sent events: step for each thing looked up (what the map draws), text, then done with the answer (and the id it is kept under, where the learner record is on), or error. No note is written.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({
    question: z.string(), start: z.string().optional().openapi({ description: "Where the asker is on the map: a note's id or a folder. Left out, the whole map." }), tier: z.enum(["low", "mid", "max"]).optional(),
    may: z.object({ propose: z.boolean().optional() }).optional().openapi({ description: "What it is let do besides answer (T101). propose: it may propose a new note, a change to a note, or a move; the answer then carries `proposals`, and nothing is written until one is accepted (POST /api/atlas/proposals)." }),
  }).openapi("AtlasAsk") } }, required: true } },
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } },
    400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token or host not allowed", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "No model account is connected", content: { "application/json": { schema: ErrorBody } } } },
});
export const acceptProposal = createRoute({
  method: "post", path: "/api/atlas/proposals",
  summary: "Accept one thing Axis proposed on the Atlas (T101): the note is written, changed or moved as an edit made in the app is, with the model named in its stamp. A change is found again in the note as it is now, and refused if its text is no longer there.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({
    proposal: z.record(z.string(), z.unknown()).openapi({ description: "The proposal as the answer gave it: {kind: create | change | move, …}." }),
    model: z.string().openapi({ description: "The model that proposed it, as the answer named it." }),
  }).openapi("ProposalAccept") } }, required: true } },
  responses: { 200: { description: "Done: the note's id, and what was saved or moved", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } },
    400: { description: "Not a proposal that can be made (and why)", content: { "application/json": { schema: ErrorBody } } },
    403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
    409: { description: "The note changed since, exists already, or is gone", content: { "application/json": { schema: ErrorBody } } } },
});
export const AskId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) });
// What agents outside the app did in the base (T107): sessions of the MCP server, and of a harness's own file tools.
export const agentSessions = createRoute({
  method: "get", path: "/api/agents/sessions", summary: "The sessions of agents outside the app that are kept (T107), the latest first: each run of the MCP server, with what it searched, opened and wrote",
  responses: { 200: { description: "Whether sessions are kept, and those that are", content: { "application/json": { schema: z.object({ enabled: z.boolean(), quietMs: z.number(), sessions: z.array(z.record(z.string(), z.unknown())) }) } } }, 403: teacherErrors[403] },
});
export const agentSession = createRoute({
  method: "get", path: "/api/agents/sessions/{id}", summary: "One session's steps, in order: what was touched, never what was read or written",
  request: { params: AskId },
  responses: { 200: { description: "The steps", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } }, 403: teacherErrors[403], 404: { description: "No such session", content: { "application/json": { schema: ErrorBody } } } },
});
export const forgetAgentSession = createRoute({
  method: "delete", path: "/api/agents/sessions/{id}", summary: "Delete a kept session",
  request: { params: AskId, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ id: z.string() }) } } }, 400: { description: "Not deleted", content: { "application/json": { schema: ErrorBody } } }, 403: teacherErrors[403] },
});
export const sendToAgent = createRoute({
  method: "post", path: "/api/agents/inbox", summary: "Send something to a terminal agent (T109): a message, with the note or folder you are on. It waits until an agent asks for it through the MCP server (the from_developer tool); nothing else of what you do in the app is seen by an agent.",
  request: { headers: z.object({ "x-rdstudio-token": z.string() }), body: { content: { "application/json": { schema: z.object({ text: z.string(), ref: z.string().optional(), passage: z.string().optional() }).openapi("SendToAgent") } }, required: true } },
  responses: { 200: { description: "Kept, to be taken", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } }, 400: { description: "Nothing to send", content: { "application/json": { schema: ErrorBody } } }, 403: teacherErrors[403] },
});
export const sentToAgent = createRoute({
  method: "get", path: "/api/agents/inbox", summary: "What you have sent to a terminal agent lately, the latest first, each waiting or taken (by whom, and when)",
  responses: { 200: { description: "What was sent", content: { "application/json": { schema: z.object({ sent: z.array(z.record(z.string(), z.unknown())) }) } } }, 403: teacherErrors[403] },
});
export const unsendToAgent = createRoute({
  method: "delete", path: "/api/agents/inbox/{id}", summary: "Take back something sent to a terminal agent",
  request: { params: AskId, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Taken back", content: { "application/json": { schema: z.object({ id: z.string() }) } } }, 403: teacherErrors[403] },
});
export const agentsLive = createRoute({
  method: "get", path: "/api/agents/live", summary: "What agents outside the app are doing, as they do it: server-sent events, a step for each thing touched from now on, for as long as the page listens",
  responses: { 200: { description: "Server-sent events", content: { "text/event-stream": { schema: z.string() } } }, 403: teacherErrors[403] },
});
export const listAsks = createRoute({
  method: "get", path: "/api/atlas/asks", summary: "The questions asked on the Atlas that are kept in your learner record (T94), newest first",
  responses: { 200: { description: "Whether questions are kept, and those that are", content: { "application/json": { schema: z.object({ enabled: z.boolean(), asks: z.array(z.record(z.string(), z.unknown())) }) } } }, 403: teacherErrors[403] },
});
export const getAsk = createRoute({
  method: "get", path: "/api/atlas/asks/{id}", summary: "One kept question with its answer, the lookups made, and what has changed in the notes since",
  request: { params: AskId },
  responses: { 200: { description: "The kept question", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } }, 403: teacherErrors[403], 404: { description: "No such kept question", content: { "application/json": { schema: ErrorBody } } } },
});
export const forgetAsk = createRoute({
  method: "delete", path: "/api/atlas/asks/{id}", summary: "Forget a kept question",
  request: { params: AskId, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Forgotten", content: { "application/json": { schema: z.object({ id: z.string() }) } } }, 400: teacherErrors[400], 403: teacherErrors[403] },
});
export const ChatId = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) });
export const listChats = createRoute({
  method: "get", path: "/api/assist/chats", summary: "The chats with Axis beside a note that are kept in your learner record (T97), the one last added to first",
  request: { query: z.object({ note: z.string().optional().openapi({ description: "Only the chats about this note." }) }) },
  responses: { 200: { description: "Whether chats are kept, and those that are", content: { "application/json": { schema: z.object({ enabled: z.boolean(), chats: z.array(z.record(z.string(), z.unknown())) }) } } }, 403: teacherErrors[403] },
});
export const getChat = createRoute({
  method: "get", path: "/api/assist/chats/{id}", summary: "One kept chat: its turns, each with its answer, the changes proposed, what was looked up and what it cost",
  request: { params: ChatId },
  responses: { 200: { description: "The kept chat", content: { "application/json": { schema: z.record(z.string(), z.unknown()) } } }, 403: teacherErrors[403], 404: { description: "No such kept chat", content: { "application/json": { schema: ErrorBody } } } },
});
export const forgetChat = createRoute({
  method: "delete", path: "/api/assist/chats/{id}", summary: "Delete a kept chat",
  request: { params: ChatId, headers: z.object({ "x-rdstudio-token": z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ id: z.string() }) } } }, 400: teacherErrors[400], 403: teacherErrors[403] },
});
export const putNote = createRoute({
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

export const MoveBody = z.object({
  to: z.string().openapi({ description: "The new id, such as philosophy/motivation." }),
  base: z.string().nullable().optional().openapi({ description: "The note's version; refused if it changed since." }),
}).openapi("NoteMove");
export const Moved = z.object({
  moved: z.array(z.object({ from: z.string(), to: z.string() })),
  rewritten: z.array(z.string()).openapi({ description: "Files whose links were updated." }),
}).openapi("Moved");
export const FolderMoveBody = z.object({ from: z.string(), to: z.string() }).openapi("FolderMove");
export const Deleted = z.object({
  deleted: z.string(),
  backlinks: z.array(z.string()).openapi({ description: "Notes that linked to it; those links are now broken." }),
}).openapi("NoteDeleted");
export const FolderDeleted = z.object({
  deleted: z.string(),
  notes: z.array(z.string()).openapi({ description: "The notes deleted with it." }),
  backlinks: z.array(z.string()).openapi({ description: "Notes elsewhere that linked into it; those links are now broken." }),
}).openapi("FolderDeleted");
export const FolderPath = z.object({ path: z.string().openapi({ param: { name: "path", in: "path" }, description: "The folder, such as design/old (slashes encoded)." }) });
export const Token = z.object({ "x-rdstudio-token": z.string() });
export const writeErrors = {
  400: { description: "Not a valid request", content: { "application/json": { schema: ErrorBody } } },
  403: { description: "Cross-origin request, bad token, host not allowed, or read-only", content: { "application/json": { schema: ErrorBody } } },
  409: { description: "The note changed since `base`, or is gone", content: { "application/json": { schema: Conflict } } },
  415: { description: "Not JSON", content: { "application/json": { schema: ErrorBody } } },
};

export const postMove = createRoute({
  method: "post", path: "/api/notes/{id}/move", summary: "Move or rename a note, updating the links to it",
  request: { params: NoteId, headers: Token, body: { content: { "application/json": { schema: MoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
export const postVerify = createRoute({
  method: "post", path: "/api/notes/{id}/verify", summary: "Mark a note as checked by you (T105): a verification is added under your name, as rdstudio verify does. Only a person does this: no agent's tool reaches it.",
  request: { params: NoteId, headers: Token },
  responses: { 200: { description: "Marked", content: { "application/json": { schema: z.object({ id: z.string(), path: z.string(), by: z.string() }).openapi("Verified") } } }, ...writeErrors },
});
export const deleteNoteRoute = createRoute({
  method: "delete", path: "/api/notes/{id}", summary: "Delete a note",
  request: { params: NoteId, headers: Token, query: z.object({ base: z.string().optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: Deleted } } }, ...writeErrors },
});
export const postFolderMove = createRoute({
  method: "post", path: "/api/folders/move", summary: "Move or rename a folder with everything in it, updating links",
  request: { headers: Token, body: { content: { "application/json": { schema: FolderMoveBody } }, required: true } },
  responses: { 200: { description: "Moved", content: { "application/json": { schema: Moved } } }, ...writeErrors },
});
export const deleteFolderRoute = createRoute({
  method: "delete", path: "/api/folders/{path}", summary: "Delete a folder (with the notes in it, given withNotes)",
  request: { params: FolderPath, headers: Token, query: z.object({ withNotes: z.enum(["true", "false"]).optional() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: FolderDeleted } } }, ...writeErrors },
});
