// The Library note (learning mode) and project mode (ramplib): Atlas with two lenses, Today, and the Project space.
// PLACEHOLDER CONTENT: ramplib's module and file names, commits, reviews and agent reports are invented for the sketch.
// The note text on variance scaling is written for the sketch around the real exercise; it is not from 03-real-content.md.
import { doc, topbar, TODAY_CSS, TODAY_JS, TODAY_LEADER_JS, GROUP_A } from './marginalia.mjs';
import { m, md } from './tex.mjs';
import hljs from 'highlight.js';
import { ATLAS_CSS } from './survey.mjs';
import { layout, terrain, view, page, fit, lg, N, E, A2_CSS, BASE_SETTINGS } from './atlas2.mjs';
import { organic, folderFields } from './organic.mjs';

export const GROUP_PM = 'Project mode · ramplib (A with the Survey Atlas)';
const RAMP = { name: 'ramplib', mode: 'Project' };

// ---------- code blocks: Ioskeley Mono, highlighted at build time with highlight.js and mapped onto two syntax tokens ----------
// Two hues no pen uses (violet keywords, amber literals); everything else is weight, slant and the neutral text tokens.
export const CODE_CSS = `
pre.code{margin:14px 0;padding:12px 16px;background:var(--surface-1);border:1px solid var(--rule);border-radius:var(--radius-md);font-family:var(--font-ui);font-size:14px;line-height:1.5;color:var(--text);white-space:pre;overflow:hidden;tab-size:4}
pre.code .lang{display:block;margin:-4px 0 8px;font-size:12px;line-height:16px;color:var(--text-faint)}
code{font-family:var(--font-ui);font-size:.86em;background:var(--surface-1);border:1px solid var(--rule);border-radius:var(--radius-sm);padding:0 4px}
.hljs-keyword,.hljs-literal,.hljs-meta,.hljs-name,.hljs-selector-tag,.hljs-section{color:var(--syntax-keyword);font-weight:700}
.hljs-meta{font-weight:400}.hljs-meta .hljs-keyword{font-weight:700}
.hljs-string,.hljs-number,.hljs-regexp,.hljs-symbol,.hljs-meta .hljs-string,.hljs-bullet{color:var(--syntax-literal)}
.hljs-comment,.hljs-quote{color:var(--text-soft);font-style:italic}
.hljs-title,.hljs-title.function_,.hljs-title.class_{font-weight:700;color:var(--text)}
.hljs-subst,.hljs-params,.hljs-attr,.hljs-built_in,.hljs-type,.hljs-variable,.hljs-property{color:var(--text)}
`;
export const hl = (lang, src) => hljs.highlight(src, { language: lang }).value;
const PY = hl('python', `import numpy as np

def recurrent_input(N, g=1.5, q=1.0, trials=10_000, seed=0):
    rng = np.random.default_rng(seed)
    J = rng.choice([-1.0, 1.0], size=(trials, N)) * g / np.sqrt(N)
    y = rng.normal(0.0, np.sqrt(q), size=(trials, N))
    return (J * y).sum(axis=1)

for N in (10, 100, 1000):
    print(N, recurrent_input(N).var())  # near g**2 * q = 2.25`);

