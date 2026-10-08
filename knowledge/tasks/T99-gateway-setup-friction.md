---
type: Task
title: T99 — Less friction setting up an organisation's gateway
description: "From a brief by an agent that set rdstudio up behind a corporate gateway: the changes
  worth making, in order, and the ones set aside with the reason for each."
tags: [task, models, enterprise, security, done]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T01:21:52Z}
---

# Prompt

The developer, 2026-10-08, passed on a brief written by another agent after
setting rdstudio up in a corporate environment (a gateway speaking the
OpenAI chat API, reached with a client certificate, through a proxy, with a
private authority and credentials that rotate), asked for it to be scoped,
and then: "Record as a task."

The brief's own framing holds: what
[T92](/tasks/T92-enterprise-provider.md "requires") built works, and these
remove friction. It was checked against `provider.ts`, `models.ts`,
`main.ts`, `pyproject.toml` and
[the procedure](/procedures/enterprise-models.md).

# Keep

The provider is read only from the user config; secrets come from the
environment, a file or a command and are never printed; there is no switch
that turns verification off; `ca_file` adds to the authorities and does not
replace them; `rdstudio provider` shows nothing secret.

# To do, in order

1. **Release.** T92 is not in `v0.2.0`, the last tag. The brief's
   "packaging" complaint is this and nothing else: the Node program in the
   wheel is the npm one. See [the release procedure](/procedures/release.md).
2. **`provider check` with no model asks for an OpenRouter name**
   (`models().check`, `google/gemini-3.8-flash`), so on a gateway it fails
   as installed. Use the low tier, or ask for a model. Not in the brief.
3. **An empty reply from the check.** It asks for 20 tokens; a model that
   reasons can spend them all and the check prints `It answered ""`. Ask
   for more, and say that it answered with no text.
4. **Tiers on a gateway.** With a `[teacher.provider]` url and no
   `[teacher.tiers]`, fail and name the setting, in place of sending
   OpenRouter's names.
5. **PKCS#12.** `client_pfx` and `pfx_password_env` (Node takes `pfx` and
   `passphrase`). Both a PFX and the PEM pair set is an error, not a
   precedence. Files exported from Windows often use old ciphers that Node
   24 refuses: `explain()` needs a line for it. `ownTransport()` must count
   it.
6. **A PEM key with a passphrase**: `client_key_passphrase_env`.
7. **The system's authorities.** Node 24 can read the system store
   (`tls.getCACertificates("system")`); on a managed machine it usually
   holds the organisation's authority already, which removes the `ca_file`
   step. The brief had this last; it belongs here.
8. **Verification in force whatever the environment says.**
   `rejectUnauthorized: true` in `tlsOptions()` overrides
   `NODE_TLS_REJECT_UNAUTHORIZED=0`, but only where `request()` is used. A
   gateway with no authority, certificate or proxy set goes through `fetch`,
   which honours the variable: every request to a custom provider has to go
   through `request()`. `provider check` says whether it was in force.
9. **Model names checked against the gateway's list** in `provider check`:
   `url + "/models"`, a warning for each tier or job model not in it, and
   silence where the gateway has no such list.
10. **`provider check --verbose`**: the address, the authorities, the client
    certificate, whether the tunnel was made, the status and body of a
    failure. Nothing secret, the body included.
11. **A client certificate near its end** warned of in `provider check`.
12. **Proxy**: `NO_PROXY` honoured with `proxy = "env"`; a 407 that names
    NTLM or Negotiate from `Proxy-Authenticate` and says it is not done.
13. **Failures by kind** (refused key, unknown model, chain, certificate
    demanded, proxy), each naming the one setting. How statuses are worded
    in `models.ts` was not read: look before building.
14. **`provider init`**, if still wanted: the largest item, and the
    procedure already has examples to copy. It must write no secret.
15. **Search by meaning from the Python package.** The wheel's artifacts are
    `_node/*.mjs` and the app; the npm package has `embed/`. Ship the model
    in the wheel, or document `RDSTUDIO_EMBED_DIR`, which exists. To be
    confirmed against a built wheel.

# Set aside

- **A CI gate for the two command lines agreeing.** The other one is
  `rdstudio-py`, kept "while it lasts"; a gate would bind the project to it.
- **Tiers filled from the gateway's list.** Which model is cheap cannot be
  told from a name, and a wrong guess spends money.
- **Defaulting to a model that does not reason.** rdstudio cannot tell.
- **A mirror for the search model.** Nothing is fetched when rdstudio runs.
- **Secrets from the system keychain.** `key_command` does it; an example
  in the procedure is enough.
- **Documenting where to patch for signing and other APIs.** The procedure
  has it ("Where to patch").
- **Finding the system's proxy, PAC files.** Large, and little gained over
  `proxy = "env"`.
- The brief's "plain `https://` gateway" as unsupported is the wrong way
  round: what is not done is a proxy before a plain `http://` gateway, and
  that already says so.

# What the other agent said (2026-10-08)

Two questions were put to it through the developer. It was on Linux; the
client identity came as one password-protected `.pfx`, the authority as a
PEM file apart; no PEM pair was given. The costliest step was taking a PEM
certificate and key out of the PFX, since rdstudio took only PEM: until
then the handshake failed with no client certificate shown. After that the
gateway answered 401 "No api key passed in." until a made-up bearer key was
added.

# Done (2026-10-08)

In `provider.ts`, `models.ts` and `main.ts`, with
[the procedure](/procedures/enterprise-models.md) brought up to date.

- `client_pfx` with `pfx_password_env` (default `RDSTUDIO_PFX_PASSWORD`) or
  `pfx_password_file`; `client_key_passphrase_env`; both a PFX and a PEM
  pair is an error. A wrong password, an old cipher and a key under a
  passphrase each have their own message.
- `system_ca = true` adds this machine's own store. Off unless set: what is
  trusted is not widened without being asked.
- `rejectUnauthorized: true` is said outright, and a gateway's requests all
  go through `request()` when `NODE_TLS_REJECT_UNAUTHORIZED=0` is set, so
  the variable does nothing to them. `rdstudio provider` has a
  `verification` line.
- On a gateway a job takes its tier's model where `[teacher.models]` gives
  it none: three names to set, not nine. The check asks the low tier.
  Nothing fails beforehand for unset names (a gateway may well use
  OpenRouter's); `provider` lists what is unnamed, and a 404 for one of
  rdstudio's own names says to set `[teacher.tiers]`.
- Refusals by kind: 401 with no key sent (the case above: set a bearer key,
  any value), 401 with a key, 403, 404 for an unknown model or a wrong
  address, 407.
- `provider check`: 512 tokens asked for and a plain line when the reply
  has no text; the names in use against `GET <url>/models` where there is
  such a list; a client certificate within thirty days of its end;
  `--verbose` for the proxy, both certificates and the body of a refusal.
- `proxy = "env"` passes by what `NO_PROXY` names; a 407 names what the
  proxy asked for and says NTLM and Kerberos are not done.
- `rdstudio provider` no longer prints a proxy's name and password: it
  printed the address whole before.

Tested: five new tests in `provider.test.ts` against real local servers
(148 in the package pass), and the command itself run against a local
gateway asking for a client certificate, through six setups.

Not done: `provider init` (item 14), and the search model in the Python
wheel (item 15; the npm package has it, and `RDSTUDIO_EMBED_DIR` is in the
procedure). Not tried against a real corporate gateway or proxy, nor
`system_ca` against a store that holds a private authority.
