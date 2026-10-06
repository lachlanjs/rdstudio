---
type: Decision
title: Station is a second chooseable theme, with its terminal chrome
description: The Station terminal theme joins Marginalia as a user setting, including the status
  line, key legend and numbered spaces, revising the one-theme rule of the redesign.
tags: [decision, dashboard, theme]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-05T22:33:13Z}
---

# Decision

Station is built into the app as a second theme beside Marginalia, chosen per
browser ([T61](/tasks/T61-station-theme.md)). It is inspired by the interface
of Alien: Isolation and will keep being refined. Decided by the developer on
2026-10-05.

- **All of the chrome:** the status line, the key legend with dotted leaders,
  numbered spaces with the current one reversed, framed panes, the block
  caret and scan lines, not only colours and type.
- **Light mode:** included if it is easy; the tokens already have light
  values, but every sketch is dark.
- **The pens** keep their colours and line styles, so the theme's cyan line
  is structure and never a meaning.

This revises "one theme" in the [redesign](/design/redesign.md) and
[T52](/tasks/T52-theme-tokens.md): Marginalia stays the default, and the
theme picker returns.

# Assumption

A second theme can be a layer of tokens and rules over Marginalia's, so each
screen is still built once. The sketches do it this way
(`design/tools/station.mjs` remaps the base tokens and adds about 60 rules).

# Alternatives considered

- **Colours, type and frames only, chrome later:** less work, but the status
  line and key legend are much of the look.
- **Replace Marginalia:** not wanted; Station is the option.

# Reopen if

Station needs screens to be built differently, not restyled, so that the two
themes stop sharing markup.
