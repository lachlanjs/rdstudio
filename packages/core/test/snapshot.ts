// The conformance snapshot (the shape of fixtures/expected/*.json, built by
// snapshot() in fixtures/expected.py), from the TypeScript core.

import { contentHash, headings, iso, type Bundle } from "../src/index.ts";
import { cmpTuple } from "../src/text.ts";

// Like jsonable() in the Python core: frontmatter values as JSON.
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

export function snapshot(b: Bundle): Record<string, unknown> {
  const order = b.prerequisiteOrder();
  const concepts: Record<string, unknown> = {};
  for (const [cid, c] of b.concepts) {
    const human = c.lastHumanVerification;
    concepts[cid] = {
      path: c.path,
      directory: c.directory,
      title: c.title,
      type: c.type,
      description: c.description,
      tags: c.tags,
      status: c.status,
      meta: json(c.meta),
      trust: c.trust,
      generated_at: c.generatedAt === null ? null : iso(c.generatedAt),
      last_human_verification: human === null ? null : iso(human),
      verification_stale: c.verificationStale,
      content_stale: c.contentStale(),
      hash: contentHash(c.body),
      headings: headings(c.body).map((h) => [h.level, h.text, h.slug, h.line]),
      links: c.links.map((l) => [l.target, l.kind, l.broken, l.rel]),
      backlinks: b.backlinks(cid),
      requires: b.requiresGraph().get(cid),
      prerequisites: b.prerequisites(cid),
      order: order.get(cid)!.order,
      depth: order.get(cid)!.depth,
    };
  }
  const directories: Record<string, unknown> = {};
  for (const [did, d] of b.directories) {
    directories[did] = { concepts: [...d.concepts].sort(), children: [...d.children].sort(), has_index: d.hasIndex, has_log: d.hasLog };
  }
  return {
    format: 1,
    root_meta: json(b.rootMeta),
    concepts,
    directories,
    issues: b.lint().map((i) => [i.path, i.level, i.code]).sort(cmpTuple),
    requires_cycles: b.requiresCycles(),
    indexes: Object.fromEntries([...b.directories.keys()].map((d) => [d, b.renderIndex(d)])),
  };
}

