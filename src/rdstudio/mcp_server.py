"""Local stdio MCP server over the project knowledge bundle.

Every tool returns compact text so an agent spends as little context as
possible: search returns ids and one-line snippets, outline returns headings,
and read can return a single section.
"""

from __future__ import annotations

import json
from typing import Any

from mcp.server.mcpserver import MCPServer

from . import __version__
from .config import Config
from .okf import Bundle, dump_frontmatter, headings, jsonable, section
from .search import Index
from .store import StoreError, record as store_record

INSTRUCTIONS = """\
Project knowledge base (OKF markdown bundle). Retrieve progressively:
search -> outline -> read(section). Prefer reading one section over a whole
concept. Before recording, search for an existing concept to update rather
than creating a duplicate. Record decisions, answered questions, findings and
procedures as they happen. Mark an edit significant=false only for trivial or
dictated changes; significant edits flag human-reviewed concepts for re-review.
Never claim human verification; only humans verify (rdstudio verify)."""


def _fmt(obj: Any) -> str:
    return json.dumps(jsonable(obj), ensure_ascii=False, indent=1)


def create_server(cfg: Config) -> MCPServer:
    server = MCPServer("rdstudio", instructions=INSTRUCTIONS, version=__version__)

    def bundle() -> Bundle:
        return Bundle.load(cfg.knowledge_dir)

    @server.tool()
    def search(query: str, type: str | None = None, tags: list[str] | None = None,
               under: str | None = None, limit: int = 8) -> str:
        """Keyword (BM25) search over the knowledge base. Returns concept ids, titles,
        descriptions and a one-line snippet. Filter by concept type (e.g. "Decision"),
        tags (all must match) or a directory prefix (e.g. "design")."""
        b = bundle()
        hits = Index(b).search(query, limit=max(1, min(limit, 25)), type=type, tags=tags, under=under)
        if not hits:
            return "No matches. Try other words, drop filters, or list a directory."
        return _fmt([h.as_dict() for h in hits])

    @server.tool()
    def outline(id: str) -> str:
        """Metadata and heading outline of one concept, without its body. Use it to
        decide which section to read."""
        b = bundle()
        cid = b.resolve_id(id)
        if cid is None:
            return f"No concept {id!r}."
        c = b.concepts[cid]
        return _fmt({
            "id": c.id, "title": c.title, "type": c.type, "description": c.description,
            "tags": c.tags, "status": c.status, "trust": c.trust,
            "verification_stale": c.verification_stale,
            "generated": c.meta.get("generated"),
            "chars": len(c.body),
            "headings": ["#" * h.level + " " + h.text for h in headings(c.body)],
            "links_to": sorted({l.target for l in c.links if not l.broken}),
            "linked_from": b.backlinks(cid),
        })

    @server.tool()
    def read(id: str, section_heading: str | None = None, frontmatter: bool = False) -> str:
        """Read a concept's body, or only the section under one heading (matched by
        text, case-insensitive). Set frontmatter=true to include the YAML metadata."""
        b = bundle()
        cid = b.resolve_id(id)
        if cid is None:
            return f"No concept {id!r}."
        c = b.concepts[cid]
        text = c.body
        if section_heading:
            text = section(c.body, section_heading)
            if text is None:
                options = ", ".join(h.text for h in headings(c.body)) or "none"
                return f"No section {section_heading!r} in {cid}. Headings: {options}."
        if frontmatter:
            return f"---\n{dump_frontmatter(c.meta)}---\n\n{text}"
        return f"# {c.title} ({cid})\n\n{text}" if not section_heading else text

    @server.tool()
    def list_concepts(directory: str = "") -> str:
        """List a directory of the knowledge base: its concepts (id, type, title,
        description) and subdirectories. Use "" for the root."""
        b = bundle()
        d = b.directories.get(directory.strip("/"))
        if d is None:
            return f"No directory {directory!r}. Top level: {sorted(b.directories[''].children)}"
        return _fmt({
            "directory": d.id,
            "subdirectories": sorted(d.children),
            "concepts": [
                {"id": cid, "type": b.concepts[cid].type, "title": b.concepts[cid].title,
                 "description": b.concepts[cid].description}
                for cid in sorted(d.concepts)
            ],
        })

    @server.tool()
    def record(id: str, type: str | None = None, title: str | None = None,
               description: str | None = None, tags: list[str] | None = None,
               body: str | None = None, section_heading: str | None = None,
               append: str | None = None, significant: bool = True,
               meta: dict[str, Any] | None = None, actor: str | None = None) -> str:
        """Create or update a concept at `id` (path without .md, e.g.
        "decisions/activation-function"). New concepts need `type`, and should have a
        title and one-sentence description. `body` replaces the whole body, or only the
        section under `section_heading`; `append` adds to the end. Existing frontmatter
        is preserved; `meta` sets extra keys (null deletes). Links between concepts use
        bundle-absolute paths like [text](/design/model.md). significant=false for
        trivial or dictated edits (keeps provenance and review state)."""
        updates: dict[str, Any] = dict(meta or {})
        for key, value in (("type", type), ("title", title), ("description", description), ("tags", tags)):
            if value is not None:
                updates[key] = value
        try:
            result = store_record(
                cfg.knowledge_dir, id, actor=actor or cfg.agent, body=body, meta=updates,
                section=section_heading, append=append, significant=significant,
            )
        except StoreError as exc:
            return f"Not recorded: {exc}"
        b = bundle()
        b.write_indexes()
        issues = [f"{i.level}: {i.message}" for i in b.lint() if i.path == result.path]
        out = result.as_dict()
        if issues:
            out["issues"] = issues
        return _fmt(out)

    @server.tool()
    def backlinks(id: str) -> str:
        """Concepts that link to the given concept."""
        b = bundle()
        cid = b.resolve_id(id)
        if cid is None:
            return f"No concept {id!r}."
        return _fmt([{"id": x, "title": b.concepts[x].title} for x in b.backlinks(cid)])

    @server.tool()
    def review_queue(limit: int = 10) -> str:
        """What needs human attention: concepts changed since human review, open
        questions, unverified concepts, and format errors."""
        b = bundle()
        cs = list(b.concepts.values())
        brief = lambda c: {"id": c.id, "title": c.title, "type": c.type}  # noqa: E731
        questions = [c for c in cs if c.type.lower() == "question" and "answered" not in c.tags]
        return _fmt({
            "changed_since_review": [brief(c) for c in cs if c.verification_stale][:limit],
            "open_questions": [brief(c) for c in questions][:limit],
            "unverified_count": sum(c.trust == "unverified" for c in cs),
            "errors": [f"{i.path}: {i.message}" for i in b.lint() if i.level == "error"][:limit],
        })

    return server


def run(cfg: Config) -> None:
    create_server(cfg).run()
