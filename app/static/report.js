// Runtime for agent reports: KaTeX maths and Vega-Lite charts, styled to match the dashboard.
(function () {
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;

  // The theme and the mode are the app's: the frame's bridge sets them on this page (data-theme, data-mode)
  // before anything is drawn, and again whenever they change. The theme files come with report.css. An
  // artifact is sandboxed, so it cannot read the app's settings itself. What is drawn from the colours
  // (charts) waits for the stylesheets, and is drawn again when the theme changes.
  function applyTheme() {
    return new Promise((resolve) => {
      if (document.readyState === "complete") resolve();
      else addEventListener("load", () => resolve(), { once: true });
    });
  }
  const look = () => `${document.documentElement.dataset.theme || ""}|${document.documentElement.dataset.mode || ""}|${css("--surface")}|${css("--text")}`;
  let drawnFor = null, again = 0;
  addEventListener("message", (e) => {
    if (!e.data || e.data.rdstudio !== "theme" || drawnFor === null) return;
    clearTimeout(again);
    again = setTimeout(() => { if (look() !== drawnFor) renderCharts(); }, 60); // after the bridge has set the page
  });

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    const ink = css("--ink"), soft = css("--ink-soft"), rule = css("--rule");
    const palette = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => css(`--g${i}`));
    return {
      background: null,
      font: css("--font-ui") || "system-ui, sans-serif",
      view: { stroke: null },
      axis: { labelColor: soft, titleColor: ink, gridColor: rule, domainColor: soft, tickColor: soft, labelFontSize: 12, titleFontSize: 13, titleFontWeight: 600 },
      legend: { labelColor: soft, titleColor: ink, labelFontSize: 12, titleFontSize: 13 },
      title: { color: ink, fontSize: 15, fontWeight: 600, anchor: "start" },
      range: { category: palette },
      mark: { color: palette[0] },
    };
  }

  function renderMath() {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  }

  function renderCharts() {
    if (!window.vegaEmbed) return;
    drawnFor = look();
    for (const old of document.querySelectorAll("div.chart")) old.remove(); // drawn before, in other colours
    for (const script of document.querySelectorAll('script.vega-lite[type="application/json"]')) {
      const holder = document.createElement("div");
      holder.className = "chart";
      script.after(holder);
      let spec;
      try {
        spec = JSON.parse(script.textContent);
      } catch (err) {
        holder.textContent = `Chart spec is not valid JSON: ${err.message}`;
        holder.className = "chart chart-error";
        continue;
      }
      if (spec.width === undefined) spec.width = "container";
      window.vegaEmbed(holder, spec, { actions: false, config: theme(), renderer: "svg" }).catch((err) => {
        holder.textContent = `Chart could not be drawn: ${err.message}`;
        holder.className = "chart chart-error";
      });
    }
  }

  // <pre class="mermaid"> blocks, drawn by the dashboard's diagram module.
  function renderMermaid() {
    const blocks = document.querySelectorAll("pre.mermaid");
    if (!blocks.length || !SCRIPT_SRC) return;
    for (const pre of blocks) {
      const holder = document.createElement("div");
      holder.className = "mermaid-block";
      holder.dataset.src = pre.textContent;
      holder.innerHTML = '<pre class="mermaid-source"></pre>';
      holder.firstChild.textContent = pre.textContent;
      pre.replaceWith(holder);
    }
    import(new URL("js/diagrams.js", SCRIPT_SRC).href)
      .then((m) => m.renderDiagrams(document.body))
      .catch(() => { /* the source stays visible */ });
  }

  function start() {
    renderMath();
    themed.then(() => { renderCharts(); renderMermaid(); });
  }
  const themed = applyTheme();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