// ---------- the Library note with its companion panel ----------
const NOTE_CSS = `
.lib{position:absolute;left:0;right:0;top:48px;bottom:0;display:grid;grid-template-columns:264px 1fr 372px}
.tree{border-right:1px solid var(--rule);padding:18px 12px 0 48px;font-family:var(--font-ui);font-size:13px;line-height:16px;color:var(--text-soft)}
.tree h2{font-size:13px;line-height:16px;font-weight:700;color:var(--text);margin-bottom:8px}
.tree li{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;margin-left:-8px}
.tree li.f{color:var(--text);margin-top:6px}
.tree li.n{padding-left:22px}
.tree li[aria-current]{background:var(--surface-3);color:var(--text);font-weight:700;box-shadow:inset 2px 0 0 var(--text)}
.tree .c{color:var(--text-faint);font-weight:400}
.note{padding:18px 64px 0 72px;overflow:hidden}
.note .inner{max-width:660px}
.note .path{font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-faint)}
.note h1{font-size:34px;line-height:1.15;font-weight:700;margin-top:4px}
.note h2{font-size:24px;line-height:1.3;font-weight:700;margin-top:18px}
.note p{margin-top:10px}
.note .katex-display{margin:10px 0 4px}
.comp{border-left:1px solid var(--rule);padding:18px 48px 0 28px}
.comp .blk{margin-bottom:22px}
.comp .kind{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--rule);padding-bottom:6px}
.comp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.comp .step{border:1px solid var(--rule-strong);border-radius:var(--radius-md);padding:7px 8px 8px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.comp .step.on{color:var(--text)}
.comp .step .box{margin-bottom:6px;display:block}
.comp p.small{font-size:16px;line-height:1.5;margin-top:8px}
.comp .field{margin-top:8px;height:64px;border:1px solid var(--rule-strong);border-radius:var(--radius-md);padding:8px 10px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.comp .row{display:flex;gap:8px;margin-top:8px}
.comp ol.pre{margin-top:2px}
.comp ol.pre li{display:grid;grid-template-columns:22px 1fr auto;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--rule);font-size:17px;line-height:1.35}
.comp ol.pre .n{font-family:var(--font-ui);font-size:13px;color:var(--text-faint)}
.comp .tag{display:inline-block;border:1px solid var(--rule-strong);border-radius:var(--radius-sm);padding:0 6px;font-family:var(--font-ui);font-size:12px;line-height:18px;color:var(--text)}
`;

function noteBody() {
  const tree = [
    ['f', 'Probability', '9'], ['n', 'Central limit theorem'], ['n', 'Gaussian fields'], ['n', 'Gaussian integrals'], ['n', 'Independence'], ['cur', 'Variance scaling'],
    ['f', 'Cavity method', '7'], ['n', 'The cavity method'], ['n', 'Self-consistent autocorrelation'],
    ['f', 'Mean-field dynamics', '8'], ['f', 'Random matrices', '5'], ['f', 'Chaos in random networks', '5'], ['f', 'Papers', '3'],
  ].map(([k, t, c]) => k === 'f' ? `<li class="f"><span>${t}</span><span class="c">${c}</span></li>` : `<li class="n"${k === 'cur' ? ' aria-current="page"' : ''}>${t}</li>`).join('');
  return `<div class="screen">
${topbar('Library')}
<main class="lib">
  <nav class="tree" aria-label="Folders"><h2>Library</h2><ul>${tree}</ul></nav>
  <article class="note"><div class="inner">
    <div class="path">Probability / Variance scaling · edited 2 October</div>
    <h1>Variance scaling</h1>
    <p>A sum of ${m('N')} independent terms has ${m('N')} times the variance of one term. So for the recurrent input to stay the same size as the network grows, each weight has to shrink: its variance must be ${m('g^2/N')}, the step the <a href="#">cavity method</a> takes for granted.</p>
    <h2>The calculation</h2>
    <p>With ${m('J_j = \\pm g/\\sqrt{N}')} and ${m('\\mathbb{E}[y^2] = q')}, the terms ${m('J_j y_j')} are independent with mean ${m('0')}, so their variances add:</p>
    ${md('\\mathrm{Var}(h) = \\sum_{j=1}^N \\mathrm{Var}(J_j y_j) = N \\cdot \\frac{g^2}{N}\\, q = g^2 q.')}
    <p>The ${m('N')} from the sum cancels the ${m('1/N')} from each weight. By the <a href="#">central limit theorem</a>, ${m('h')} is then approximately Gaussian with a variance that does not depend on ${m('N')}.</p>
    <h2>Check it numerically</h2>
    <p><code>recurrent_input</code> returns one sample of ${m('h')} per trial.</p>
    <pre class="code"><span class="lang">python</span>${PY}</pre>
  </div></article>
  <aside class="comp" aria-label="Companion">
    <div class="blk"><div class="kind"><span>Your understanding</span><span class="meta">1 of 3</span></div>
      <div class="steps"><div class="step on"><i class="box on"></i>Opened</div><div class="step"><i class="box"></i>Worked through</div><div class="step"><i class="box"></i>Understood</div></div></div>
    <div class="blk"><div class="kind"><span>Explain it back</span></div>
      <p class="small">In your own words: why does each weight carry ${m('1/N')} of the variance?</p>
      <div class="field">Write a few sentences</div>
      <div class="row"><button class="btn" type="button">Ask the teacher to mark it</button></div></div>
    <div class="blk"><div class="kind"><span>Trust</span><span class="tag">unverified</span></div>
      <p class="small">Written by an agent on 2 October. Not yet reviewed by a person.</p></div>
    <div class="blk"><div class="kind"><span>Read these first</span><span class="meta">in order</span></div>
      <ol class="pre"><li><span class="n">1</span><a href="#">Independence</a><span class="meta">understood</span></li><li><span class="n">2</span><a href="#">Central limit theorem</a><span class="meta">understood</span></li><li><span class="n">3</span><a href="#">Gaussian fields</a><span class="meta">understood</span></li></ol></div>
    <button class="btn" type="button">Ask the teacher about this note</button>
  </aside>
</main>
</div>`;
}

