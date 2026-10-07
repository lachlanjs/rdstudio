---
type: Task
title: T75 — Switch a project between Learning and Project from the app
description: The mode tag beside the project's name is a switch, and Settings has a section for it;
  switching sets the teacher's profile in rdstudio.toml, so it is still the project's mode, for
  everyone.
tags: [task, m13, project-mode, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T00:10:33Z}
---

# Prompt

From the developer, 2026-10-07: "The rdstudio in rdstudio itself seems to be
configured for learn mode. I think it would be good to be able to switch."

# What was found

This repository's `rdstudio.toml` sets no profile, so it is guessed. Both
command lines (`rdstudio teacher profile`, from source and as installed)
answer `codebase`, which is Project mode, not Learning. Why the developer
saw Learning was not found: possibly a server started before the profile
was guessed this way, or an older build. Until now the only way to change
it was to edit `rdstudio.toml` or run `rdstudio teacher profile <name>`.

# What was built

On `feat/co-edit`.

- **Server:** `PUT /api/teacher/profile` sets `[teacher] profile` in
  `rdstudio.toml` (the existing `setProfile`), guarded as a write and
  refused on a read-only server; the site is rebuilt after, since whether
  the code is indexed follows the profile. The teacher's state also says
  what the profile would be if unset (`guessed`).
- **The bar:** the mode tag is a button. Its title says what the mode
  means, that a click switches it, and that it is saved in `rdstudio.toml`
  for everyone.
- **Settings:** "This project's mode", Learning or Project, with a note
  that, unlike the rest of the page, it is the project's and not this
  browser's. The tag is hidden on a phone, so this is the way there.
- **Which profile:** Learning is `topic`. Project keeps `codebase` or
  `project` if one was set, else `codebase` where the repository holds code
  and `project` where it does not.
- The switch writes with the editing token, since the learner record may be
  off.

# What it does not settle

The mode is still one setting for everyone who opens the project. Whether
it should be the viewer's is
[an open question](/questions/mode-per-project-or-viewer.md); this makes
the project's setting easy to change, nothing more.

# Checks

A server test (the profile is written, the rest of the file kept, a bad
token and a bad name refused, a rebuild asked for); and in the code
walkthrough, the tag switches nanosim to Learning (Practice takes the
Project space's place, `rdstudio.toml` says `topic`) and Settings switches
it back.
