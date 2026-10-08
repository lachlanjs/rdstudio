---
type: Task
title: "T106 — rdstudio provider init: set up an organisation's gateway by answering questions"
description: A command that asks for the gateway's address, certificates, proxy and model names,
  writes the settings, and runs the check, left over from T99.
tags: [task, m16, provider, enterprise, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:49:36Z}
---

# Prompt

The developer, 2026-10-08, on [T99](/tasks/T99-gateway-setup-friction.md):
"The point of this is to make setting up rdstudio with AI in a corporate
environment as easy as possible."

`provider init` was in the brief behind T99 and was not built in 0.4.0.
Raised again by the agent on 2026-10-08 when asked what would improve the
project.

# What exists

- `rdstudio provider show` and `rdstudio provider check [model] [--verbose]`
  (`packages/cli/src/main.ts`).
- The settings, in the user's configuration only:
  [an organisation's models](/procedures/enterprise-models.md).
- Messages for each way a request fails (`provider.ts`, `models.ts`).

# To settle before a plan

- Whether it asks questions at the terminal, takes flags, or both. A
  corporate machine may have no way to paste, so few and short answers.
- Whether it can find things out itself: a PFX file or PEM pair in usual
  places, the proxy from the environment, the model list from the gateway.
- That it never writes a password or key into the file: it names the
  environment variable or the password file.
- Whether the search model in the Python wheel, also left from T99, belongs
  here or in [retiring the Python implementation](/tasks/T102-retire-python.md).

# Plan

(Filled in by the agent before implementation.)

# Acceptance

- From a machine with nothing set, `rdstudio provider init` ends with
  settings written and `provider check` passing, or with the one message
  that says what to fix.
- No secret is written to the configuration file.
- The procedure note's steps begin with this command.

# Outcome

Done on 2026-10-08, on the branch `feat/m16-leaner`; not committed.
Approved with the rest ("Go ahead with things").

**What it does.** `rdstudio provider init` sets up a gateway from about
eight one-line answers, most of them Enter, or from flags with no
questions. It writes `[teacher.provider]`, names the three tiers from the
gateway's own list of models, and runs the check. Described at the head of
[an organisation's models](/procedures/enterprise-models.md).

**Settled** (the points in "To settle before a plan"):

- **Both:** questions at a terminal, flags without one.
- **It finds what it can:** a `.pfx` or `.p12` and an authority's `.pem`
  in the folder it is run in, the home folder, `~/.config`, `~/certs`,
  `~/.certs` and `~/Downloads`; a proxy in `HTTPS_PROXY`; the models from
  the gateway.
- **No secret is asked for or written.** A key's and a password's
  environment variable is asked for by name, and a value that does not
  look like a name is refused, so a key pasted there by mistake is not
  written.
- **The search model in the wheel** is not part of this.

**How.** `packages/cli/src/providerinit.ts` (the checks, the table, what
is to hand, the questions) and the `init` action in `main.ts`.

**Checked.**

- Five unit tests: each mistake and its message, the table as written with
  the tables under it left alone and read back by the program, what is
  found on the machine, the questions for three cases, and the tiers.
- Run for real against a stand-in gateway on this machine: by flags (the
  table written, the tiers set, the check passing), refused where a
  gateway is set, refused for a key given where a name was wanted, and
  refused with no terminal and no address.
- At a pretend terminal, typing the answers: a wrong address asked again,
  a path with no file asked again, the models chosen by number, the check
  passing.

**Found by running it at the terminal,** and fixed: answering `n` to a
question that wants a path was taken as a path, and failed only after
every other answer; the default name for a bare address was `0`; and
Ctrl+D at a question printed a stack trace.

**Not checked.**

- Against a real corporate gateway, with a real PFX, private authority or
  proxy. The settings it writes are the ones T99 tested against a local
  gateway with mutual TLS; this command's own run used no TLS.
- On Windows or macOS: the folders searched, and the advice to `export`.
- The check after `init` when a password is needed: it is skipped, and the
  variables to set are named.
