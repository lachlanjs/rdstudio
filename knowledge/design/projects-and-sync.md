---
type: Design
title: "Projects, accounts and sync"
description: "How the app manages several projects across devices: plain git for content, GitHub as the first-class sign-in and host, a private learner repository for everything about you, and self-hosted servers paired by QR code or found on the local network."
status: draft
tags: [design, platform, sync]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-02T18:00:00Z }
---

# Purpose

The app on a phone, or anywhere away from the machine running
`rdstudio serve`, must hold several projects at once, work offline, and keep
them in step with the desktop. This design makes [platform](/design/platform.md)
A4 to A7 and C3 concrete, for [T41](/tasks/T41-local-first-sync.md) and
[T42](/tasks/T42-mobile-apps.md).

# Three kinds of project

| Scenario | Example | Hosted | Learning |
|---|---|---|---|
| Shared project | a team's or an open project's knowledge base | GitHub (public or private), or self-hosted | per person, never in the repository |
| Personal | a learning project (the [DMFT trial](/tasks/T46-dmft-trial.md)), your global knowledge base | a private repository on GitHub, or self-hosted | usually on |
| Self-hosted | any of the above, on a home server | `rdstudio serve`, over the LAN, a tailnet or a tunnel | as above |

# Content syncs as plain git

- **The device holds the files.** Each project is a shallow git clone on the
  device (gitoxide or libgit2 in Tauri, isomorphic-git in a browser). Notes,
  states, the map and search are derived there by the TypeScript core
  (platform A3), so the app works offline.
- **Edits are commits.** An edit on the device is a local commit, pushed when
  there is a connection: the same history as the desktop's, with no
  translation layer.
- **Conflicts:** a note changed on both sides opens the editor's existing
  conflict view (theirs or yours), note by note (A6).
- **History on demand:** older history is fetched only when needed, such as
  when "what changed" is opened on a note.
- **Any host works.** Content moves only through the git protocol, so GitHub,
  GitLab, Gitea and a home `rdstudio serve` are interchangeable. Nothing
  depends on a host's own API except signing in and listing repositories.

# GitHub: the first-class route, not a dependency

- **Signing in:** GitHub's device flow. The app shows a code, you approve it
  on github.com, and the token is kept in the device's secure storage.
- **Access:** a GitHub App installed on the repositories you choose, or a
  fine-grained token limited to them, never access to all your repositories.
- **Finding projects:** the repositories you can reach that hold
  `rdstudio.toml`. You choose which to keep on the device.
- **Optional extras:** GitHub-only features (Pages previews, linking issues
  to tasks) stay optional.
- **Other hosts:** a URL with a token or an SSH key.

# The private learner repository

The learner records and teacher folders must never enter a project's
repository, least of all a team's. So all of them live in one private
repository of your own, such as `you/rdstudio-learner`, on GitHub or a home
server:

```
rdstudio-learner/
  you/                    # about you, across projects: profile, skill customisations
  learners/<project-id>/  # one per project, as on the desktop today
    record.jsonl
    tours/
    teacher/
```

- **Merging between devices is a union.** Events are only ever appended and
  carry unique ids (T31), so a merge keeps every event from both sides.
  Teacher files merge as git merges text.
- **One place for what is about you.** It holds the user-wide skill
  customisations and the "About you" that spans projects, which are now kept
  per project (see "Several knowledge bases" below).
- **Encryption, for whoever wants it.** On GitHub the repository is private
  but not encrypted. Optional encryption on the device, before pushing,
  covers that. It is required for any hosted service run for others.
- **Set up once.** On first run the app finds this repository or offers to
  create it, and that one choice decides where everything about you syncs.
- **On the desktop**, `[learner] path` points at a clone of it, so `rdstudio
  serve` and the agents write there.

# The first screen: your projects

1. **Sign in or add a server:** "Sign in with GitHub", and "Add a server"
   (scan a code, or choose one found on this network).
2. **The list:** projects from every source, each with:

| Annotation | Source |
|---|---|
| Title | `[project] title` in `rdstudio.toml` |
| Last opened / last updated | opened: kept on the device; updated: the latest commit, from the host |
| Learning on | whether you keep a learner record for it: yours, not the repository's |
| Public / private | the host (GitHub's API, or the server's settings) |
| Individual / team | `[project] kind = "individual" \| "team"` in `rdstudio.toml`, set by `rdstudio init`; if unset, guessed from the number of collaborators |
| GitHub / self-hosted | where it syncs |
| Waiting for you | reviews due, answers marked, notes changed since you looked |

The learner repository is not listed as a project. It sits under "You",
with your profile and the settings that span projects. The global knowledge
base is listed as a private, individual project.

# Self-hosted servers

`rdstudio serve` becomes a home server:
- **Several projects:** it serves every project in a folder you name, with an
  index for the app to list.
- **Git over HTTP:** each project is served by git's smart HTTP protocol, so
  self-hosted sync is plain git, as with GitHub.
- **Device tokens:** each paired device gets a lasting token, which it can
  revoke. This replaces the per-run write token for remote devices.

How the app finds a server, in the order to build:

1. **Pairing by QR code (the main route).**
   - `rdstudio serve` shows a code holding its address (a Tailscale name, a
     LAN address or a tunnel URL) and a one-time pairing secret.
   - The app scans it and receives its device token.
   - It works the same over Wi-Fi, a tailnet or a tunnel, needs no discovery
     and no third-party credentials, and is done once per server, not per
     project.
2. **Discovery on the same network.**
   - The server announces itself over mDNS (`_rdstudio._tcp`), and the app
     lists what it hears ("rdstudio on homebox: 4 projects").
   - Pairing still follows.
3. **Discovery across a tailnet (optional).**
   - Tailscale does not carry multicast, so mDNS does not reach across a
     tailnet.
   - With a Tailscale API access token (or an OAuth client from the admin
     console), the app can list the tailnet's devices and look for an
     rdstudio server on each.
   - The phone still needs the Tailscale app connected to reach them.
   - It is more credentials for little gain over scanning a code once; build
     it only if pairing proves a nuisance.
   - **Rejected:** building Tailscale into the app (`libtailscale`), so the
     app joins the tailnet itself. It is a large effort, and awkward beside
     the Tailscale app on Android.

# Agents and the phone

Without a model connected (see [where the teacher runs](/design/ai-providers.md)),
agents do not run on the phone. Answers left for an agent wait in the record,
sync to the desktop, are marked there by an agent, and the markings sync back:
the queue that exists today, across devices.

# Several knowledge bases

Today each project's teacher folder holds its own skill customisations and
profile. With the learner repository, both gain a user-wide layer:
- **Skills:** a customisation in `you/skills/` applies to every project
  unless the project overrides it.
- **About you:** `you/profile.md` holds what is about the learner rather than
  the subject ("derivation before intuition"), with evidence still linked to
  each project's record.

This can come before sync. Pointing `[learner] path` at a private repository
gives it on the desktop alone.

# Risks and order

1. **Check git on Android inside Tauri first.** gitoxide or libgit2, a
   shallow clone, push with a token. A day's spike, and the main technical
   risk.
2. **Then:** the learner repository with its user-wide layer (desktop first),
   the home server (several projects, git over HTTP, device tokens, QR
   pairing), and GitHub sign-in with the project list.
3. **Later:** mDNS discovery, encryption of the learner repository, and
   tailnet discovery if it is wanted.
