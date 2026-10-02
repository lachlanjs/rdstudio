---
type: Task
title: "T43 — Teacher foundation"
description: "The private teacher folder as a git repository beside the learner record, the default skills served through MCP with profiles and overrides, and the Teacher page with its Skills section."
tags: [task, m10, todo]
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
