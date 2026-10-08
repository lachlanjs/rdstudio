---
type: Procedure
title: Use an organisation's own model gateway
description: "Point rdstudio at an enterprise-hosted, OpenAI-compatible gateway in place of
  OpenRouter: the settings, certificates, proxies and keys, how to diagnose a failure, what is not
  covered, and where in the code to patch a gap."
tags: [procedure, models, enterprise, security]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-08T12:49:26Z}
---

# What this covers

The features that call a model from inside rdstudio: Axis in the editor,
Ask Atlas, and the tutor. As it comes, they call OpenRouter. This sets them
to call a gateway your organisation runs.

It does not concern agents that reach rdstudio from outside (Claude Code and
other harnesses, through the MCP server). They use whatever model their own
harness is set up with, and need nothing here.

Search by meaning runs on the machine and calls nothing.

**Status.** Built 2026-10-07 ([T92](/tasks/T92-enterprise-provider.md "see also")).
Tested against stand-in gateways and real local HTTPS servers with a
private authority, a client certificate and a proxy. It has **not** been
run against any real enterprise gateway. Expect to adjust a setting or two,
and see "Where to patch" if a setting is not enough.

# What the gateway must do

Speak the OpenAI chat completions protocol: `POST …/chat/completions` with
`model` and `messages`, replying with `choices`. LiteLLM, Azure OpenAI,
vLLM, Portkey, Kong AI Gateway and most others do.

Helpful but not required: streamed replies, tool calls, token counts.

# Steps

The short way, at a terminal:

```sh
rdstudio provider init
```

It asks for the gateway's address, how the gateway knows who you are (a
client certificate, a key, or both), how this machine trusts it, and a
proxy if there is one. Each answer is one line, and most take Enter. It
offers what it finds: a `.pfx` or `.p12` file and an authority's `.pem` in
the usual folders, and a proxy in `HTTPS_PROXY`. It then lists the
gateway's models for you to choose three, writes the settings, and runs
the check.

- **It never asks for a key or a password**, and writes none. It asks for
  the name of the environment variable that will hold each, and tells you
  which are not set yet.
- A path with no file there is asked again at once; `n` means none.
- With flags it asks nothing, for a script or a machine with no terminal:
  `rdstudio provider init --url https://ai.acme.example/v1 --client-pfx
  ~/id.p12 --ca-file ~/corp-ca.pem --proxy env --low M --mid M --max M`.
  `rdstudio provider --help` lists them.
- Where a gateway is already set it asks before replacing it (`--force`
  with flags). The whole `[teacher.provider]` table is replaced; the
  tables under it (headers, query, prices) are left.

By hand, which does the same:

1. Find your user config: `rdstudio provider` prints its path
   (`~/.config/rdstudio/config.toml` on Linux).
2. Add a `[teacher.provider]` table with at least `url`. See the settings
   and the examples below. A client identity handed out as one `.pfx` or
   `.p12` file is named as it is (`client_pfx`): nothing has to be taken
   out of it first.
3. Name three models as the gateway names them, under `[teacher.tiers]`
   (`low`, `mid`, `max`). The defaults are OpenRouter's names and will not
   exist on your gateway. Each job (hints, feedback, marking, the check)
   takes its tier's model unless `[teacher.models]` gives it one of its own.
4. Run `rdstudio provider check`. It prints the settings as read (never a
   key or a password), says which models are still unnamed, sends one small
   request, says what came back or which one setting to change, and
   compares the names in use with the gateway's own list where it has one.
   `--verbose` adds what the connection was made with: the proxy, the
   gateway's certificate and who signed it, the client certificate and when
   it runs out, and the body of a refusal.
5. Restart `rdstudio serve`. The Axis page then names the gateway.

The provider is read from the **user** config only. A project's
`rdstudio.toml` cannot set it, so a repository you clone cannot redirect
where your notes are sent.

# Settings

All under `[teacher.provider]`. Only `url` is required.

