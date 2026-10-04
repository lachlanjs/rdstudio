---
type: Design
title: "Redesign: structure and one theme"
description: "The app reorganised into four spaces (Today, Library, Atlas, Practice) plus Project and You, with a command palette, adapted per platform; and one distinctive dark-first theme, chosen from three directions sketched in Claude Design."
status: draft
tags: [design, dashboard]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-04T17:00:00Z }
---

# Status

Agreed with the developer on 2026-10-04:
- the four-space structure;
- one theme, dark first, replacing the six;
- three directions to sketch: Marginalia, Survey and Instrument, plus
  Marginalia with Survey's Atlas.

The sketches are made in Claude Design from a design pack: this brief,
`fonts/`, screenshots of today's screens, and real content from the DMFT
trial. Once a direction is chosen, its tokens and components are built here,
and `/design-sync` keeps them in step with a Claude Design design-system
project. The brief follows as given to Claude Design.

## The product

rdstudio is a knowledge base for learning and research, run on your own
machine. Notes are Markdown files in a git repository, linked to one another,
with maths. On top of them sits a learning layer:
- a record of what you have opened, understood and practised;
- exercises with worked solutions, and streaks;
- an AI teacher that sets exercises, marks answers, gives hints and feedback
  while you write, and keeps a profile of how you learn.

It runs in the browser today, as a desktop app (Mac, Linux) next, then
Android and iPhone.

The person using it is a researcher learning a hard subject. The current
case is dynamical mean-field theory for random neural networks, aimed at one
paper. They read, write notes, answer exercises (often with maths), and work
through hints and feedback with the teacher.

## What to design

**One distinctive theme, dark first** (light second), and a **new layout**.
Everything the app does today stays; it is reorganised. Screenshots of today's
screens are in `screens/`. Treat them as a list of functions, not a style to
keep.

### The structure: four spaces, plus Project and You

| Space | For | Holds |
|---|---|---|
| **Today** (home) | "what should I do now?" | streaks; exercises set for you; reviews due; the teacher's next step; what changed since you looked; continue where you left off |
| **Library** | reading and writing | the folder tree; the note reader and editor; a **companion panel** per note (details, your understanding, explain it back, ask the teacher) |
| **Atlas** | seeing the whole | one spatial view of the knowledge base (folders as regions, notes as places, links as routes), with **lenses**: links, your understanding (fog over what you have not reached), a study path, a tour, a goal's territory |
| **Practice** | doing | goals and their exercises; quick drills (recall, fill the gap, placement, landmarks); the **exercise workbench** |
| Project (quieter) | upkeep | changes from git, the review queue, reports, procedures, skills and agents |
| You (a menu) | settings | the teacher (its profile of you, sources, skills, models and spending), settings |

**A command palette (⌘K)** jumps to any note or action, and is the main way
around a large knowledge base.

### Five key screens

1. **Today, desktop.**
   - The streak strip: four counters (all three, recall, new learning,
     problem solving), each with "done today" or "not yet today", this week
     "3 of 4 days", best, and reprieves banked.
   - A "Set for you" card: a diagnostic of 3 exercises, 2 answered.
   - Two reviews due.
   - The teacher's next step, as one sentence with a link.
   - Two notes changed since you looked.
   - Continue: the exercise you left half written.
2. **The exercise workbench, desktop.** This is the signature screen.
   - **Left:** the problem (maths, a numbered list).
   - **Middle:** your answer, a live-preview editor (maths typeset off the
     line being written) with passages highlighted by the teacher.
   - **Right:** the teacher's replies as cards: a hint ("Independence."), and
     feedback with red and green pins. Each pin quotes the words it is about,
     joined visually to those words in the answer, like a tutor's pen in the
     margin.
   - **Above the answer:** Hint (2 of 3), Feedback, Discuss.
   - **Below:** draft saved, versions, Mark it yourself, Ask an agent to mark
     it.