// ---------- project mode: the Atlas, on the same engine as the learning Atlas ----------
// Positions from the previous app's layout (north force off), folders as contours, downhill routes: the default pairing.
// level means activity (0 untouched for 90 days, 1 this quarter, 2 this month, 3 this week) or health (how many of tested, reviewed, documented).
const FILES = [
  ['core', [['tree.hpp', 3, 3, 1], ['blocks.cpp', 3, 3, 1], ['sampler.cpp', 2, 3], ['bindings.cpp', 1, 2], ['eigen.cpp', 1, 3], ['rng.hpp', 0, 3]]],
  ['evolve', [['genotype.py', 3, 2, 1], ['population.py', 2, 3], ['selection.py', 1, 3], ['mutation.py', 2, 2], ['crossover.py', 1, 2], ['run.py', 2, 1, 1]]],
  ['fitness', [['objectives.py', 2, 2, 1], ['spectral.py', 1, 3], ['nonnormality.py', 0, 3], ['memory.py', 3, 1], ['narma.py', 2, 1]]],
  ['plasticity', [['node.py', 3, 1, 1], ['rewiring.py', 3, 0], ['intrinsic.py', 3, 1], ['rules.py', 2, 0]]],
  ['api', [['app.py', 1, 2, 1], ['runs.py', 1, 2], ['stream.py', 2, 1], ['schemas.py', 0, 2]]],
  ['dashboard', [['client.ts', 0, 1], ['stores.ts', 0, 0], ['routes', [['runs/+page.svelte', 1, 0], ['RunChart.svelte', 0, 0], ['RunTable.svelte', 0, 0]]]]],
  ['docs', [['index.qmd', 0, 1], ['theory.qmd', 0, 1], ['tutorial.qmd', 2, 1]]],
];
const DEPS = [
  ...E('blocks.cpp', ['tree.hpp']), ...E('sampler.cpp', ['blocks.cpp', 'rng.hpp']), ...E('bindings.cpp', ['tree.hpp', 'sampler.cpp', 'eigen.cpp']),
  ...E('genotype.py', ['bindings.cpp']), ...E('population.py', ['genotype.py']), ...E('selection.py', ['population.py']), ...E('mutation.py', ['genotype.py']), ...E('crossover.py', ['genotype.py']), ...E('run.py', ['population.py', 'selection.py', 'objectives.py']),
  ...E('objectives.py', ['spectral.py', 'nonnormality.py', 'memory.py', 'narma.py']), ...E('spectral.py', ['bindings.cpp']), ...E('nonnormality.py', ['bindings.cpp']), ...E('memory.py', ['node.py']), ...E('narma.py', ['node.py']),
  ...E('node.py', ['genotype.py', 'rules.py']), ...E('rewiring.py', ['node.py']), ...E('intrinsic.py', ['node.py']),
  ...E('app.py', ['runs.py', 'stream.py']), ...E('runs.py', ['run.py', 'schemas.py']), ...E('stream.py', ['runs.py']),
  ...E('client.ts', ['schemas.py']), ...E('stores.ts', ['client.ts']), ...E('runs/+page.svelte', ['stores.ts', 'RunChart.svelte', 'RunTable.svelte']),
  ...E('tutorial.qmd', ['run.py'], 2), ...E('theory.qmd', ['tree.hpp'], 2),
];
const dataset = (lens) => {
  const node = (t) => (Array.isArray(t[1]) ? [t[0], t[1].map(node)] : N(t[0], lens === 'activity' ? t[1] : t[2], !!t[3]));
  return { tree: ['ramplib', FILES.map(node)], edges: DEPS, struggling: 'rewiring.py', rings: lens === 'activity' ? 'plain' : 'green',
    review: lens === 'activity' ? new Set(['node.py\ngenotype.py', 'rewiring.py\nnode.py']) : new Set() };
};
const plg = { ring3: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="10" class="ring-plain"/><circle r="4.5" class="m-fill"/></svg>` };
const P_LEGEND = {
  activity: [[lg.trunk, 'Trunk: dependencies between two modules, with their count'], [lg.sel, 'The change in review: 3 files'], [lg.wall, 'A module’s outline'], [lg.frontier, 'Edge of recent work: hachures face the fog'],
    [plg.ring3, 'Changed this week: filled, ring'], [lg.worked, 'Changed this month: filled'], [lg.opened, 'Changed this quarter: outline'], [lg.none, 'Untouched for 90 days: faint, in fog'], [lg.needs, 'In review, checks failing']],
  health: [[lg.trunk, 'Trunk: dependencies between two modules, with their count'], [lg.wall, 'A module’s outline'], [lg.frontier, 'Edge of settled ground: hachures face the fog'],
    [lg.understood, 'Tested, reviewed and documented'], [lg.worked, 'Two of the three: filled'], [lg.opened, 'One of the three: outline'], [lg.none, 'None, or not known: faint, in fog'], [lg.needs, 'Checks failing']],
};
function projectAtlas(lens) {
  const L = layout(dataset(lens), { ...BASE_SETTINGS, north: 0 }), T = terrain(L, folderFields(L).inside);
  const v = view(L, T, { ...fit(L, 60), links: 'trunks', terrain: 'overview', org: organic(L, T) });
  const on = lens === 'activity' ? ['Dependencies', 'Activity', 'Change in review'] : ['Dependencies', 'Health'];
  return page(v, { zoomed: false, proj: RAMP, north: false, kinds: false, on, chips: ['Dependencies', 'Activity', 'Health', 'Change in review', 'Your understanding', 'Tour'], legend: P_LEGEND[lens],
    stats: lens === 'activity' ? 'Activity comes from git alone: when each file last changed.' : 'Health is three facts per file: a test exists, a person reviewed it, a note documents it. A file with no facts stays flat.',
    note: 'Linked files sit close together. Direction means nothing on a project map.', hint: 'Click a file to open it, a module to zoom in, empty space to step out.' });
}

// ---------- project mode: Today ----------
const PT_CSS = `
.ex .t code,.mblock code,.cl code{background:none;border:0;padding:0;font-size:.82em}
.st-wait{border:1px solid var(--rule-strong);color:var(--text)}
.ex li{grid-template-columns:28px 1fr auto auto}
.ex .who{font-family:var(--font-ui);font-size:12px;color:var(--text-faint);margin-right:14px}
.mblock li>span:first-child{min-width:0}
.cont .draft{font-style:normal}
`;
function projectToday() {
  return `<div class="screen">
${topbar('Today', false, RAMP)}
<main class="today" data-leaders>
  <svg class="leaders" aria-hidden="true"></svg>
  <div class="main-col" data-edge>
    <div class="page-head"><h1>Today</h1><span class="meta">Sun 4 Oct · ramplib</span></div>
    <section class="streaks" aria-label="This week">
      <div class="s-row">
        <div class="streak"><div class="s-label">Commits</div><div class="s-num"><b>14</b><span>this week</span></div><div class="s-state"><i class="box on"></i>3 today</div><div class="s-best">5 since you looked</div></div>
        <div class="streak"><div class="s-label">Reviews open</div><div class="s-num"><b>2</b><span>changes</span></div><div class="s-state"><i class="box"></i>1 waiting on you</div><div class="s-best"></div></div>
        <div class="streak"><div class="s-label">Checks</div><div class="s-num"><b>1</b><span>failing</span></div><div class="s-state"><i class="box"></i>plasticity, since Friday</div><div class="s-best">212 passing</div></div>
        <div class="streak"><div class="s-label">Agent reports</div><div class="s-num"><b>3</b><span>this week</span></div><div class="s-state"><i class="box"></i>1 unread</div><div class="s-best"></div></div>
      </div>
      <div class="week">Last 7 days <span class="segs" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i><i class="on"></i><i class="on"></i><i></i><i class="on"></i></span> commits on 5 of 7 days</div>
    </section>

    <section class="sec">
      <div class="sec-head"><span class="kind">Needs you</span><span class="meta">2 changes in review · 1 failing check</span></div>
      <ol class="ex" style="margin-top:10px">
        <li><span class="n">1</span><span class="t">Add structural rewiring to the plasticity node</span><span class="who">yours · 3 files</span><span class="st st-miss" id="m-missed">checks failing</span></li>
        <li><span class="n">2</span><span class="t">Log-space bounds for leaf magnitudes</span><span class="who">agent · 2 files</span><span class="st st-wait">waiting on you</span></li>
        <li><span class="n">3</span><span class="t">Tutorial for a first run</span><span class="who">agent · 1 file</span><span class="st st-pass">approved</span></li>
      </ol>
    </section>

    <section class="sec cont">
      <div class="sec-head"><span class="kind">Continue where you left off</span></div>
      <div class="cont-body">
        <div>
          <h3>How rewiring picks which connections to drop</h3>
          <p class="for">Design note · next to <code>plasticity/rewiring.py</code></p>
          <p class="draft">Each step removes the weakest fraction of connections in a block and regrows the same number at random, so the block keeps its density …</p>
        </div>
        <div style="text-align:right"><button class="btn primary" type="button">Continue writing</button><div class="meta" style="margin-top:8px;white-space:nowrap">Draft saved · branch rewiring</div></div>
      </div>
    </section>
  </div>

  <aside class="margin" data-margin>
    <div class="mblock"><div class="kind"><span>Changed since you looked</span><span class="meta">5 commits</span></div>
      <ul><li><a href="#"><code>core/blocks.cpp</code></a><span class="meta">3 commits</span></li><li><a href="#"><code>evolve/genotype.py</code></a></li><li><a href="#"><code>fitness/memory.py</code></a></li></ul></div>
    <aside class="pin pin-red today-pin" data-target="m-missed" data-dir="right" data-pen="red" id="pin-next">
      <div class="pin-head"><b>The teacher’s next step</b></div>
      <div class="pin-quote"><span>checks failing</span></div>
      <p>The failing test is about <a href="#">intrinsic plasticity</a>, which you have opened but not worked through: one note, then the fix.</p>
    </aside>
    <div class="mblock"><div class="kind"><span>Agents</span><span class="meta">1 running</span></div>
      <ul><li><span>Eigenvalue batch sizes, benchmark</span><span class="meta">report ready</span></li><li><span>Docs check</span><span class="meta">running</span></li></ul></div>
    <div class="mblock goal"><div class="kind"><span>Get up to speed</span><span class="meta">learning</span></div>
      <ul><li><span>Tour: how an ensemble is evolved</span><span class="meta">2 of 5 stops</span></li><li><span>Your understanding of ramplib</span><span class="meta">11 of 32 files</span></li></ul></div>
  </aside>
</main>
</div>`;
}

// ---------- project mode: the Project space ----------
const PS_CSS = `
.pspace{position:absolute;left:0;right:0;top:48px;bottom:0;display:grid;grid-template-columns:216px 1fr 372px;padding:0 56px 0 48px;column-gap:48px}
.pnav{padding-top:28px;font-family:var(--font-ui);font-size:13px;line-height:16px}
.pnav li{display:flex;justify-content:space-between;padding:8px 10px;margin-left:-10px;color:var(--text-soft)}
.pnav li[aria-current]{background:var(--surface-3);color:var(--text);font-weight:700;box-shadow:inset 2px 0 0 var(--text)}
.pnav .c{color:var(--text-faint);font-weight:400}
.pmain .page-head{padding:26px 0 14px}
.day{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--rule-strong);padding:14px 0 6px}
.cl li{display:grid;grid-template-columns:76px 1fr auto auto;column-gap:14px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--rule);font-size:17px;line-height:1.35}
.cl .h,.cl .ar{font-family:var(--font-ui);font-size:12px;color:var(--text-faint)}
.cl .ar{color:var(--text-soft)}
.cl .st{font-family:var(--font-ui);font-size:12px;line-height:16px;padding:0 3px;border-radius:var(--radius-sm);min-width:92px;text-align:right}
.cl .st.plain{color:var(--text-faint)}
.pmargin{padding-top:26px}
.pmargin .mblock li{font-size:16px}
.pin.q{position:relative;margin:10px 0 0}
.pin.q .row{display:flex;gap:8px;margin-top:8px}
.pin.q .btn{height:28px;padding:0 10px;font-size:12px}
`;
function projectSpace() {
  const c = (h, t, ar, st = '', cls = 'plain') => `<li><span class="h">${h}</span><span>${t}</span><span class="ar">${ar}</span><span class="st ${cls}">${st}</span></li>`;
  return `<div class="screen">
