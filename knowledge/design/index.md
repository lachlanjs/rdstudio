# Overview

* [rdstudio overview](overview.md) - What rdstudio is, who it is for, and the principles it serves.

# Design

* [Architecture](architecture.md) - Components, repository layout, and data flow of rdstudio.
* [Conventions](conventions.md) - How rdstudio uses OKF fields, actor names, concept types, tasks, reports and procedures.
* [Dashboard design](dashboard-design.md) - Visual tokens and layout rules for the dashboard, and why they were chosen.
* [Map view](map-view.md) - Criteria and design for the nested map of a knowledge base, where folders are regions and links are drawn at the scale they belong to.
* [Platform, performance and deployment](platform.md) - Scope for making rdstudio fast on every device: local-first data, a GPU map renderer, a Tauri app, and one TypeScript core shared by the web, desktop, mobile, command line and MCP server.
* [Projects, accounts and sync](projects-and-sync.md) - How the app manages several projects across devices: plain git for content, GitHub as the first-class sign-in and host, a private learner repository for everything about you, and self-hosted servers paired by QR code or found on the local network.
* [Teacher](teacher.md) - The agent's side of learning, kept apart from the knowledge base: skills served through MCP, goals, exercises with solutions, the sources log and an evidence-linked profile of the learner, in a private folder beside the learner record.
* [Understanding layer](understanding-layer.md) - How the understanding features are built: three kinds of task, a private learner record, tours kept off the map, and the order of work.
