<script lang="ts">
  // The teacher's margin (T55, sketch MarginaliaWorkbench). Each pin is a
  // card, level with the words it is about in the answer, joined to them by a
  // leader line in its pen's own line style: red solid, green double, blue
  // dotted, a hint a thin neutral line. Cards are ordered by where their words
  // sit, so leader lines never cross; replies pinned to nothing come first.
  import { tick } from "svelte";
  import { render } from "$lib/markdown.ts";
  import { money } from "$lib/teacher.svelte.ts";
  import { HINT_RUNGS, MODE_LABEL, streamingText, type Colour, type Turn } from "$lib/tutor.ts";
  import type { TutorSession } from "$lib/tutorSession.svelte.ts";
  import Prose from "./Prose.svelte";

  let { session, dir, root, text, confidence = null, onreveal, onshow, onrestore }: {
    session: TutorSession; dir: string; root: HTMLElement | undefined; text: string; confidence?: string | null;
    onreveal: (pin: string) => boolean; onshow: (version: string) => void; onrestore: (version: string) => void;
  } = $props();

  interface Card { key: string; turn: Turn; pin: string | null; colour: Colour; head: string; quote: string | null; body: string; asked: string | null }

  const cards = $derived.by((): Card[] => {
    const out: Card[] = [];
    for (const t of session.turns) {
      const head = t.mode === "hint" ? `Hint ${t.rung ?? 1} of ${HINT_RUNGS}` : MODE_LABEL[t.mode];
      const asked = t.mode === "discuss" ? [t.selection ? `About “${t.selection}”` : "", t.prompt ?? ""].filter(Boolean).join(": ") : null;
      if (!t.pins.length) { out.push({ key: t.id, turn: t, pin: null, colour: t.mode === "discuss" ? "blue" : "hint", head, quote: null, body: t.general, asked }); continue; }
      t.pins.forEach((p, i) => {
        // The reply's general words go with its first card; a hint is one card.
        const body = [i === 0 ? t.general : "", p.comment].filter((x) => x.trim()).join("\n\n");
        out.push({ key: `${t.id}.${i}`, turn: t, pin: `${t.id}.${i}`, colour: p.colour, head, quote: p.quote, body, asked: i === 0 ? asked : null });
      });
    }
    return out;
  });

  // ---------------------------------------------------------------- placing
  let column = $state<HTMLElement>();
  let tops = $state<Record<string, number>>({});
  let order = $state<string[]>([]);
  let height = $state(0);
  let leaders = $state<{ d: string; colour: Colour; x: number; y: number }[]>([]);

  function anchorOf(pin: string | null): DOMRect | null {
    if (!pin || !root) return null;
    const marks = root.querySelectorAll<HTMLElement>(`.answer-editor [data-pin="${CSS.escape(pin)}"]`);
    if (!marks.length) return null;
    const rects = marks[marks.length - 1]!.getClientRects();
    return rects.length ? rects[rects.length - 1]! : null;
  }

  function rounded(pts: [number, number][], r: number): string {
    let d = `M${pts[0]![0]} ${pts[0]![1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1]!, b = pts[i]!, c = pts[i + 1]!;
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), rr = Math.min(r, l1 / 2, l2 / 2);
      if (rr < 0.5) { d += ` L${b[0]} ${b[1]}`; continue; }
      const p1 = [b[0] - ((b[0] - a[0]) / l1) * rr, b[1] - ((b[1] - a[1]) / l1) * rr], p2 = [b[0] + ((c[0] - b[0]) / l2) * rr, b[1] + ((c[1] - b[1]) / l2) * rr];
      d += ` L${p1[0]} ${p1[1]} Q${b[0]} ${b[1]} ${p2[0]} ${p2[1]}`;
    }
    const z = pts[pts.length - 1]!;
    return d + ` L${z[0]} ${z[1]}`;
  }

  async function place() {
    if (!root || !column) return;
    const rb = root.getBoundingClientRect(), cb = column.getBoundingClientRect();
    const wide = cb.left > rb.left + rb.width * 0.5; // the margin sits beside the answer, not under it
    const withAnchor = cards.map((c) => ({ c, a: wide ? anchorOf(c.pin) : null }));
    const loose = withAnchor.filter((x) => !x.a), pinned = withAnchor.filter((x) => x.a).sort((x, y) => x.a!.bottom - y.a!.bottom || x.a!.right - y.a!.right);
    order = [...loose, ...pinned].map((x) => x.c.key);
    await tick();
    let cursor = 0;
    const nextTops: Record<string, number> = {};
    const lines: { d: string; colour: Colour; x: number; y: number }[] = [];
    let lane = 0;
    for (const { c, a } of [...loose, ...pinned]) {
      const el = column.querySelector<HTMLElement>(`[data-card="${CSS.escape(c.key)}"]`);
      if (!el) continue;
      const want = a ? a.bottom + 5 - cb.top - 16 : 0;
      const top = Math.max(cursor, want);
      nextTops[c.key] = top;
      cursor = top + el.offsetHeight + 10;
      if (a) {
        const x0 = a.right - rb.left - 4, y0 = a.bottom - rb.top, yl = y0 + 5;
        const xc = cb.left - rb.left, yc = cb.top - rb.top + top + 16;
        const xv = xc - 14 - (lane++ % 6) * 8;
        lines.push({ d: rounded([[x0, y0], [x0, yl], [xv, yl], [xv, yc], [xc, yc]], 5), colour: c.colour, x: xc, y: yc });
      }
    }
    tops = nextTops; height = cursor; leaders = lines;
  }

  // Again whenever the replies, the answer or the page's size change.
  $effect(() => {
    void cards; void text; void session.asking;
    const go = () => requestAnimationFrame(() => void place());
    const t = setTimeout(go, 30);
    void document.fonts?.ready.then(go);
    addEventListener("resize", go);
    return () => { clearTimeout(t); removeEventListener("resize", go); };
  });
  const byKey = $derived(new Map(cards.map((c) => [c.key, c])));
  const shown = $derived(order.length === cards.length ? order.map((k) => byKey.get(k)).filter((c) => !!c) : cards);
  const html = (md: string) => render(md, { dir });
</script>

{#if leaders.length}
  <svg class="leaders" aria-hidden="true">
    {#each leaders as l, i (i)}
      {#if l.colour === "green"}<path class="ld-green" d={l.d} /><path class="ld-green-gap" d={l.d} />{:else}<path class={"ld-" + l.colour} d={l.d} />{/if}
      <circle class={"dot-" + l.colour} cx={l.x} cy={l.y} r="3.5" />
    {/each}
  </svg>
{/if}
<section class="margin-col" aria-label="The teacher">
  <div class="m-head"><b>The teacher</b>{#if confidence}<span>you said you were {confidence}</span>{/if}</div>
  {#if session.asking}
    <aside class={["pin", "pin-" + (session.asking === "discuss" ? "blue" : "hint"), "streaming"]} aria-live="polite" aria-busy="true">
      <div class="pin-head"><b>{MODE_LABEL[session.asking]}</b> thinking…</div>
      {#if session.streaming}<p class="pin-streaming">{streamingText(session.streaming)}</p>{/if}
    </aside>
  {/if}
  {#if !cards.length && !session.asking}
    <p class="caption m-empty">Ask for a hint, feedback or a discussion, and the teacher answers here, pinned to the words it is about.</p>
  {/if}
  <div class="m-cards" bind:this={column} style:height={cards.length ? `${height}px` : null}>
    {#each shown as c (c.key)}
      <aside class={["pin", "pin-" + c.colour]} data-card={c.key} style:top="{tops[c.key] ?? 0}px">
        <div class="pin-head"><b>{c.head}</b></div>
        {#if c.quote}<button class="pin-quote" type="button" title="Show it in your answer" onclick={() => { if (c.pin && !onreveal(c.pin)) onshow(c.turn.version); }}><span>{c.quote}</span></button>{/if}
        {#if c.asked}<p class="who">You asked</p><p class="asked">{c.asked}</p>{#if c.body}<p class="who">The teacher</p>{/if}{/if}
        {#if c.body}<Prose html={html(c.body)} />{/if}
        <p class="pin-foot caption">
          <button class="link" type="button" onclick={() => onshow(c.turn.version)} title="Your answer as it was when you asked">{c.turn.version}</button>
          <button class="link" type="button" onclick={() => onrestore(c.turn.version)}>restore</button>
          <span>{money(c.turn.cost)}</span>
        </p>
      </aside>
    {/each}
  </div>
  {#if session.seen && session.turns.length}
    <details class="turn-seen m-seen"><summary>What the teacher saw, last time</summary>
      <ul>{#each session.seen.seen as s (s.name)}<li><details><summary>{s.name} · about {s.tokens} tokens{s.shortened ? " (shortened)" : ""}</summary><pre>{s.text}</pre></details></li>{/each}</ul>
    </details>
  {/if}
</section>