${topbar('Project', false, RAMP)}
<main class="pspace">
  <nav class="pnav" aria-label="Project"><ul>
    <li aria-current="page"><span>Changes</span><span class="c">14</span></li><li><span>Review queue</span><span class="c">2</span></li><li><span>Reports</span><span class="c">3</span></li>
    <li><span>Procedures</span><span class="c">4</span></li><li><span>Skills</span><span class="c">6</span></li><li><span>Agents</span><span class="c">2</span></li></ul></nav>
  <section class="pmain">
    <div class="page-head"><h1>Changes</h1><span class="meta">from git · 14 commits this week · 5 since you looked</span></div>
    <div class="day"><span class="kind">Today</span><span class="meta">3 commits</span></div>
    <ol class="cl">
      ${c('a41f9c2', 'Regrow dropped connections at random within the block', 'plasticity', 'checks failing', 'st-miss')}
      ${c('7be02d1', 'Rewiring rate as a leaf parameter', 'evolve', 'in review', 'st-wait')}
      ${c('c9d3e80', 'Benchmark: eigenvalue batch sizes', 'core', 'merged')}
    </ol>
    <div class="day"><span class="kind">Saturday 3 October</span><span class="meta">2 commits</span></div>
    <ol class="cl">
      ${c('51aa7f4', 'Log-space bounds for leaf magnitudes', 'core', 'in review', 'st-wait')}
      ${c('0e6b1d9', 'Memory capacity as an objective', 'fitness', 'merged')}
    </ol>
    <div class="day"><span class="kind">Friday 2 October</span><span class="meta">4 commits</span></div>
    <ol class="cl">
      ${c('f3c8a15', 'Intrinsic plasticity: threshold update', 'plasticity', 'merged')}
      ${c('8d22b07', 'Stream generation events to the dashboard', 'api', 'merged')}
      ${c('2a9e4c3', 'Tutorial for a first run', 'docs', 'approved', 'st-pass')}
      ${c('b70f6e1', 'Block sampler: reuse the generator across blocks', 'core', 'merged')}
    </ol>
    <div class="day"><span class="kind">Earlier this week</span><span class="meta">5 commits</span></div>
  </section>
  <aside class="pmargin">
    <div class="mblock"><div class="kind"><span>Review queue</span><span class="meta">2</span></div>
      <aside class="pin pin-red q"><div class="pin-head"><b>Checks failing</b></div><p>Add structural rewiring to the plasticity node</p><p class="who">yours · 3 files · 1 of 213 checks</p><div class="row"><button class="btn" type="button">Open the change</button></div></aside>
      <aside class="pin pin-hint q"><div class="pin-head"><b>Waiting on you</b></div><p>Log-space bounds for leaf magnitudes</p><p class="who">agent · 2 files · checks pass</p><div class="row"><button class="btn" type="button">Review</button><button class="btn" type="button">Ask an agent to review</button></div></aside></div>
    <div class="mblock" style="margin-top:26px"><div class="kind"><span>Agents</span><span class="meta">1 running</span></div>
      <ul><li><span>Docs check</span><span class="meta">running · 4 min</span></li><li><span>Eigenvalue batch sizes, benchmark</span><span class="meta">report ready</span></li></ul></div>
    <div class="mblock"><div class="kind"><span>Reports</span><span class="meta">1 unread</span></div>
      <ul><li><a href="#">Eigenvalue batch sizes</a><span class="meta">unread</span></li><li><a href="#">Weekly summary, 28 September</a></li></ul></div>
  </aside>