| Setting | Default | Meaning |
|---|---|---|
| `url` | | The base address. `path` is added to it. |
| `name` | the host | What it is called in the app and in a note's stamp. |
| `path` | `/chat/completions` | |
| `key_env` | `RDSTUDIO_PROVIDER_KEY` | Environment variable holding the key. |
| `key_file` | | A file holding the key. `~/` is your home. |
| `key_command` | | A command that prints a token on its last line. This is also how a key is read from the system's keychain (`secret-tool lookup …`, `security find-generic-password -w …`). |
| `key_ttl` | `600` | Seconds a command's token is kept. After a 401 the command is asked again once. |
| `auth` | `bearer` | `bearer`: `Authorization: Bearer KEY`. `header`: the key alone in `auth_header`. `none`: no key. |
| `auth_header` | `Authorization` | For example `api-key`. |
| `ca_file` | | A PEM file of authorities to trust **besides** the usual ones. |
| `system_ca` | `false` | `true` also trusts the authorities in this machine's own store, where a managed machine usually has the organisation's. |
| `client_cert`, `client_key` | | PEM files, for mutual TLS. |
| `client_key_passphrase_env` | | Environment variable holding the passphrase of `client_key`, where it has one. |
| `client_pfx` | | A PKCS#12 file (`.pfx`, `.p12`) holding the certificate and key, in the pair's place. Setting both is an error. |
| `pfx_password_env` | `RDSTUDIO_PFX_PASSWORD` | Environment variable holding the file's password. |
| `pfx_password_file` | | Or a file holding it. The environment is looked in first. |
| `proxy` | | `http://host:port`, with `user:password@` if needed; or `env` to use `HTTPS_PROXY`, passed by for the hosts `NO_PROXY` names. |
| `stream` | `true` | `false` asks for one whole reply. |
| `tools` | `true` | `false` never offers tool calls; context is gathered for the model instead. |
| `cache_marks` | `false` | Send Anthropic's `cache_control` parts. Off, messages are plain strings. |
| `stream_usage` | `true` | Ask for token counts with a streamed reply. |
| `max_tokens_field` | `max_tokens` | Some models want `max_completion_tokens`. |
| `timeout` | `120` | Seconds. Applies when `ca_file`, `system_ca`, a client certificate or `proxy` is set. |
| `[teacher.provider.headers]` | | Sent with every request. |
| `[teacher.provider.query]` | | Added to the address. |
| `[teacher.provider.prices]` | | `"model" = [in, out]` in US dollars a million tokens. |

The key is looked for in that order: the environment, the file, the
command.

A gateway that knows you by your certificate may still want a key in a
header (it answers 401, "no api key"). Any value often does: leave `auth`
as `bearer` and set `RDSTUDIO_PROVIDER_KEY` to one.

# Certificates

Certificates are always verified, the name in them included. There is no
setting to turn that off, and none should be added.
`NODE_TLS_REJECT_UNAUTHORIZED=0` in the environment does not turn it off
for a gateway either; `rdstudio provider` says when it is set.

- **A private authority.** Set `ca_file` to your organisation's
  authorities in PEM form, or `system_ca = true` where this machine's own
  store already holds them. Both add to Node's own list.
- **Alternatively**, set `NODE_EXTRA_CA_CERTS` to that file before starting
  rdstudio. This also covers anything else rdstudio fetches.
- **A proxy that inspects traffic** re-signs every connection with its own
  authority. Treat that authority as above.
- **Mutual TLS.** Set `client_pfx` and its password, or `client_cert` and
  `client_key` (with `client_key_passphrase_env` where the key has a
  passphrase).
- **An old PKCS#12 file.** One protected with RC2 or 3DES, as older tools
  export, is refused by Node 24. The message says so and gives the two
  `openssl` commands that write it again.
- **A client certificate about to run out.** `rdstudio provider check`
  says so within thirty days of the end.

# Examples

A LiteLLM or similar gateway with a private authority:

```toml
[teacher.provider]
name = "acme"
url = "https://ai.acme.example/v1"
key_env = "ACME_AI_KEY"
ca_file = "/etc/ssl/certs/acme-ca.pem"

[teacher.tiers]
low = "gpt-4o-mini"
mid = "claude-sonnet"
max = "claude-opus"

[teacher.provider.prices]
"gpt-4o-mini" = [0.15, 0.6]
"claude-sonnet" = [3, 15]
```

