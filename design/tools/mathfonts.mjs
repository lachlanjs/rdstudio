// A comparison sheet of serif maths fonts beside Charter reading text.
// The first card is what the sketches use (KaTeX, with Charter for letters and digits). The others are MathJax 4 fonts, rendered to
// SVG at build time by tools/mathfonts/render.mjs, so the sheet needs no extra font files. Using one in the app means MathJax, not KaTeX.
import fs from 'node:fs';
import { doc, GROUP_A } from './marginalia.mjs';
import { m, md } from './tex.mjs';

const load = (f) => JSON.parse(fs.readFileSync(new URL(`./mathfonts/${f}.json`, import.meta.url), 'utf8'));
const TEX = { inline1: 'J_j y_j', inline2: '\\frac{g^2}{N}\\, q', inline3: '\\mathbb{E}[y^2] = q', inline4: '\\pm g/\\sqrt{N}',
  display: '\\mathrm{Var}(h) = \\sum_{j=1}^N \\mathrm{Var}(J_j y_j) = N \\cdot \\frac{g^2}{N}\\, q = g^2 q',
  greek: 'C(\\tau) = \\int \\! \\mathcal{D}z \; \\phi\\big(\\sqrt{q}\\, z\\big)^2, \\qquad \\partial_\\tau^2 \\Delta = -\\frac{\\partial V}{\\partial \\Delta}' };
const katexSet = Object.fromEntries(Object.entries(TEX).map(([k, t]) => [k, k === 'display' || k === 'greek' ? md(t) : m(t)]));

const FONTS = [
  ['Current: KaTeX with Charter letters', 'What the sketches use. Letters and digits are Charter; symbols and Greek are Computer Modern.', katexSet, 'k'],
  ['STIX Two', 'A Times-like scientific face. Sturdy, slightly condensed; the closest in weight to Charter.', load('stix2')],
  ['Termes', 'Times. Lighter and narrower than Charter.', load('termes')],
  ['Pagella', 'Palatino. Wide, calligraphic italics; the most elegant, the least like Charter.', load('pagella')],
  ['Schola', 'Century Schoolbook. Open and sturdy, close to Charter in colour.', load('schola')],
  ['Bonum', 'Bookman. Wide and heavy; reads as display.', load('bonum')],
  ['New Computer Modern', 'The LaTeX default, in MathJax 4’s current cut. Light next to Charter.', load('newcm')],
  ['Latin Modern', 'Computer Modern as an OpenType family. Nearly identical to the one above.', load('modern')],
];

const CSS = `
.screen{height:1130px}
.mf{position:absolute;inset:0;padding:22px 48px 0}
.mf h1{font-size:24px;line-height:1.3;font-weight:700}
.mf .lede{font-size:16px;line-height:1.5;color:var(--text-soft);max-width:1150px;margin-top:2px}
.mf .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-top:14px}
.mf .card{border:1px solid var(--rule);background:var(--surface-1);border-radius:var(--radius-md);padding:10px 16px 8px;height:242px;overflow:hidden}
.mf .card h2{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--font-ui);font-size:13px;line-height:16px;font-weight:700}
.mf .card h2 span{font-weight:400;font-size:12px;color:var(--text-faint)}
.mf .card .why{font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft);margin-top:2px}
.mf .card p.t{font-size:17px;line-height:1.6;margin-top:8px}
.mf .d{display:flex;justify-content:center;margin-top:6px;font-size:17px}
.mf .d+.d{margin-top:2px}
.mf .d svg{max-width:100%}
.mf .card.k .d .katex-display{margin:0}
`;

function sheet() {
  const card = ([name, why, s, cls]) => `<div class="card ${cls || ''}"><h2>${name}<span>${cls ? 'KaTeX' : 'MathJax 4'}</span></h2><div class="why">${why}</div>
    <p class="t">Each term ${s.inline1} has mean 0 and variance ${s.inline2}, where ${s.inline3} and the weights are ${s.inline4}.</p>
    <div class="d">${s.display}</div><div class="d">${s.greek}</div></div>`;
  return `<div class="screen"><div class="mf">
  <h1>Maths fonts beside Charter</h1>
  <p class="lede">The same sentence and two display equations in eight maths fonts. The reading text is Charter throughout; only the maths changes. Every font except the first needs MathJax 4 in place of KaTeX.</p>
  <div class="grid">${FONTS.map(card).join('')}</div>
</div></div>`;
}

export function mathFontDocs() {
  return {
    MathFonts: doc({ marker: `@dsCard group="${GROUP_A}" width=1440 height=1130 subtitle="Eight serif maths fonts set beside Charter: the current KaTeX setup and seven MathJax 4 fonts, to choose between."`,
      title: 'Maths fonts beside Charter', css: CSS, body: sheet(), js: '' }),
  };
}