</main>
</div>`;
}

// ---------- code blocks in common languages ----------
const SAMPLES = [
  ['python', 'python', `from dataclasses import dataclass

@dataclass
class Leaf:
    magnitude: float = 1.0   # log-space
    p_connect: float = 0.1

def spectral_radius(w):
    \"\"\"Largest |eigenvalue| of w.\"\"\"
    return abs(np.linalg.eigvals(w)).max()`],
  ['cpp', 'c++', `#include <nanobind/nanobind.h>
namespace nb = nanobind;

// Sample one block of the matrix.
template <typename T>
Matrix<T> sample_block(const Leaf& leaf, Rng& rng) {
    const double scale = std::exp(leaf.magnitude);
    return rng.sparse<T>(leaf.rows, leaf.cols, 0.1) * scale;
}

NB_MODULE(core, m) { m.def("sample", &sample_block<double>); }`],
  ['typescript', 'typescript', `type Run = { id: string; generation: number; best: number | null };

export async function fetchRun(id: string): Promise<Run> {
  const res = await fetch(\`/api/runs/\${id}\`);
  if (!res.ok) throw new Error("run not found");
  return (await res.json()) as Run;
}

const stream = new EventSource("/api/runs/42/events");`],
  ['bash', 'shell', `# build the extension, then run the tests
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j 8
export PYTHONPATH="$PWD/build"
pytest tests/ -k "not slow" --maxfail=1`],
  ['rust', 'rust', `/// Mean of the squared entries.
pub fn variance(xs: &[f64]) -> Option<f64> {
    if xs.is_empty() {
        return None;
    }
    let n = xs.len() as f64;
    Some(xs.iter().map(|x| x * x).sum::<f64>() / n)
}`],
  ['json', 'json', `{
  "population": 200,
  "generations": 50,
  "objectives": ["spectral_radius", "memory"],
  "plasticity": { "rewiring": true, "rate": 0.05 },
  "seed": null
}`],
  ['yaml', 'yaml', `name: checks
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest -q   # 213 checks`],
  ['sql', 'sql', `SELECT run_id, MAX(fitness) AS best
FROM generations
WHERE created_at >= '2026-10-01'
GROUP BY run_id
HAVING COUNT(*) > 10
ORDER BY best DESC;`],
];
const SHEET_CSS = `
.screen{height:990px}
.sheet{position:absolute;inset:0;padding:22px 48px 0}
.sheet h1{font-size:24px;line-height:1.3;font-weight:700}
.sheet .lede{font-size:16px;line-height:1.5;color:var(--text-soft);max-width:1100px;margin-top:2px}
.sheet .grid{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;margin-top:8px}
.sheet pre.code{margin:8px 0 0;font-size:13px;line-height:1.45;padding:10px 14px}
.sheet .key{display:flex;gap:28px;margin-top:10px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.sheet .key b{font-weight:700}
`;
function codeSheet() {
  const blk = ([lang, label, src]) => `<pre class="code"><span class="lang">${label}</span>${hl(lang, src)}</pre>`;
  const L = [0, 2, 4, 6].map((i) => blk(SAMPLES[i])).join(''), R = [1, 3, 5, 7].map((i) => blk(SAMPLES[i])).join('');
  return `<div class="screen"><div class="sheet">
  <h1>Code blocks</h1>
  <p class="lede">Ioskeley Mono on <code>surface-1</code>. Two hues that no pen uses, and the rest is weight and slant, so a pen mark on code still reads as a pen mark.</p>
  <div class="key"><span><b class="hljs-keyword">keyword</b> violet and bold</span><span><span class="hljs-string">"literal"</span> amber: strings and numbers</span><span><span class="hljs-comment"># comment</span> italic, text-soft</span><span><b>name</b> being defined: bold</span><span>everything else: text</span></div>
  <div class="grid"><div>${L}</div><div>${R}</div></div>
</div></div>`;
}

