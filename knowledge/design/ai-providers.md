---
type: Design
title: "Where the teacher runs: AI providers"
description: "How models reach the app on every platform: subscriptions through the provider's own app as an MCP connector, OpenRouter or an API key in the app, self-hosted models behind an OpenAI-compatible endpoint, and the home server as a gateway that runs the teacher itself."
status: draft
tags: [design, platform, learning, ai]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T19:00:00Z }
---

# Purpose

rdstudio is built around agents. Today the agent is a harness on the desktop
(Claude Code, OpenCode, ...) reaching rdstudio through MCP, and the dashboard
never calls a model. This design keeps that rule as the default, and adds
ways for a model to do the [teacher's](/design/teacher.md) work from any
device, the phone included (the hardest case; see [projects, accounts and
sync](/design/projects-and-sync.md)).

# The options

| Option | Works | How | On the phone |
|---|---|---|---|
| **A subscription** (Claude, ChatGPT, Gemini) | yes, from the provider's side | Subscriptions do not include API access, and providers do not allow third-party apps to use subscription logins (Anthropic says so explicitly for Claude). So rdstudio is the MCP server, and the provider's own client calls it: a desktop harness (Claude Code, Codex, Gemini CLI), or a **custom connector** in the Claude or ChatGPT apps. | You talk in the provider's app. Markings, notes and profile changes land in rdstudio and sync to its app. A connector is called from the provider's cloud, so the server must be reachable publicly (the home server through Tailscale Funnel or a tunnel, or a hosted service): tailnet-only is not enough. |
| **OpenRouter or an API key** | yes, everywhere | The app calls the model itself. OpenRouter's sign-in flow (OAuth with PKCE) hands the app a key without pasting. Keys for Anthropic, OpenAI and Google work the same way. | Fully in the app: chat, marking, setting exercises. The key is kept in the device's secure storage. Paid per use. |
| **A self-hosted model** (Ollama, llama.cpp, vLLM, LM Studio) | yes, when reachable | One "OpenAI-compatible endpoint" setting (base URL, optional key) covers these, LiteLLM, and Gemini's compatible endpoint. | On the network or tailnet only, unless exposed. Small models do for quick checks but mark derivations less well; the app says so. |
| **A gateway on the tailnet** (holding an OpenRouter key, or fronting a local model) | yes: the best experience | The home `rdstudio serve` is the gateway. Devices on the tailnet use it without keys of their own, and Tailscale's identity headers say who is calling. It can also **run the teacher itself**: skills with tools, long jobs, and marking waiting answers as they arrive. | Pair with the home server once (QR code), and the AI works with no setup. |

# How it presents (the phone)

**Settings → Teacher → Where the teacher runs.** There is a default, and each
project can override it.

1. **Nowhere (the default).** Requests wait in the record until an agent
   runs, on the desktop or the home server, as today. Works offline.
2. **Your home server** (paired). Shows its model, and whether it marks
   automatically.
3. **OpenRouter.** "Sign in with OpenRouter", then choose models.
4. **Your own key:** Anthropic, OpenAI or Google.
5. **A custom endpoint:** an OpenAI-compatible URL.
6. **Your Claude or ChatGPT subscription.** Not a connection the app makes,
   but steps for adding rdstudio as a connector in that app: the address to
   paste, and the requirement that it be public.

Each choice states the same four things:
- **what it can do:** mark answers, chat here, run skills with tools;
- **when it works:** anywhere, on your network, or never offline;
- **what it costs:** your subscription, per use, or free (local);
- **who sees what:** which provider receives your notes and your profile.
  The profile is personal; some will not want it sent to a cloud provider.

**Where AI appears in the app:**
- "Mark now" on a waiting answer;
- "Ask the teacher" on a note, which opens a chat about it;
- "Set me an exercise";
- "What next?" in the Learn tab.

With "Nowhere", the same buttons queue the request instead.

**Models by job:** marking and quick questions can use a cheaper or local
model; building notes and running diagnostics, a strong one. One setting per
kind of job, with defaults.

# What holds it together

- **The skills do not change.** The [default skills](/design/teacher.md) and
  your customisations are plain text, given unchanged to whatever model runs
  them, wherever it runs: the teacher behaves alike everywhere.
- **The tools come from one place.** The MCP tools become a library:
  - called in-process by the app's own agent loop;
  - served over MCP by the home server and by `rdstudio mcp`;
  - reached remotely by a connector.
- **Two adapters:** Anthropic's Messages API, and the OpenAI-compatible API
  (OpenAI, OpenRouter, Gemini's compatible endpoint, Ollama, vLLM, LiteLLM).
  Calls from the app go through the native layer (Tauri), so browser
  cross-origin limits do not apply.
- **Nothing depends on a model.** It is off by default, and everything works
  without it.
- **Evidence keeps its source.** A marking records the model and the route
  in `by` (such as `openrouter/anthropic/claude-sonnet-5-5`), so the profile
  can weigh markings by who made them.

# Order

1. **The home server as the teacher.** Started by [work together](/design/tutor.md):
   `rdstudio serve` calls OpenRouter, which is the same thing on a laptop. An agent loop on `rdstudio serve`,
   with an OpenRouter or local model, marking waiting answers automatically.
   It builds on the home server of [projects, accounts and
   sync](/design/projects-and-sync.md), and gives every device, phone
   included, the best experience.
2. **OpenRouter or a key in the app,** for use away from home without a
   server.
3. **Connector instructions** for Claude and ChatGPT subscribers, with the
   need for a public address made plain.
4. **Chat and an agent loop in the app itself,** once the home-server teacher
   has shown what is needed.

# Open questions

- **Rules for connectors.** Which provider plans allow custom connectors on
  mobile, and how they authenticate (OAuth for remote MCP servers). Check
  each provider's documentation when building step 3; these change often.
- **Costs.** A budget per project, and showing the cost of a session.
- **Local models for marking.** Whether a local model's markings are good
  enough to count as evidence, or should count like self-marks (weaker,
  retested sooner).
