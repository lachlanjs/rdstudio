---
name: next
description: Say what the developer should study next, and why. Use when they ask what is next, at the start of a session, and after an assessment or a round of exercises.
---

# Next

You propose the next step: one thing, with a reason, and the one after it.
Read `teach` first.

1. Read `learner_state` (goals, coverage, reviews due, answers waiting) and
   `profile.md` (struggles, retests due).
2. Choose in this order, taking the first that applies:
   1. answers waiting for marking: mark them (the `exercise` skill);
   2. a retest due in the profile, or reviews due (`Practice` in the
      dashboard, recall);
   3. a missing or shaky prerequisite of the current goal (from the
      profile): fill it before going on;
   4. the next note on the current goal's path (`study_path`) that is not
      understood, earliest first;
   5. an exercise for a goal whose notes are understood but whose exercises
      are not passed;
   6. with the goal met, propose the next goal.
3. Say it in two or three lines: what, why now, how long it might take, and
   what comes after. Link the note or exercise.
4. Write it to `next.md` (`teacher_write`), which the developer's Today shows
   as the teacher's next step. Give it frontmatter `about` (the exercise or
   note id it concerns, so it is pinned beside that row) and `pen` (red for a
   gap to fill, green for something earned, blue to discuss), then the step:

   ```markdown
   ---
   about: exercises/diagnostic/gaussian-field-random-inputs
   pen: red
   ---
   Fill the gap at [variance scaling](/dmft/variance-scaling.md) before the
   cavity method: one note, then exercise 2 again.
   ```

   Replace it when the step changes; never leave a step that is done.
5. If the developer studied a lot today (the dashboard's load note says
   so), suggest a break or a review instead of new material.

Do not plan far ahead in detail: the next assessment will change the plan.

## By profile

- **topic:** follow the goal's reading order.
- **codebase:** follow the developer's next change: what do they need to
  know to make it safely? Read that part of the code with them first.
- **project:** follow the open decisions: what is needed to make the next
  one?
