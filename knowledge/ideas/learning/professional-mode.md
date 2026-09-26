---
type: Idea
title: Professional mode for understanding features
description: How to present motivational and learning features so they suit a work context, modelled on training-load dashboards and test coverage rather than games.
tags: [learning, design, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-26T03:11:24Z }
---

# Summary

The developer wants gamification only where necessary, optional, and suitable
for work. Two professional precedents fit: training-load dashboards used by
athletes (TrainingPeaks, Garmin), which are close to a literal PID controller,
and code-coverage views, which developers already accept.

Training-load dashboards track *fitness* (a long exponentially weighted average
of load, integral-like), *fatigue* (a short average) and *form* (fitness minus
fatigue), and recommend recovery. Professionals trust them because they are
grounded in real data, quiet, and never cheer.

# Game features and their professional versions

| Game version | Professional version |
|---|---|
| Fog of war | **Coverage overlay**: which parts of the map you have shown you understand, like code coverage |
| Question marks on the map | **Open questions**, marked like an editor marks unresolved warnings |
| Scores | **No single score**: coverage per area, recall accuracy over time, reviews due (capped) |
| "Take a break" | **Load indicator**: "12 concepts today against your usual 5; consolidation tends to work better after a break." Stated once, never repeated |

# Principles

1. Every indicator is derived from evidence of learning, never from time spent.
2. Private by default; see [learner record](/ideas/learning/learner-record.md).
3. Suggest, never demand.
4. No notifications, animations, streaks or praise.
5. The developer sets the targets.
6. Every part can be switched off, and the layer is off by default in shared
   settings.
7. Formative before summative: measurement serves learning; demonstration to
   others is a separate, deliberate act (a tour, a solved problem).

Charm is personal and handled by themes; clarity and the pedagogy of the
presentation matter more.
