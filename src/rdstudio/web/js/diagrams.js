// Mermaid diagrams, rendered offline from the vendored ESM build, loaded only
// when a page contains one and coloured from the active theme's tokens.

import { esc } from "./util.js";

let loading = null;

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isDark(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 128;
}

export function mermaidConfig() {
  const paper = css("--paper"), raised = css("--paper-raised"), sunk = css("--paper-sunk");
  const ink = css("--ink"), soft = css("--ink-soft"), faint = css("--ink-faint"), rule = css("--rule");
  const accent = css("--accent"), accentSoft = css("--accent-soft");
  const font = css("--font-ui") || "system-ui, sans-serif";
  return {
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true, // we show our own message with the source
    theme: "base",
    fontFamily: font,
    themeVariables: {
      darkMode: isDark(paper),
      background: paper,
      fontFamily: font,
      fontSize: "14px",
      primaryColor: raised,
      primaryTextColor: ink,
      primaryBorderColor: faint,
      secondaryColor: accentSoft,
      secondaryTextColor: ink,
      secondaryBorderColor: accent,
      tertiaryColor: sunk,
      tertiaryTextColor: ink,
      tertiaryBorderColor: rule,
      lineColor: soft,
      textColor: ink,
      mainBkg: raised,
      nodeBorder: faint,
      clusterBkg: sunk,
      clusterBorder: rule,
      edgeLabelBackground: paper,
      noteBkgColor: accentSoft,
      noteTextColor: ink,
      noteBorderColor: accent,
      actorBkg: raised,
      actorBorder: faint,
      actorTextColor: ink,
      signalColor: soft,
      signalTextColor: ink,
    },
  };
}

export function loadMermaid(url) {
  loading ||= import(url).then((m) => m.default);
  return loading;
}

let counter = 0;
let queue = Promise.resolve();

// Render every unrendered `.mermaid-block` (from ```mermaid fences) under root.
// Mermaid's render is not re-entrant, so calls run one after another; a live
// refresh that replaces the page mid-render just skips the detached blocks.
export function renderDiagrams(root) {
  queue = queue.then(() => renderNow(root)).catch(() => {});
  return queue;
}

async function renderNow(root) {
  const blocks = [...root.querySelectorAll(".mermaid-block:not([data-rendered])")];
  if (!blocks.length) return;
  let mermaid;
  try {
    mermaid = await loadMermaid(new URL("../vendor/mermaid/mermaid.esm.min.mjs", import.meta.url).href);
  } catch (err) {
    for (const el of blocks) el.dataset.rendered = "failed";
    return;
  }
  mermaid.initialize(mermaidConfig());
  for (const el of blocks) {
    if (!el.isConnected) continue;
    const source = el.dataset.src || "";
    el.dataset.rendered = "pending";
    const id = `rdstudio-mermaid-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, source);
      el.innerHTML = svg;
      el.dataset.rendered = "done";
    } catch (err) {
      // Mermaid can leave its scratch container behind when parsing fails.
      document.getElementById(id)?.remove();
      document.getElementById("d" + id)?.remove();
      el.dataset.rendered = "failed";
      el.classList.add("error");
      el.innerHTML = `<p class="mermaid-error">This diagram could not be drawn: ${esc(String(err?.message || err).split("\n")[0])}</p><pre><code>${esc(source)}</code></pre>`;
    }
  }
}
