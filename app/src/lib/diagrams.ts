// Mermaid diagrams, loaded only when a page contains one (mermaid is large and
// is split into its own chunks) and coloured from the active theme's tokens.
// A port of the old dashboard's js/diagrams.js.

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
}

export function mermaidConfig() {
  const paper = css("--paper"), raised = css("--paper-raised"), sunk = css("--paper-sunk");
  const ink = css("--ink"), soft = css("--ink-soft"), faint = css("--ink-faint"), rule = css("--rule");
  const accent = css("--accent"), accentSoft = css("--accent-soft");
  const font = css("--font-ui") || "system-ui, sans-serif";
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    suppressErrorRendering: true, // we show our own message with the source
    theme: "base" as const,
    fontFamily: font,
    themeVariables: {
      darkMode: isDark(paper), background: paper, fontFamily: font, fontSize: "14px",
      primaryColor: raised, primaryTextColor: ink, primaryBorderColor: faint,
      secondaryColor: accentSoft, secondaryTextColor: ink, secondaryBorderColor: accent,
      tertiaryColor: sunk, tertiaryTextColor: ink, tertiaryBorderColor: rule,
      lineColor: soft, textColor: ink, mainBkg: raised, nodeBorder: faint, clusterBkg: sunk, clusterBorder: rule,
      edgeLabelBackground: paper, noteBkgColor: accentSoft, noteTextColor: ink, noteBorderColor: accent,
      actorBkg: raised, actorBorder: faint, actorTextColor: ink, signalColor: soft, signalTextColor: ink,
      // xychart: bars muted, the first line in the accent, so both read.
      // Every colour is given: one left out is worked out from Mermaid's own
      // light defaults, not from these, so it is dark on a dark page.
      xyChart: {
        backgroundColor: paper, titleColor: ink, legendTextColor: ink, dataLabelColor: ink,
        xAxisLabelColor: soft, xAxisTitleColor: soft, xAxisTickColor: faint, xAxisLineColor: faint,
        yAxisLabelColor: soft, yAxisTitleColor: soft, yAxisTickColor: faint, yAxisLineColor: faint,
        plotColorPalette: [faint, accent, soft, ink].join(", "),
      },
    },
  };
}

/** Widen a drawing's frame to what it holds. Mermaid sizes some diagrams (a
 *  chart's legend) by measuring text in a scratch element without the
 *  theme's font, so wider type runs past the edge and is cut off. */
function fit(svg: SVGSVGElement | null): void {
  if (!svg || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return;
  let box: DOMRect;
  try { box = svg.getBBox(); } catch { return; } // not laid out
  const vb = svg.viewBox.baseVal, pad = 4;
  const x0 = Math.min(vb.x, box.x - pad), y0 = Math.min(vb.y, box.y - pad);
  const x1 = Math.max(vb.x + vb.width, box.x + box.width + pad), y1 = Math.max(vb.y + vb.height, box.y + box.height + pad);
  if (x0 === vb.x && y0 === vb.y && x1 === vb.x + vb.width && y1 === vb.y + vb.height) return;
  const scale = (x1 - x0) / vb.width;
  svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  // Mermaid caps the width at the frame's; keep the type the same size.
  const max = parseFloat(svg.style.maxWidth);
  if (max) svg.style.maxWidth = `${Math.round(max * scale)}px`;
}

let counter = 0;
let queue: Promise<void> = Promise.resolve();

/** Draw every unrendered .mermaid-block under root. Mermaid's render is not
 *  re-entrant, so calls run one after another; blocks detached meanwhile (a
 *  live refresh replaced the page) are skipped. */
export function renderDiagrams(root: HTMLElement): Promise<void> {
  queue = queue.then(() => renderNow(root)).catch(() => {});
  return queue;
}

async function renderNow(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>(".mermaid-block:not([data-rendered])")];
  if (!blocks.length) return;
  let mermaid: typeof import("mermaid").default;
  try {
    mermaid = (await import("mermaid")).default;
  } catch {
    for (const el of blocks) el.dataset.rendered = "failed";
    return;
  }
  mermaid.initialize(mermaidConfig());
  // Mermaid sizes text by measuring it: measure in the theme's fonts, not their stand-ins.
  try { await document.fonts?.ready; } catch { /* no font loading API */ }
  for (const el of blocks) {
    if (!el.isConnected) continue;
    const source = el.querySelector(".mermaid-source code")?.textContent ?? "";
    el.dataset.rendered = "pending";
    const id = `rdstudio-mermaid-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, source);
      el.innerHTML = svg;
      fit(el.querySelector("svg"));
      // A face that arrives later can widen the text again.
      void document.fonts?.ready.then(() => fit(el.querySelector("svg")));
      el.dataset.rendered = "done";
    } catch (err) {
      // Mermaid can leave its scratch container behind when parsing fails.
      document.getElementById(id)?.remove();
      document.getElementById("d" + id)?.remove();
      el.dataset.rendered = "failed";
      el.classList.add("error");
      const message = String((err as Error)?.message ?? err).split("\n")[0]!;
      el.innerHTML = `<p class="mermaid-error">This diagram could not be drawn: ${escapeHtml(message)}</p><pre><code>${escapeHtml(source)}</code></pre>`;
    }
  }
}