const card = (group, subtitle) => `@dsCard group="${group}" width=1440 height=900 subtitle="${subtitle}"`;
export function projectDocs() {
  const sheet = (theme) => doc({ marker: card(GROUP_A, `Code blocks in eight common languages, ${theme}. Violet keywords and amber literals; comments italic; defined names bold.`),
    title: `Code blocks (${theme})`, css: CODE_CSS + SHEET_CSS, body: codeSheet(), js: '', theme }).replace('height=900', 'height=990');
  return {
    CodeBlocks: sheet('dark'),
    CodeBlocksLight: sheet('light'),
    MarginaliaNote: doc({ marker: card(GROUP_A, 'A Library note with its companion panel, dark: headings, maths, links and a code block. Code is Ioskeley Mono, highlighted in two hues no pen uses.'),
      title: 'Marginalia, a note with its companion', css: TODAY_CSS + NOTE_CSS + CODE_CSS, body: noteBody(), js: '' }),
    ProjectAtlasActivity: doc({ marker: card(GROUP_PM, 'Project mode, the Atlas with the activity lens: high ground is where work is happening, fog is what nobody has touched for 90 days. Placeholder files.'),
      title: 'Project mode, Atlas, activity', css: ATLAS_CSS + A2_CSS, body: projectAtlas('activity'), js: '' }),
    ProjectAtlasHealth: doc({ marker: card(GROUP_PM, 'Project mode, the same map with the health lens: height is how settled a file is (tested, reviewed, documented). Placeholder files.'),
      title: 'Project mode, Atlas, health', css: ATLAS_CSS + A2_CSS, body: projectAtlas('health'), js: '' }),
    ProjectToday: doc({ marker: card(GROUP_PM, 'Project mode, Today: what needs you, what changed, where you left off. The teacher’s pin and a Get up to speed block are the learning layer on top. Placeholder content.'),
      title: 'Project mode, Today', css: TODAY_CSS + CODE_CSS + PT_CSS, body: projectToday(), js: TODAY_JS + TODAY_LEADER_JS }),
    ProjectSpace: doc({ marker: card(GROUP_PM, 'Project mode, the Project space: changes from git, with the review queue, agents and reports in the margin. Placeholder content.'),
      title: 'Project mode, Project', css: TODAY_CSS + CODE_CSS + PT_CSS + PS_CSS, body: projectSpace(), js: '' }),
  };
}
