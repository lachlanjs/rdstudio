---
type: Procedure
title: Publish rdstudio to npm
description: Put a version of rdstudio on the npm registry, so anyone can run it with npx rdstudio or npm install -g rdstudio.
tags: [release, npm, distribution]
start: account
nodes:
  - {id: account, label: Create an npm account with two-factor authentication}
  - {id: version, label: Set the version everywhere}
  - {id: stage, label: Build and pack the package}
  - {id: rehearse, label: Try the packed file}
  - {id: login, label: Log in from the terminal}
  - {id: publish, label: Publish}
  - {id: check, label: Check the published package}
  - {id: automate, label: Publish from CI instead}
edges:
  - {from: account, to: version, relation: LEADS_TO, guidance: "Sign up at npmjs.com and turn on two-factor authentication (an authenticator app); npm requires it to publish. Once."}
  - {from: version, to: stage, relation: LEADS_TO, guidance: "The same version in pyproject.toml, packages/cli/package.json and VERSION in packages/cli/src/main.ts; the staging script refuses to run otherwise.", pitfalls: "A version number can be published only once, ever, even if it is later withdrawn. Fix mistakes with a new version."}
  - {from: stage, to: rehearse, relation: PROVIDES_INPUT_FOR, guidance: "mise run release:npm writes .release/npm/ and rdstudio-<version>.tgz, and prints the file count and size."}
  - {from: rehearse, to: login, relation: LEADS_TO, guidance: "npx --yes --package=.release/npm/rdstudio-<version>.tgz rdstudio check, in a project; or npm install -g the .tgz. Check the file list with tar tzf: only rdstudio.mjs, web/, templates/, README.md, LICENSE and package.json."}
  - {from: login, to: publish, relation: LEADS_TO, guidance: "npm login (opens the browser). npm whoami confirms it."}
  - {from: publish, to: check, relation: LEADS_TO, guidance: "cd .release/npm && npm publish. The first publish claims the name rdstudio.", pitfalls: "Publishing is public at once. A version can be withdrawn only within 72 hours (npm unpublish rdstudio@<version>), and its number stays used."}
  - {from: check, to: automate, relation: LEADS_TO, condition: "After the first manual publish works.", guidance: "npx rdstudio@<version> --version in a fresh folder; the page is npmjs.com/package/rdstudio. Later: a GitHub Actions workflow on version tags with npm trusted publishing (no token stored), building the Python wheel in the same run."}
---

# What is published

One bundled program (`rdstudio.mjs`: the command line, the TypeScript core
and every dependency, so the package depends on nothing), the dashboard's
files (`web/`), the `init` templates (`templates/`), a short README and the
MIT licence: about 230 files, 4 MB packed. It needs Node 24 or later and git.
The program finds `web/` and `templates/` beside itself.

# Checked (2026-09-29, version 0.1.0, not published)

The packed file, installed with `npm install -g` into a scratch prefix with an
empty home and Node 24.21, ran `--version`, `check`, `search`, `path`,
`build`, `init` (in a fresh git repository) and `serve` (the page, the data
and `/api/openapi.json`) on a copy of the differential geometry bundle, and
the MCP server answered twelve tools and a `study_path` call through the
official client. `npx --package=<tgz> rdstudio check` worked too, as did Node
26. The names `rdstudio` and `@rdstudio/core` were free on npm.
