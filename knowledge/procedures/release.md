---
type: Procedure
title: Release rdstudio
description: Publish a new version to npm and PyPI, with a GitHub Release, by pushing a version tag; the release workflow does the rest.
tags: [release, npm, pypi, ci]
start: setup-github
nodes:
  - {id: setup-github, label: Create the release environment on GitHub}
  - {id: setup-npm, label: Trust the workflow on npm}
  - {id: setup-pypi, label: Trust the workflow on PyPI}
  - {id: version, label: Set the new version}
  - {id: merge, label: Merge to main}
  - {id: tag, label: Tag and push}
  - {id: approve, label: Approve the release}
  - {id: check, label: Check the three places}
edges:
  - {from: setup-github, to: setup-npm, relation: LEADS_TO, condition: "Once.", guidance: "github.com/lachlanjs/rdstudio, Settings, Environments, New environment, name it release. Tick Required reviewers and add yourself, so nothing publishes without your approval. Under Deployment branches and tags, allow only tags matching v*."}
  - {from: setup-npm, to: setup-pypi, relation: LEADS_TO, condition: "Once.", guidance: "npmjs.com/package/rdstudio, Settings, Trusted Publisher, GitHub Actions: owner lachlanjs, repository rdstudio, workflow release.yml, environment release (lower case, as the workflow names it). Leave Allow npm publish unticked: the workflow only stages the version, and it goes live when you approve it with 2FA. Then, under Publishing access, choose to require two-factor authentication and disallow tokens: only the workflow (and you, with 2FA) can publish."}
  - {from: setup-pypi, to: version, relation: LEADS_TO, condition: "Once.", guidance: "Make a PyPI account with two-factor authentication. Account settings, Publishing, Add a new pending publisher, GitHub: PyPI project name rdstudio, owner lachlanjs, repository rdstudio, workflow name release.yml, environment name release. The first release creates the project.", pitfalls: "A pending publisher does not reserve the name; publish soon after setting it up. rdstudio was free on PyPI on 2026-09-30."}
  - {from: version, to: merge, relation: LEADS_TO, guidance: "mise run version 0.2.1 (sets pyproject.toml, packages/cli/package.json, main.ts and __init__.py), then uv lock and npm install, and commit.", pitfalls: "Every version number can be published only once, on npm and on PyPI. 0.1.0 is taken on npm."}
  - {from: merge, to: tag, relation: LEADS_TO, guidance: "Releases are made from main: merge the milestone branch with --no-ff as usual."}
  - {from: tag, to: approve, relation: TRIGGERS, guidance: "git tag v0.1.1 && git push origin main v0.1.1. The tag must be v followed by the version; the workflow checks it first.", condition: "Pushing a tag starting with v."}
  - {from: approve, to: check, relation: LEADS_TO, guidance: "The workflow tests everything and builds the wheel, the source archive and the npm package, then waits: open the run under Actions and choose Review deployments, Approve. It publishes to PyPI, stages the version on npm, then creates the GitHub Release with the three files. Last, approve the staged version on npm: npmjs.com, rdstudio, the staged version, Approve (or npm stage list rdstudio, then npm stage approve <id>).", pitfalls: "If tests or the build fail, nothing is published: fix, move the tag (git tag -f, git push -f origin v0.1.1) and push again. If one registry succeeded and the other failed, re-run only the failed job; PyPI skips files it already has. The workflow is read from the tagged commit, so a fix to the workflow itself needs the tag moved. npm answers 404 (not 403) when the trusted publisher does not match the run, or when it allows only staging and the workflow publishes directly. A version nobody approves on npm is never published."}
  - {from: check, to: version, relation: LEADS_TO, condition: "The next release.", guidance: "npm view rdstudio version; uvx rdstudio@0.1.1 --version (PyPI); npx rdstudio@0.1.1 --version; the release page lists the files."}
---

# How it works

`.github/workflows/release.yml` runs on a pushed tag `v*`:

1. **build:** checks the tag matches the version, runs the Python and
   TypeScript tests and the type check, builds the npm package
   (`scripts/npm-package.ts`), the bundled Node program and the Python wheel
   and source archive (`uv build`), and checks the wheel carries the Node
   program.
2. **npm** and **pypi:** in the `release` environment (your approval), each
   publishes with trusted publishing: the registry checks a short-lived
   identity token from GitHub for this repository, workflow and environment,
   so no password or token is stored anywhere. npm only stages the version:
   it goes live when you approve it on npmjs.com with your 2FA, a second
   gate that someone inside your GitHub account cannot pass.
3. **github:** creates the GitHub Release for the tag, with the three files
   and notes generated from the commits.

# Checked (2026-09-30)

The workflow file passes actionlint. The build job's commands ran in a fresh
clone with a clean `npm ci`: 57 Python tests, 196 TypeScript tests and the
type check passed, and it produced `rdstudio-0.1.0-py3-none-any.whl` (with
the bundled program), `rdstudio-0.1.0.tar.gz` and `rdstudio-0.1.0.tgz`. The
publish jobs have not run yet: they need the one-time setup above.

The manual way, for npm only, is [publish to npm](/procedures/publish-npm.md).
