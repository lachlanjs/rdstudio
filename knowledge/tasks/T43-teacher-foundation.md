---
type: Task
title: "T43 — Teacher foundation"
description: "The private teacher folder as a git repository beside the learner record, the default skills served through MCP with profiles and overrides, and the Teacher page with its Skills section."
tags: [task, m10, done]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T12:00:00Z }
---

# Prompt

See the [teacher design](/design/teacher.md).

- **The folder:** the learner folder becomes a git repository on first use;
  the server commits teacher files when they are written.
- **Skills:** the defaults in `templates/teacher/skills/`, overrides in
  `teacher/skills/`. The MCP tools `teacher_skills` and `teacher_skill`,
  and the stub skill `teach` installed by `rdstudio init`.
- **Profiles:** `rdstudio init --profile topic|codebase|project`, kept in
  `teacher/teacher.toml`.
- **The Teacher page:** reached from the Learn tab and Settings. Its Skills
  section shows each skill as default or changed, lets you view, customise and
  reset it, and shows the difference from the default.

# Done when

- An agent in a fresh session reads a customised skill through MCP.
- Resetting a skill returns it to the default.
- Nothing is written to the project repository except the stub skill.

# Outcome (2026-10-02)

- **The folder:** `learners/<project>/teacher/`, beside the record.
  - The learner folder becomes a git repository on the first teacher write.
  - Each write is a commit, with the record included.
  - Without a git identity, commits are made as `rdstudio`.
  - Inside another repository, no repository is made.
- **Skills:**
  - Defaults are in `src/rdstudio/templates/teacher/skills/`; so far only
    `teach`, which holds the rules and the profiles. The rest come in
    [T45](/tasks/T45-profile-and-skills.md).
  - An override is in `teacher/skills/<name>.md`. The default it was made
    from is kept in `skills/.base/`, so a later change to the default is
    shown, with what changed in it.
  - A skill with no default is listed as "your own"; a reset deletes it.
- **MCP:** `teacher_skills` (the profile, whether the record is on, each
  skill and its status) and `teacher_skill` (resolved, with a line on the
  profile and whose version it is). These are Node only, and allowed by
  `mcp:agree`.
- **The harness:** `rdstudio init` installs the stub skill `teach`, which
  says nothing personal. The agents' instructions point to it.
- **The profile:** kept in `rdstudio.toml` as `[teacher] profile`, not in
  the private folder. It belongs to the project, and a private file would be
  lost when a new repository gets its first commit, because that changes the
  project id. It is set with `rdstudio init --profile` or
  `rdstudio teacher profile`, and read afresh, so a running server sees the
  change.
  - `rdstudio teacher [where|profile|skills]` shows it all.
  - Without a setting, it is guessed: codebase when the repository holds
    code, topic otherwise.
- **HTTP:** `GET /api/teacher`, and `GET`, `PUT` and `DELETE
  /api/teacher/skills/{name}`. Writes need the learner record on and the
  same checks as its writes.
- **The Teacher page:** `#/teacher`, under the Learn tab, linked from the
  foot of the Learn tab and from Settings. It shows:
  - the profile, and how to change it;
  - the skills, marked default, customised or your own, and "default
    updated" when the default changed under a customisation;
  - the history.
  
  A skill's page renders it. Customising is a plain monospace editor that
  starts from the default. You can compare your version with the default,
  see what changed in the default, start again from the new default, or
  reset.
- **Checked:**
  - unit tests (`teacher.test.ts`, the routes in `serve.test.ts`, and
    `linediff.test.ts` in the app);
  - `mise run agree`;
  - `e2e/teacher.py`, 20 checks, including an agent reading a customised
    skill through a real stdio MCP server.
