This project intends to build a suite of systems/tools for agentic research and development. The project should serve as a template which can be initialised for various
purposes. The following are the main components it can include:

- OKF (Open Knowledge Format) - https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
- A web-based dashboard for ease of communication with the developer/s

The principles of this system are:

- Enhancing the memory of the agent and the developer
- Formalisation of best practices and trodden ground and procedures
- Consistent and rich communication schemes

In the past, I have relied on a small series of markdown files for context, guidelines and guardrails 

## Feature 1: OKF

Open knowledge format is intended to serve as a jointly authored wiki between the LLM and the developer. This can be conceptualised as a project-specific RAG system. Things that might be stored using the format include:

- Details of the project at hand (features, design)
- Decisions made during the development of the project
- Open questions
- Answered questions
- Design planning/task documents
- Background knowledge and research
- Best practices

This should function as an evolving wikipedia-like repository of project-specific knowledge. It can be updated by both the agent and the human through plain markdown. It should include frontmatter to denote author/s and whether the document has been human-verified.

## Feature 2: Dashboard

The dashboard will serve as a substrate for surfacing knowledge about the project (not for editing it). The following headings (###) correspond to different tabs in the dashboard.

### Knowledge Compendium / Network

Two views, a list / compendium with the entries on the right in directory format. Headings are clickable and correspond to the `index.md` files.

Some example directories would be:

- Design (the design of the algorithm / application)
- References (short files containing overview-level information on known references for the project. The references themselves would live separately and their local path would be stored via these markdown files)
- Plans (detailed implementation planning of immediate work on the codebase - yaml frontmatter for the status of the plan (in progress, completed, revoked))
- Procedures (detailed sequences of actions to take, similar to agent skills)
- Experiments
- Research

The format for these files is markdown, which will be rendered richly in the browser including common formatting features such as :

- LaTeX (KaTeX)
- Tables
- Code blocks with highlighting

The yaml frontmatter should be exposed on the right hand side of the body content in a list/table format.

Note that the dashboard should not allow for editing of the knowledge files or anything else. It is only a viewer.

#### Network view:

A force-directed graph view of the OKF should be exposed with clear labelling. The force-directed layout should update live and nodes should be repositionable. Directed edges should correspond to links in the OKF. Undirected edges for connecting directory headings to nested files/other directories. The position of the nodes in the graph should be persistent in the following sense. If the nodes are in a particular position, and you click into one of the notes to view it, and then come back, it should be in the same position (or roughly).

### Latest Changes

The latest changess (git style) should be surfaced commit-by-commit. This should list the name of the commit, and within that, the files that have been edited, but not the specific diffs. This would not be necessary.

This should delineate codebase changes from knowledge base and other changes.

### Reports

Reports are a separate channel for Agent -> Developer communication in a rich web-based format. Extending beyond markdown, these files could also contain:

- Media
- Charts (D3 or similar)
- Other lightweight options afforded by a web-based medium beyond markdown

Reports were a key component of prior setups. A skill should exist to ensure the agent provides a report on outcomes after certain activities.

### Skill / Agent compendium

Skills and agent specifications are a key part of many agentic workflows. This would serve as a way of viewing skills defined for the project (similar to the knowledge list format) and custom agent specifications.

#### Agents:

This is an optional feature that should be discussed for its relevance before implementing. One possible benefit of this approach would be to define agents with different roles such as:

- Developer (writes code, carries out dev work)
- Critic (criticises)
- Searcher (employs search tools such as web search or pdf extraction or similar to find and gather information)
- Librarian (searches the OKF for information)
- Experimenter (carries out experiments and collects results)
- Eye (vision enabled, reviews a provided media artifact and provides critical feedback to the model originating it so that it can be refined)

There may be different models which are more or less appropriate for these tasks. For instance, the developer should be a more capable model, but the critic could be more mid-tier. The Eye need only be some form of vision model. The experimenter could potentially be quite lightweight if the task is clear enough.

Combined with an appropriate harness, a wide range of options could be available for model selection.

If implemented, these agent profiles should be surfaced in the Dashboard somewhere. 

#### Skills

At minimum, searching and editing the OKF should be a skill (/search-okf, /record-okf). Providing a report should also be an invokable skill (/report).

Other skills might be defined during the lifecycle of the project. I am eager for ideas on this front.

These skills should be surfaced in a similar manner to the agents and the knowledge files.

## Feature 3: MCP:

Where relevant, local MCP should be implemented for retrieving from the OKF knowledge base and for any other deterministic processes (such as the potential procedural graphs idea).

This MCP should be simple and lightweight.

## Addendum note (optional harness / model-provider changes)

I am currently using the Claude Code harness with Anthropic's Claude models but I have familiarity with OpenCode. If an alternative harness is more appropriate, then this should be flagged and considered before proceeding.

Alternative models could also be made available which could be relevant to the different agent profiles. I think OpenRouter would be the best way to go here.

## General design / technology choices:

This service will be exposed via a simple http server (python -m http.server --port 8000 or similar) If this is not sufficient, please let me know.

Python MCP libraries will be used if possible.

The web frontend should be lightweight. No heavy frameworks if possible. 

The whole system should be able to operate without connection to the internet (no CDNs).

It should be possible to export a static version of the site to be hosted on a static website hosting service such as Github Pages (but this will not be utilised immediately - consider this a ramification on scope).
