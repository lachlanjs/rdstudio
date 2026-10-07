---
type: Procedure
title: Use an organisation's own model gateway
description: "Point rdstudio at an enterprise-hosted, OpenAI-compatible gateway in place of
  OpenRouter: the settings, certificates, proxies and keys, how to diagnose a failure, what is not
  covered, and where in the code to patch a gap."
tags: [procedure, models, enterprise, security]
generated: {by: claude-code/claude-opus-5-5, at: 2026-10-07T05:40:28Z}
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

1. Find your user config: `rdstudio provider` prints its path
   (`~/.config/rdstudio/config.toml` on Linux).
2. Add a `[teacher.provider]` table with at least `url`. See the settings
   and the examples below.
3. Name the models as the gateway names them, under `[teacher.tiers]` and
   `[teacher.models]`. The defaults are OpenRouter's names and will not
   exist on your gateway.
4. Run `rdstudio provider check`. It prints the settings as read (never the
   key), sends one small request, and says what came back or what to
   change.
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
| `key_command` | | A command that prints a token on its last line. |
| `key_ttl` | `600` | Seconds a command's token is kept. After a 401 the command is asked again once. |
| `auth` | `bearer` | `bearer`: `Authorization: Bearer KEY`. `header`: the key alone in `auth_header`. `none`: no key. |
| `auth_header` | `Authorization` | For example `api-key`. |
| `ca_file` | | A PEM file of authorities to trust **besides** the usual ones. |
| `client_cert`, `client_key` | | PEM files, for mutual TLS. |
| `proxy` | | `http://host:port`, with `user:password@` if needed; or `env` to use `HTTPS_PROXY`. |
| `stream` | `true` | `false` asks for one whole reply. |
| `tools` | `true` | `false` never offers tool calls; context is gathered for the model instead. |
| `cache_marks` | `false` | Send Anthropic's `cache_control` parts. Off, messages are plain strings. |
| `stream_usage` | `true` | Ask for token counts with a streamed reply. |
| `max_tokens_field` | `max_tokens` | Some models want `max_completion_tokens`. |
| `timeout` | `120` | Seconds. Applies when `ca_file`, a client certificate or `proxy` is set. |
| `[teacher.provider.headers]` | | Sent with every request. |
| `[teacher.provider.query]` | | Added to the address. |
| `[teacher.provider.prices]` | | `"model" = [in, out]` in US dollars a million tokens. |

The key is looked for in that order: the environment, the file, the
command.

# Certificates

Certificates are always verified, the name in them included. There is no
setting to turn that off, and none should be added.

- **A private authority.** Set `ca_file` to your organisation's
  authorities in PEM form. It adds to Node's own list.
- **Alternatively**, set `NODE_EXTRA_CA_CERTS` to that file before starting
  rdstudio. This also covers anything else rdstudio fetches. Recent Node
  versions can also use the operating system's store
  (`node --use-system-ca`); check that your Node has it.
- **A proxy that inspects traffic** re-signs every connection with its own
  authority. Treat that authority as above.
- **Mutual TLS.** Set `client_cert` and `client_key`.

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

[teacher.models]
hint = "gpt-4o-mini"
feedback = "claude-sonnet"
discuss = "claude-sonnet"
marking = "claude-sonnet"
check = "gpt-4o-mini"

[teacher.provider.prices]
"gpt-4o-mini" = [0.15, 0.6]
"claude-sonnet" = [3, 15]
```

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

`rdstudio provider check [model]` is the first thing to run. What it says:

| Message | Change |
|---|---|
| "certificate is not signed by an authority this machine trusts" | `ca_file`, or `NODE_EXTRA_CA_CERTS`. |
| "certificate is for another name" | Use the host name the certificate names. |
| "closed the connection while it was being set up" | It may want a client certificate. |
| "could not be found" or "could not be reached" | The address, the network, or `proxy`. |
| "the proxy refused the connection (407)" | The proxy wants a name and password in `proxy`. |
| "NAME said 401" or 403 | The key, `auth`, or `auth_header`. |
| "NAME said 400" mentioning `cache_control`, `stream_options`, `tools` or `max_tokens` | Set `cache_marks`, `stream_usage`, `tools` or `max_tokens_field`. |
| "NAME said 404" | `url`, `path`, or the model's name. |
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

# Not covered

Each of these needs code. "Where to patch" says where.

- **Request signing** (AWS Bedrock's own API, SigV4). Put an
  OpenAI-compatible gateway in front, or patch.
- **APIs that are not chat completions**: Anthropic's Messages API,
  Google's own, OpenAI's Responses API.
- **Proxies** that need NTLM or Kerberos, or are found through a PAC file.
  Only a named HTTP proxy with optional basic authentication is done.
- **A proxy for a plain `http://` gateway.**
- **Client keys with a passphrase**, PKCS#12 files, keys on a smart card or
  in the system keychain.
- **Several gateways at once**, or a different one per model.
- **Reasoning settings**, sampling settings and other extra request fields.
- **The OpenRouter sign-in on the Axis page** has no counterpart: a
  gateway's key is set outside the app.
- **Checking a model's name** against the gateway's list.

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