The jobs take their tier's model. `[teacher.models]` is only for a job
that should have another (`hint`, `feedback`, `discuss`, `marking`,
`check`).

A client identity handed out as one password-protected `.pfx`, the
authority as a PEM file beside it, and the corporate proxy from the
environment:

```toml
[teacher.provider]
name = "acme"
url = "https://ai.acme.example/v1"
ca_file = "~/.acme/acme-ca.pem"
client_pfx = "~/.acme/me.pfx"
pfx_password_env = "ACME_PFX_PASSWORD"
proxy = "env"

[teacher.tiers]
low = "gpt-4o-mini"
mid = "claude-sonnet"
max = "claude-opus"
```

with `ACME_PFX_PASSWORD` set in the environment, and
`RDSTUDIO_PROVIDER_KEY` set to any value if the gateway wants a key in a
header even so.

Azure OpenAI (one deployment; every tier must name it, since the address
chooses the model):

```toml
[teacher.provider]
name = "azure"
url = "https://acme.openai.azure.com/openai/deployments/gpt-4o-prod"
auth = "header"
auth_header = "api-key"
key_env = "AZURE_OPENAI_KEY"
max_tokens_field = "max_completion_tokens"
[teacher.provider.query]
api-version = "2024-10-21"
```

A short-lived token, a client certificate and a proxy:

```toml
[teacher.provider]
url = "https://ai.acme.example/v1"
key_command = "acme-sso token --audience ai-gateway"
key_ttl = 900
client_cert = "~/.acme/client.pem"
client_key = "~/.acme/client.key"
proxy = "http://proxy.acme.example:8080"
```

# When a request fails

`rdstudio provider check [model]` is the first thing to run, and
`--verbose` the second. What it says:

| Message | Change |
|---|---|
| "certificate is not signed by an authority this machine trusts" | `system_ca = true`, `ca_file`, or `NODE_EXTRA_CA_CERTS`. |
| "certificate is for another name" | Use the host name the certificate names. |
| "closed the connection while it was being set up" | It may want a client certificate: `client_pfx`, or `client_cert` and `client_key`. |
| "PKCS#12 file's password is wrong or missing" | `pfx_password_env` or `pfx_password_file`. |
| "protected with an old cipher" | Write the PKCS#12 file again, as the message says. |
| "client key is kept under a passphrase" | `client_key_passphrase_env`. |
| "did not accept the client certificate" or "has expired" | A new client certificate. |
| "could not be found" or "could not be reached" | The address, the network, or `proxy`. |
| "the proxy asks for a name and password (407)" | Put them in `proxy`. |
| "the proxy asks for a sign-in rdstudio does not do (407: NTLM…)" | A local proxy that signs in for you, named as `proxy`. |
| "NAME said 401 … No key is sent" | `auth = "bearer"` and a key, any value where the certificate is what counts. |
| "NAME said 401 … The key was not accepted" | The key, `auth`, or `auth_header`. |
| "NAME said 403" | Access to the model or the gateway, granted by its owner. |
| "NAME said 404 … is rdstudio's own choice" | `[teacher.tiers]`. |
| "NAME said 404 … has no model called" | The model's name (the check lists what is offered), or `url` and `path`. |
| "NAME said 400" mentioning `cache_control`, `stream_options`, `tools` or `max_tokens` | Set `cache_marks`, `stream_usage`, `tools` or `max_tokens_field`. |
| "It answered, with no text" | Nothing is wrong with the connection: the model spent its allowance reasoning. Try another model. |
| "NAME does not list MODEL" | The tier or job named beside it. |
| "No token counts came back" | `stream_usage = true`, or `stream = false`. |
| Text arrives all at once | The gateway or a proxy buffers streams. Harmless; `stream = false` says so plainly. |

# What is sent, and what is kept

- Sent to the gateway: the instructions, the note being edited or the
  question, and whatever the model looks up (sections of notes, lines of
  files git tracks). Nothing else, and to nowhere else.
- With a gateway set, nothing is sent to OpenRouter: not the key, not the
  two headers that name rdstudio.
