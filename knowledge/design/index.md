# Overview

* [rdstudio overview](overview.md) - What rdstudio is, who it is for, and the principles it serves.

# Design

* [Architecture](architecture.md) - Components, repository layout, and data flow of rdstudio.
* [Conventions](conventions.md) - How rdstudio uses OKF fields, actor names, concept types, tasks, reports and procedures.
* [Dashboard design](dashboard-design.md) - Visual tokens and layout rules for the dashboard, and why they were chosen.
* [Map view](map-view.md) - Criteria and design for the Atlas, the nested map of a knowledge base, where folders are regions, links are drawn at the scale they belong to, and the terrain shows where you stand.
* [Platform, performance and deployment](platform.md) - Scope for making rdstudio fast on every device: local-first data, a GPU map renderer, a Tauri app, and one TypeScript core shared by the web, desktop, mobile, command line and MCP server.
* [Projects, accounts and sync](projects-and-sync.md) - How the app manages several projects across devices: plain git for content, GitHub as the first-class sign-in and host, a private learner repository for everything about you, and self-hosted servers paired by QR code or found on the local network.
* [Redesign: structure and one theme](redesign.md) - The app reorganised into four spaces (Today, Library, Atlas, Practice) plus Project and You, with a command palette, adapted per platform; and one distinctive dark-first theme, chosen from three directions sketched in Claude Design.
* [Streaks](streaks.md) - Daily and weekly streaks for recall, new learning, problem solving and all three together, counting real work only, with reprieves earned by keeping a streak, all worked out from the learner record.
* [Teacher](teacher.md) - The agent's side of learning, kept apart from the knowledge base: skills served through MCP, goals, exercises with solutions, the sources log and an evidence-linked profile of the learner, in a private folder beside the learner record.
* [The code map](code-map.md) - How rdstudio reads a codebase into a map, from directories down to functions and important variables, with the links between them, and how notes attach to code.
* [Understanding layer](understanding-layer.md) - How the understanding features are built: three kinds of task, a private learner record, tours kept off the map, and the order of work.
* [Where the teacher runs: AI providers](ai-providers.md) - How models reach the app on every platform: subscriptions through the provider's own app as an MCP connector, OpenRouter or an API key in the app, self-hosted models behind an OpenAI-compatible endpoint, and the home server as a gateway that runs the teacher itself.
* [Work together: the tutor](tutor.md) - The developer writes an answer with the teacher alongside: hints, feedback and discussion pinned to passages of the draft; the draft's history, so any response can be seen against the draft it answered; and the server-side teacher on OpenRouter that makes it possible, with its context and cost kept in check.
