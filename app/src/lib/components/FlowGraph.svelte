<script lang="ts">
  // A procedure drawn as a layered flow; choosing a step or a transition
  // calls onselect.
  import { layout, relation, RELATIONS, type Graph, type Transition } from "$lib/flow.ts";

  export type Selection = { node: string } | { edge: Transition } | null;

  let { g, vertical, selected, onselect }: { g: Graph; vertical: boolean; selected: Selection; onselect: (s: Selection) => void } = $props();

  const L = $derived(layout(g, vertical));
  const markerFor = (r: string) => `url(#pa-${r in RELATIONS ? r : "LEADS_TO"})`;
  const isSelectedEdge = (e: Transition) => selected !== null && "edge" in selected && selected.edge === e;
  const isSelectedNode = (id: string) => selected !== null && "node" in selected && selected.node === id;

  // A transition with notes gets a dot at the middle of its curve.
  function midpoint(path: SVGPathElement) {
    const dot = path.parentElement?.querySelector<SVGCircleElement>(".flow-note");
    if (!dot) return;
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    dot.setAttribute("cx", String(p.x));
    dot.setAttribute("cy", String(p.y));
  }
  const onKey = (s: Selection) => (e: KeyboardEvent) => { if (e.key === "Enter") onselect(s); };
</script>

<svg class={["flow", vertical && "vertical"]} viewBox={L.viewBox} width={L.width} role="img" aria-label="Procedure graph">
  <defs>
    {#each Object.entries(RELATIONS) as [rel, { color }] (rel)}
      <marker id="pa-{rel}" viewBox="0 -4 8 8" refX="8" refY="0" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0,-3.5L8,0L0,3.5" fill={color} />
      </marker>
    {/each}
  </defs>
  <g>
    {#each g.edges as e, i (i)}
      {@const rel = relation(e.relation)}
      <g class={["flow-edge", isSelectedEdge(e) && "selected"]} tabindex="0" role="button"
        aria-label="{g.nodes.get(e.from)!.label} {rel.label} {g.nodes.get(e.to)!.label}"
        onclick={() => onselect({ edge: e })} onkeydown={onKey({ edge: e })}>
        <path d={L.paths[i]} class="flow-hit" />
        <path d={L.paths[i]} class="flow-line" stroke={rel.color} stroke-dasharray={e.relation === "TRIGGERS" ? "5 4" : null}
          marker-end={markerFor(e.relation)} {@attach midpoint} />
        {#if e.condition || e.guidance || e.pitfalls}<circle class="flow-note" r="4.5" fill={e.pitfalls ? "var(--stale)" : rel.color} />{/if}
      </g>
    {/each}
  </g>
  {#each [...g.nodes] as [id, n] (id)}
    {@const b = L.boxes.get(id)!}
    <g class={["flow-node", id === g.start && "start", isSelectedNode(id) && "selected"]} tabindex="0" role="button" aria-label={n.label}
      onclick={() => onselect({ node: id })} onkeydown={onKey({ node: id })}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" />
      <text x={b.x + L.pad} y={b.y + L.pad + 12}>
        {#each b.lines as l, i (i)}<tspan x={b.x + L.pad} dy={i ? L.line : 0}>{l}</tspan>{/each}
      </text>
    </g>
  {/each}
</svg>