3. **A note with its companion panel, desktop.**
   - The tree on the left; a long note with headings, maths and links in the
     middle.
   - The companion panel on the right: your understanding (opened, worked
     through, understood), explain it back, trust (unverified or
     human-reviewed), prerequisites in reading order.
4. **The Atlas, desktop.**
   - Folders as regions, sized by notes, with routes between them.
   - The understanding lens on: reached regions clear, the rest in fog,
     the frontier marked.
   - A small lens switcher; a study path highlighted.
5. **Today, phone** (390 × 844).
   - Bottom tab bar: Today, Library, Practice, Atlas, More.
   - The same content as screen 1, as a stack.
   - Also: **the workbench on a phone**, with the teacher's cards inline
     under the paragraph each one pins.

## Three directions to sketch

All dark first. Each should feel familiar enough to use at once, and have one
element no other tool has.

### A. Marginalia (the teacher's pen)

- **The look:** a quiet page in dark ink tones: deep blue-black, not pure
  black.
- **Colour:** the only colours are three pens, and they mean the same
  everywhere. Red is critical (wrong, stale, missed). Green is right
  (verified, passed, understood). Blue is discussion and links.
- **Teacher replies:** marks in the margin, joined to the passage they are
  about.
- **Type:** Charter for reading, Ioskeley Mono for labels and numbers.
- **Distinctive:** colour is meaning; the palette is the teaching system.

### B. Survey (the cartographer)

- **The idea:** the knowledge base as terrain.
- **The Atlas:** contour lines for depth of understanding, hachures at the
  frontier, grid references for notes.
- **Elsewhere:** survey-sheet details, sparingly. Measured rules, a north
  arrow on the Atlas, coordinates beside the streak counters.
- **Type:** Martian Mono (its width axis) for labels, Charter for reading.
- **Distinctive:** understanding drawn as geography.
- **Risk:** antique-map kitsch. Keep it a modern survey sheet, not
  parchment.

### C. Instrument (precision)

- **The look:** a lab instrument, with readouts, measured rules and tight
  grids.
- **Numbers:** streaks, spending and coverage as instrument dials or
  segment readouts in Departure Mono, used sparingly.
- **Type:** Ioskeley Mono for the interface, Charter for reading.
- **Distinctive:** a calm, precise tool for hard thinking.
- **Risk:** cold. Find warmth in the reading surface.

**Our lean:** Marginalia as the base, with Survey's ideas used only in the
Atlas. Please also try that combination as a fourth sketch.

## Constraints

- **Fonts** (in `fonts/`, with licences):
  - Charter (regular, italic, bold, bold italic);
  - Ioskeley Mono (four styles);
  - Martian Mono (variable: weight 100 to 800, width 75 to 112.5);
  - Departure Mono (pixel).
  
  No other web fonts. The app works offline, so everything is bundled.
- **Reading:** about 70 characters a line for reading text, maths with
  KaTeX, and code blocks.
- **Accessibility:** WCAG AA contrast, and visible focus. The three pens
  never carry meaning by colour alone: each pairs with a shape or line style
  (red solid underline, green double line, blue dotted line, say).
- **Motion:** little, and only in answer to an action. Respect reduced
  motion.
- **Performance:** no blur filters or large shadows. The Atlas must stay
  smooth with 1,000 notes.
- **Phones:** 16 px gutters, no sideways scrolling, touch targets at least
  44 px.

## Please avoid

- A cream background with a terracotta accent.
- A near-black background with a single acid-green accent.
- Identical rounded cards with soft grey shadows everywhere.
- Eyebrow labels in tracked capitals above every heading.
- Gradients as decoration.

## What we would like back

For each direction:
- Today and the workbench on desktop, the Atlas on desktop, and Today on a
  phone, dark;
- one of those screens in light;
- a short token sheet: colours (with the three pens), type scale and
  spacing.
