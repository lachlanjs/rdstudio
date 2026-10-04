import katex from 'katex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const katexCss = fs.readFileSync(path.join(here, 'katex-nofont.css'), 'utf8');

export const m = (tex) => katex.renderToString(tex, { throwOnError: true, strict: true });
export const md = (tex) => katex.renderToString(tex, { throwOnError: true, strict: true, displayMode: true });

// Real maths from 03-real-content.md, rendered once.
export const T = {
  Jj_yj: m('J_j y_j'),
  zero: m('0'),
  varTerm: m('\\frac{g^2}{N}\\, q'),
  h: m('h'),
  varh: m('\\mathrm{Var}(h) = N g^2 q'),
  invN: m('1/N'),
  N: m('N'),
  varTermB: m('\\frac{g^2}{N}\\, q'),
  N1: m('N = 1'),
  hDist: m('h'),
  // problem
  J1JN: m('J_1, \\dots, J_N'),
  pm: m('+g/\\sqrt{N}'),
  mm: m('-g/\\sqrt{N}'),
  half: m('1/2'),
  y1yN: m('y_1, \\dots, y_N'),
  meanZero: m('0'),
  Ey2: m('\\mathbb{E}[y^2] = q'),
  Jj: m('J_j'),
  eq: md('h = \\sum_{j=1}^N J_j\\, y_j.'),
  pmgN: m('\\pm g/\\sqrt{N}'),
  pmg: m('\\pm g'),
  hsym: m('h'),
  Nsym: m('N'),
};
