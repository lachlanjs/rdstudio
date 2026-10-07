---
type: Task
title: T92 — An organisation's own model gateway in OpenRouter's place
description: "A provider set in the user config: its address, key, headers, certificates and proxy,
  with spending from set prices, a command that diagnoses a failure, and a procedure that says where
  to patch what is not covered."
tags: [task, models, enterprise, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T05:40:28Z}
---

# Prompt

From the developer, 2026-10-07: to use rdstudio at work with
"enterprise-hosted models provided through a gateway with strict
certificate verification", then: "add what is missing to enable use of
enterprise hosted AI. Include documentation so that any potential gaps can
be patched in the corporate environment."

Which gateway, and how it authenticates, was not said. So the common ways
are all covered by settings and the rest is documented.

# Done

2026-10-07. The how-to is
[Use an organisation's own model gateway](/procedures/enterprise-models.md "requires").
It carries out the "OpenAI-compatible endpoint" option of
[AI providers](/design/ai-providers.md "uses").

- `packages/cli/src/provider.ts`: `[teacher.provider]` in the user config.
  The key from the environment, a file or a command; bearer, a named
  header, or none; extra headers and query; a file of authorities, a client
  certificate, a proxy.
- `models.ts`: every call goes through the provider. Plain-text messages
  with no cache marks unless asked; token counts requested; whole replies
  read as well as streamed; cost from set prices where none is reported;
  model names no longer have to look like OpenRouter's.
- Requests that need the provider's own authorities, certificate or proxy
  use Node's `https` directly, since `fetch` cannot be given them without a
  further dependency.
- `rdstudio provider` and `rdstudio provider check`.
- The Axis page names the gateway and offers no OpenRouter sign-in.
- A note's stamp names the gateway.
- Certificate verification cannot be switched off.

Checks: 7 tests in `provider.test.ts`, three of them against real local
HTTPS servers (a private authority, mutual TLS, a CONNECT proxy).
`rdstudio provider check` was run against a public site with a
self-signed certificate and said what to set.

# Not done

- Not run against a real enterprise gateway.
- The list under "Not covered" in the procedure.
- The walkthroughs do not cover the Axis page with a gateway set.
- The desktop and phone apps do not exist yet; this is `rdstudio serve`
  and the command line only.
