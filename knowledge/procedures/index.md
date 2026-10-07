# Procedure

* [Publish rdstudio to npm](publish-npm.md) - Put a version of rdstudio on the npm registry by hand, so anyone can run it with npx rdstudio or npm install -g rdstudio. Releases normally go through the release workflow instead.
* [Publish the dashboard as a static site](publish-static-site.md) - Export a project's dashboard and publish it with GitHub Pages (or any static host) from CI.
* [Release rdstudio](release.md) - Publish a new version to npm and PyPI, with a GitHub Release, by pushing a version tag; the release workflow does the rest.
* [Use an organisation's own model gateway](enterprise-models.md) - Point rdstudio at an enterprise-hosted, OpenAI-compatible gateway in place of OpenRouter: the settings, certificates, proxies and keys, how to diagnose a failure, what is not covered, and where in the code to patch a gap.
