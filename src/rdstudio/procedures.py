"""Procedural graphs (after Lu et al., arXiv:2609.09153) stored in OKF concepts.

A ``type: Procedure`` concept carries, in frontmatter::

    start: <node id>                       # optional; default: first node
    nodes: [{id, label, description?}]
    edges: [{from, to, relation, condition?, guidance?, pitfalls?}]
    proposals: [{id, by, at, rationale, edits: [...], state}]   # pending/applied/rejected

Agents retrieve only the neighbourhood of their current step; edits to a graph
are proposed by agents and applied or rejected by the developer. Rejected
proposals are kept as negative evidence for future proposals.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .okf import Bundle, Concept, now, render_concept, split_frontmatter
from .store import concept_path

RELATIONS = ("LEADS_TO", "TRIGGERS", "PROVIDES_INPUT_FOR", "CONVERGES_TO")
ATTRIBUTES = ("condition", "guidance", "pitfalls")
EDIT_OPS = ("add_node", "update_node", "delete_node", "add_edge", "update_edge", "delete_edge")


class ProcedureError(ValueError):
    pass


def is_procedure(c: Concept) -> bool:
    return c.type.lower() == "procedure"


@dataclass
class Graph:
    nodes: dict[str, dict[str, Any]]
    edges: list[dict[str, Any]]
    start: str | None
    issues: list[str] = field(default_factory=list)

    @classmethod
    def from_meta(cls, meta: dict[str, Any]) -> "Graph":
        issues: list[str] = []
        nodes: dict[str, dict[str, Any]] = {}
        for raw in meta.get("nodes") or []:
            if isinstance(raw, str):
                raw = {"id": raw}
            if not isinstance(raw, dict) or not raw.get("id"):
                issues.append(f"node without id: {raw!r}")
                continue
            nid = str(raw["id"])
            if nid in nodes:
                issues.append(f"duplicate node {nid!r}")
            nodes[nid] = {"label": str(raw.get("label") or nid), **{k: v for k, v in raw.items() if k not in ("id", "label")}}
        edges: list[dict[str, Any]] = []
        for raw in meta.get("edges") or []:
            if not isinstance(raw, dict):
                issues.append(f"edge is not a mapping: {raw!r}")
                continue
            src, dst = str(raw.get("from", "")), str(raw.get("to", ""))
            relation = str(raw.get("relation") or "LEADS_TO")
            for end in (src, dst):
                if end not in nodes:
                    issues.append(f"edge {src!r} -> {dst!r} references unknown node {end!r}")
            if relation not in RELATIONS:
                issues.append(f"edge {src!r} -> {dst!r} has unknown relation {relation!r}")
            edges.append({**raw, "from": src, "to": dst, "relation": relation})
        start = meta.get("start")
        if start is not None and str(start) not in nodes:
            issues.append(f"start node {start!r} does not exist")
        start = str(start) if start is not None else (next(iter(nodes)) if nodes else None)
        return cls(nodes, edges, start, issues)

    def to_meta(self) -> dict[str, Any]:
        return {
            "nodes": [{"id": nid, **attrs} for nid, attrs in self.nodes.items()],
            "edges": self.edges,
        }

    def match(self, step: str | None) -> str | None:
        """Localise the current step: exact id, then case-insensitive label."""
        if not step:
            return self.start
        if step in self.nodes:
            return step
        wanted = step.strip().lower()
        for nid, attrs in self.nodes.items():
            if nid.lower() == wanted or str(attrs.get("label", "")).lower() == wanted:
                return nid
        return None

    def neighbourhood(self, node: str, hops: int = 2) -> "Graph":
        """``node`` and everything reachable within ``hops`` outgoing transitions."""
        seen = {node: 0}
        queue = deque([node])
        while queue:
            current = queue.popleft()
            if seen[current] >= hops:
                continue
            for e in self.edges:
                if e["from"] == current and e["to"] not in seen:
                    seen[e["to"]] = seen[current] + 1
                    queue.append(e["to"])
        nodes = {nid: self.nodes[nid] for nid in seen if nid in self.nodes}
        edges = [e for e in self.edges if e["from"] in seen and e["to"] in seen and seen[e["from"]] < hops]
        return Graph(nodes, edges, node)


def graph_of(c: Concept) -> Graph:
    return Graph.from_meta(c.meta)


def lint(bundle: Bundle) -> list[tuple[str, str]]:
    out = []
    for c in bundle.concepts.values():
        if is_procedure(c):
            out.extend((c.path, msg) for msg in graph_of(c).issues)
    return out


def describe(proc: Concept, graph: Graph, current: str | None) -> dict[str, Any]:
    """Compact, agent-facing description of a (sub)graph."""
    def edge(e: dict[str, Any]) -> dict[str, Any]:
        out = {"from": e["from"], "to": e["to"], "relation": e["relation"]}
        out.update({k: e[k] for k in ATTRIBUTES if e.get(k)})
        return out

    return {
        "procedure": proc.id,
        "title": proc.title,
        "current": current,
        "steps": {nid: attrs.get("label", nid) for nid, attrs in graph.nodes.items()},
        "transitions": [edge(e) for e in graph.edges],
    }


# --------------------------------------------------------------------------- #
# Proposals
# --------------------------------------------------------------------------- #


def _load(root: Path, cid: str) -> tuple[Path, dict[str, Any], str]:
    path = concept_path(root, cid)
    if not path.exists():
        raise ProcedureError(f"no such procedure: {cid}")
    meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
    meta = meta or {}
    if str(meta.get("type", "")).lower() != "procedure":
        raise ProcedureError(f"{cid} is not a Procedure concept")
    return path, meta, body


def _validate_edits(edits: list[dict[str, Any]]) -> None:
    if not edits:
        raise ProcedureError("a proposal needs at least one edit")
    for e in edits:
        op = e.get("op")
        if op not in EDIT_OPS:
            raise ProcedureError(f"unknown edit op {op!r}; use one of {', '.join(EDIT_OPS)}")
        if op.endswith("_node") and not e.get("id"):
            raise ProcedureError(f"{op} needs an 'id'")
        if op.endswith("_edge") and not (e.get("from") and e.get("to")):
            raise ProcedureError(f"{op} needs 'from' and 'to'")


def propose(root: Path, cid: str, *, edits: list[dict[str, Any]], rationale: str, actor: str) -> dict[str, Any]:
    _validate_edits(edits)
    path, meta, body = _load(root, cid)
    proposals = list(meta.get("proposals") or [])
    pid = max((int(p.get("id", 0)) for p in proposals), default=0) + 1
    proposal = {"id": pid, "by": actor, "at": now(), "state": "pending", "rationale": rationale, "edits": edits}
    # Dry-run so structurally invalid proposals are refused up front.
    trial = apply_edits(Graph.from_meta(meta), edits)
    if trial.issues:
        raise ProcedureError("proposal would leave the graph invalid: " + "; ".join(trial.issues))
    proposals.append(proposal)
    meta["proposals"] = proposals
    path.write_text(render_concept(meta, body), encoding="utf-8")
    return {"procedure": cid, "proposal": pid, "state": "pending"}


def apply_edits(graph: Graph, edits: list[dict[str, Any]]) -> Graph:
    nodes = {k: dict(v) for k, v in graph.nodes.items()}
    edges = [dict(e) for e in graph.edges]
    for e in edits:
        op = e["op"]
        attrs = {k: v for k, v in e.items() if k not in ("op",)}
        if op == "add_node":
            nodes[str(e["id"])] = {"label": str(e.get("label") or e["id"]), **{k: v for k, v in attrs.items() if k not in ("id", "label")}}
        elif op == "update_node":
            nodes.setdefault(str(e["id"]), {}).update({k: v for k, v in attrs.items() if k != "id"})
        elif op == "delete_node":
            nodes.pop(str(e["id"]), None)
            edges = [x for x in edges if str(e["id"]) not in (x["from"], x["to"])]
        elif op == "add_edge":
            edges.append({"from": e["from"], "to": e["to"], "relation": e.get("relation", "LEADS_TO"),
                          **{k: e[k] for k in ATTRIBUTES if e.get(k)}})
        elif op == "update_edge":
            for x in edges:
                if (x["from"], x["to"]) == (e["from"], e["to"]) and (not e.get("relation") or x["relation"] == e["relation"]):
                    x.update({k: e[k] for k in (*ATTRIBUTES, "relation") if k in e})
        elif op == "delete_edge":
            edges = [x for x in edges if not ((x["from"], x["to"]) == (e["from"], e["to"])
                                              and (not e.get("relation") or x["relation"] == e["relation"]))]
    meta = {"nodes": [{"id": k, **v} for k, v in nodes.items()], "edges": edges}
    if graph.start in nodes:
        meta["start"] = graph.start
    return Graph.from_meta(meta)


def resolve(root: Path, cid: str, pid: int, *, accept: bool, actor: str) -> dict[str, Any]:
    path, meta, body = _load(root, cid)
    proposals = list(meta.get("proposals") or [])
    match = next((p for p in proposals if int(p.get("id", 0)) == pid), None)
    if match is None:
        raise ProcedureError(f"no proposal {pid} on {cid}")
    if match.get("state") != "pending":
        raise ProcedureError(f"proposal {pid} is already {match.get('state')}")
    if accept:
        graph = apply_edits(Graph.from_meta(meta), match["edits"])
        if graph.issues:
            raise ProcedureError("cannot apply: " + "; ".join(graph.issues))
        meta.update(graph.to_meta())
        meta["generated"] = {"by": actor, "at": now()}
    match["state"] = "applied" if accept else "rejected"
    match["resolved"] = {"by": actor, "at": now()}
    meta["proposals"] = proposals
    path.write_text(render_concept(meta, body), encoding="utf-8")
    return {"procedure": cid, "proposal": pid, "state": match["state"]}
