// Runtime for agent reports: KaTeX maths and Vega-Lite charts, styled to match the dashboard.
(function () {
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    const ink = css("--ink"), soft = css("--ink-soft"), rule = css("--rule");
    const palette = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => css(`--g${i}`));
    return {
      background: null,
      font: "Atkinson, system-ui, sans-serif",
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

  function start() {
    renderMath();
    renderCharts();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
