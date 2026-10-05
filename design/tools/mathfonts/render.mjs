// usage: node render.mjs <font> ; prints JSON {key: svg}
import MathJax from 'mathjax';
const font = process.argv[2];
const TEX = {
  inline1: 'J_j y_j', inline2: '\\frac{g^2}{N}\\, q', inline3: '\\mathbb{E}[y^2] = q', inline4: '\\pm g/\\sqrt{N}',
  display: '\\mathrm{Var}(h) = \\sum_{j=1}^N \\mathrm{Var}(J_j y_j) = N \\cdot \\frac{g^2}{N}\\, q = g^2 q',
  greek: 'C(\\tau) = \\int \\! \\mathcal{D}z \; \\phi\\big(\\sqrt{q}\\, z\\big)^2, \\qquad \\partial_\\tau^2 \\Delta = -\\frac{\\partial V}{\\partial \\Delta}',
};
await MathJax.init({ loader: { load: ['input/tex', 'output/svg'] }, output: { font: 'mathjax-' + font }, svg: { fontCache: 'none' } });
const out = {};
for (const [k, t] of Object.entries(TEX)) {
  const node = await MathJax.tex2svgPromise(t, { display: k === 'display' || k === 'greek' });
  out[k] = MathJax.startup.adaptor.innerHTML(node);
}
console.log(JSON.stringify(out));
