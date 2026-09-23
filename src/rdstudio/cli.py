"""Command-line interface: ``rdstudio <command>``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from . import config as config_mod
from .okf import Bundle


def _bundle(cfg: config_mod.Config) -> Bundle:
    return Bundle.load(cfg.knowledge_dir)


def cmd_check(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    bundle = _bundle(cfg)
    issues = bundle.lint()
    errors = [i for i in issues if i.level == "error"]
    for issue in issues:
        if issue.level == "error" or args.warnings:
            print(f"{issue.level:7} {issue.path}: {issue.message}")
    warnings = len(issues) - len(errors)
    print(f"{len(bundle.concepts)} concepts, {len(errors)} errors, {warnings} warnings")
    return 1 if errors else 0


def cmd_index(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    bundle = _bundle(cfg)
    changed = bundle.write_indexes()
    for path in changed:
        print(f"wrote {path}")
    if not changed:
        print("indexes up to date")
    return 0


def cmd_search(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .search import Index

    hits = Index(_bundle(cfg)).search(
        " ".join(args.query), limit=args.limit, type=args.type, tags=args.tag, under=args.under
    )
    if args.json:
        print(json.dumps([h.as_dict() for h in hits], indent=2))
        return 0
    for h in hits:
        print(f"{h.score:6.2f}  {h.concept.id}  [{h.concept.type}]  {h.concept.title}")
        if h.snippet:
            print(f"        {h.snippet}")
    return 0


def cmd_verify(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .store import verify

    actor = args.by or cfg.human
    if not actor.startswith("human:"):
        print("set [actors] human = \"human:<id>\" in rdstudio.toml or ~/.config/rdstudio/config.toml, "
              "or pass --by human:<id>", file=sys.stderr)
        return 2
    for ref in args.concepts:
        result = verify(cfg.knowledge_dir, ref, actor=actor)
        print(f"verified {result.path} by {actor}")
    return 0


def cmd_build(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .build import build

    out = build(cfg)
    print(f"built {out}")
    return 0


def cmd_export(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    import shutil
    import tempfile

    from .build import build

    target = Path(args.target).resolve()
    if target.exists() and any(target.iterdir()) and not args.force:
        print(f"{target} is not empty; pass --force to replace it", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        site = build(cfg, write_indexes=False, export=True, site=Path(tmp) / "site")
        (site / ".nojekyll").write_text("")
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(site, target)
    print(f"exported a static snapshot to {target} (project knowledge only)")
    return 0


def cmd_serve(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .serve import serve

    serve(cfg, host=args.host, port=args.port, watch=not args.no_watch)
    return 0


def cmd_init(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .scaffold import init

    target = Path(args.path).resolve()
    for line in init(target, title=args.title, human=args.human, force=args.force):
        print(line)
    return 0


def cmd_procedure(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from . import procedures

    bundle = _bundle(cfg)
    if args.action == "list":
        for c in bundle.concepts.values():
            if procedures.is_procedure(c):
                pending = sum(p.get("state") == "pending" for p in c.meta.get("proposals") or [])
                g = procedures.graph_of(c)
                print(f"{c.id}  {len(g.nodes)} steps, {len(g.edges)} transitions"
                      + (f", {pending} pending proposal(s)" if pending else ""))
        return 0
    cid = bundle.resolve_id(args.procedure or "") or bundle.resolve_id("procedures/" + (args.procedure or ""))
    if cid is None:
        print(f"no procedure {args.procedure!r}", file=sys.stderr)
        return 2
    if args.action == "show":
        c = bundle.concepts[cid]
        for p in c.meta.get("proposals") or []:
            print(f"#{p.get('id')} [{p.get('state')}] by {p.get('by')}: {p.get('rationale')}")
            for e in p.get("edits", []):
                print("    " + ", ".join(f"{k}={v}" for k, v in e.items()))
        return 0
    actor = cfg.human or "human:unknown"
    try:
        result = procedures.resolve(cfg.knowledge_dir, cid, args.proposal, accept=args.action == "apply", actor=actor)
    except procedures.ProcedureError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(f"proposal {result['proposal']} on {cid}: {result['state']}")
    return 0


def cmd_refs(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from . import references

    if not references.enabled(cfg):
        print('references are off: add [references] backend = "papis" to rdstudio.toml', file=sys.stderr)
        return 2
    try:
        if args.action == "sync":
            created = references.sync_stubs(cfg)
            for cid in created:
                print(f"created {cid}")
            print(f"{len(created)} new reference stubs")
        elif args.action == "search":
            for hit in references.search(cfg, " ".join(args.terms)):
                print(f"{hit['ref']:32} {hit['year']:5} {hit['title']}")
        elif args.action == "text":
            print(references.text(cfg, args.terms[0], pages=args.pages))
    except references.ReferenceError as exc:
        print(exc, file=sys.stderr)
        return 1
    return 0


def cmd_global(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from . import scopes

    if args.action == "init":
        for line in scopes.init_global(Path(args.path), human=args.human):
            print(line)
        return 0
    g = scopes.global_config(cfg)
    if g is None:
        print("no global knowledge base; run `rdstudio global init [~/knowledge]`")
        return 1
    print(f"global knowledge base: {g.root} ({len(_bundle(g).concepts)} concepts)")
    return 0


def cmd_promote(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from . import scopes

    try:
        result = scopes.promote(cfg, args.concept, as_id=args.as_id, keep=args.keep, force=args.force)
    except scopes.ScopeError as exc:
        print(exc, file=sys.stderr)
        return 1
    verb = "moved" if result["moved"] else "copied"
    print(f"{verb} {result['from']} to the global knowledge base as {result['to']}")
    if result["broken_links_in_global"]:
        print("links that do not resolve in the global base: " + ", ".join(result["broken_links_in_global"]))
    return 0


def cmd_skills(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from . import scopes

    if args.action == "list":
        for scope, skills in scopes.skill_dirs(cfg).items():
            print(f"{scope}: {', '.join(skills) or '(none)'}")
        return 0
    try:
        print(scopes.move_skill(cfg, args.name, args.action.split("-")[-1]))
    except scopes.ScopeError as exc:
        print(exc, file=sys.stderr)
        return 1
    return 0


def cmd_brief(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .brief import brief

    print(brief(cfg))
    return 0


def cmd_mcp(args: argparse.Namespace, cfg: config_mod.Config) -> int:
    from .mcp_server import run

    run(cfg)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="rdstudio", description=__doc__)
    p.add_argument("--version", action="version", version=f"rdstudio {__version__}")
    p.add_argument("-C", "--directory", help="run as if started in this directory")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init", help="scaffold rdstudio into a repository")
    s.add_argument("path", nargs="?", default=".")
    s.add_argument("--title", help="project title")
    s.add_argument("--human", help="your actor id, e.g. human:lachlan")
    s.add_argument("--force", action="store_true", help="overwrite rdstudio-managed files")
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("check", help="check OKF conformance of the knowledge bundle")
    s.add_argument("-w", "--warnings", action="store_true", help="also print warnings")
    s.set_defaults(func=cmd_check)

    s = sub.add_parser("index", help="regenerate index.md files")
    s.set_defaults(func=cmd_index)

    s = sub.add_parser("search", help="search the knowledge bundle")
    s.add_argument("query", nargs="+")
    s.add_argument("-n", "--limit", type=int, default=8)
    s.add_argument("--type")
    s.add_argument("--tag", action="append")
    s.add_argument("--under", help="restrict to a directory")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_search)

    s = sub.add_parser("verify", help="record a human verification of concepts")
    s.add_argument("concepts", nargs="+", help="concept ids or paths")
    s.add_argument("--by", help="actor, default from config")
    s.set_defaults(func=cmd_verify)

    s = sub.add_parser("build", help="build the dashboard site")
    s.set_defaults(func=cmd_build)

    s = sub.add_parser("export", help="write a static snapshot of the dashboard (e.g. for GitHub Pages)")
    s.add_argument("target")
    s.add_argument("--force", action="store_true", help="replace a non-empty target directory")
    s.set_defaults(func=cmd_export)

    s = sub.add_parser("serve", help="serve the dashboard, rebuilding on change")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    s.add_argument("--no-watch", action="store_true")
    s.set_defaults(func=cmd_serve)

    s = sub.add_parser("procedure", help="list procedures; show, apply or reject proposed edits")
    s.add_argument("action", choices=["list", "show", "apply", "reject"])
    s.add_argument("procedure", nargs="?")
    s.add_argument("proposal", nargs="?", type=int)
    s.set_defaults(func=cmd_procedure)

    s = sub.add_parser("refs", help="papis references: sync stubs, search, read PDF text")
    s.add_argument("action", choices=["sync", "search", "text"])
    s.add_argument("terms", nargs="*")
    s.add_argument("--pages")
    s.set_defaults(func=cmd_refs)

    s = sub.add_parser("global", help="set up or show the global knowledge base")
    s.add_argument("action", choices=["init", "status"])
    s.add_argument("path", nargs="?", default="~/knowledge")
    s.add_argument("--human", help="your actor id, e.g. human:lachlan")
    s.set_defaults(func=cmd_global)

    s = sub.add_parser("promote", help="move a project concept into the global knowledge base")
    s.add_argument("concept")
    s.add_argument("--as", dest="as_id", help="id in the global base (default: same path)")
    s.add_argument("--keep", action="store_true", help="copy instead of move")
    s.add_argument("--force", action="store_true", help="move even if project concepts link to it")
    s.set_defaults(func=cmd_promote)

    s = sub.add_parser("skills", help="list skills by scope, or move one between project and user scope")
    s.add_argument("action", choices=["list", "to-user", "to-project"])
    s.add_argument("name", nargs="?")
    s.set_defaults(func=cmd_skills)

    s = sub.add_parser("brief", help="print a short orientation for an agent session")
    s.set_defaults(func=cmd_brief)

    s = sub.add_parser("mcp", help="run the MCP server on stdio")
    s.set_defaults(func=cmd_mcp)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    start = Path(args.directory).resolve() if args.directory else None
    cfg = config_mod.load(start)
    return args.func(args, cfg) or 0


if __name__ == "__main__":
    sys.exit(main())