- Kept on the machine: a line per request in the usage log, beside the
  learner record, with the model, token counts and cost. Requests and
  replies are not kept.
- A note that takes a model's text is stamped
  `human:you with NAME/model`.

# Spending

OpenRouter reports what each request cost. A gateway usually does not, so
set `[teacher.provider.prices]` for each model. Without a price a request
counts as nothing and the weekly budget stops nothing. If the gateway does
send `usage.cost`, that is used.

Cached tokens are not priced apart.

# Limits

How much is sent to a model in one call, and how long its reply may be, can
be set for each tier ([T110](/tasks/T110-context-limits-settings.md)). Set
them on the Teacher page, under Limits, or in the user config:

```toml
[teacher.limits]
low = { output = 4096 }
mid = { input = 60000, output = 8000 }
```

Both are in tokens, and either may be left out. `rdstudio provider show`
prints the ones in force.

- **`input`:** the most sent in one call. What was looked up and gathered
  is shortened to fit, in proportion. The instructions, your own words and
  the passage being changed are never cut; if those alone are over the
  limit, the request is refused with the two figures. While the model looks
  things up, what a tool answers is cut to the room left, and it is told to
  reply. Set it under the model's context window, with room for the reply.
  Tokens are estimated at four characters each, so leave a margin.
- **`output`:** sent as the reply's limit in place of rdstudio's own
  figure, which differs by the kind of request (900 for an answer, more for
  a rewrite). Set it lower where the gateway allows less. Set it higher for
  a model that spends its reply on reasoning: with such a model rdstudio's
  own figure can leave no room for the answer.
- A reply that stops at the limit says so under it.
- Hints take the low tier's limits; feedback, discussion and marking the
  mid tier's.

With none set, nothing changes.

# Not covered

Each of these needs code. "Where to patch" says where.

- **Request signing** (AWS Bedrock's own API, SigV4). Put an
  OpenAI-compatible gateway in front, or patch.
- **APIs that are not chat completions**: Anthropic's Messages API,
  Google's own, OpenAI's Responses API.
- **Proxies** that need NTLM or Kerberos, or are found through a PAC file
  or the system's settings. Only a named HTTP proxy with optional basic
  authentication is done; the refusal names what the proxy asked for.
- **A proxy for a plain `http://` gateway.**
- **Keys on a smart card.**
- **Several gateways at once**, or a different one per model.
- **Reasoning settings**, sampling settings and other extra request fields.
- **The OpenRouter sign-in on the Axis page** has no counterpart: a
  gateway's key is set outside the app.
- **Writing the settings for you** (`provider init`): the table is written
  by hand, from the examples below.

Search by meaning needs no network: its model comes inside the npm
package. Where rdstudio was installed another way and has none,
`RDSTUDIO_EMBED_DIR` names a folder holding `model.onnx`,
`tokenizer.json`, `tokenizer_config.json` and `ort.wasm`.

# Where to patch

Everything is in two files of `packages/cli/src/`.

| To change | Look at |
|---|---|
| A new setting | `provider()` in `provider.ts`: read it there and add it to the `Provider` type. |
| How the key or a signature goes on a request | `authHeaders()` in `provider.ts`. For signing, the body is needed too: sign in `send` inside `complete()` in `models.ts`, which has both. |
| Where a key comes from | `providerKey()` in `provider.ts`. |
| The connection (TLS options, proxy) | `request()`, `tlsOptions()` and the `Tunnel` class in `provider.ts`. |
| The request's body (extra fields, another message shape) | `complete()` and `wire()` in `models.ts`. |
| Reading a reply in another shape | The two branches after the request in `complete()`: whole replies and streamed ones. |
| What an error message advises | `explain()` in `provider.ts`. |
| Recognising "this model cannot call tools" | `noTools` in `assist.ts`. |
| The name in a note's stamp | `withModels()` in `edit.ts`. |

To try a patch without the gateway, the tests in
`packages/cli/test/provider.test.ts` stand one up: a fetch that records
what it is sent, and local HTTPS servers with a private authority made by
`openssl`. Run them with `npm test --workspace rdstudio`. From a checkout,
`node packages/cli/src/main.ts provider check` runs the patched code
directly, with no build step.
