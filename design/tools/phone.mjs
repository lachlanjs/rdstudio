// Phone layouts (390 x 844) for A, with B's Atlas. Each card shows two phones: the top of the stack and the stack scrolled to its end.
import { doc } from './marginalia.mjs';
import { T } from './tex.mjs';
import { buildAtlas, atlasSvg } from './atlas.mjs';
import { ATLAS_CSS } from './survey.mjs';

export const GROUP_P = 'Phone · A with the Survey Atlas';

const ic = (d, extra = '') => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
const ICON = {
  Today: ic('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
  Library: ic('<path d="M5 4v16M9.5 4v16M14 5l4.5 14.5"/>'),
  Practice: ic('<path d="M4 20l1-4L16.5 4.5l3 3L8 19z M14.5 6.5l3 3"/>'),
  Atlas: ic('<path d="M12 3c5 0 9 3.6 9 8.5S17 21 12 21 3 17 3 12 7 3 12 3z"/><path d="M12 7.5c2.5 0 4.5 1.8 4.5 4.3S14.5 16.5 12 16.5 7.5 14.6 7.5 12 9.5 7.5 12 7.5z"/>'),
  More: ic('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
  search: ic('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  back: ic('<path d="M14.5 5L8 12l6.5 7"/>'),
};

const tabs = (active) => `<nav class="ph-tabs" aria-label="Spaces">${['Today', 'Library', 'Practice', 'Atlas', 'More'].map((n) => `<a href="#" ${n === active ? 'aria-current="page"' : ''}>${ICON[n]}<span>${n}</span></a>`).join('')}</nav>`;
const top = () => `<header class="ph-top"><div class="brand">rdstudio</div><button class="ph-ic" type="button" aria-label="Jump to a note or action">${ICON.search}</button></header>`;

const phone = ({ header, stack, foot, end = false, to = '', cls = '' }) => `<div class="ph ${cls}">${header}<div class="ph-scroll${end ? ' end' : ''}"${to ? ` data-to="${to}"` : ''}><div class="ph-stack">${stack}</div></div>${foot}</div>`;
const row = (frames) => `<div class="screen">${frames.map(([cap, html]) => `<figure class="ph-fig"><figcaption>${cap}</figcaption>${html}</figure>`).join('')}</div>`;
// a frame with data-to shows the stack scrolled so that the named anchor sits at the top
const SCROLL_JS = `(function(){function go(){[].forEach.call(document.querySelectorAll('.ph-scroll[data-to]'),function(s){var st=s.firstElementChild,a=st.querySelector('[data-anchor="'+s.dataset.to+'"]');if(!a)return;st.style.transform='none';var k=(s.getBoundingClientRect().width/s.offsetWidth)||1;var d=(a.getBoundingClientRect().top-s.getBoundingClientRect().top)/k-12;st.style.transform='translateY('+(-d)+'px)';});}(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(go);})();`;

const PHONE_CSS = `
.screen{width:1290px;height:884px;display:flex;gap:60px;overflow:hidden}
.screen.two{width:840px}
.ph-fig{margin:0;width:390px;flex:none}
.ph-fig figcaption{height:40px;display:flex;align-items:center;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.ph{position:relative;width:390px;height:844px;overflow:hidden;background:var(--surface);outline:1px solid var(--rule-strong)}
.ph-top{position:absolute;left:0;right:0;top:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 6px 0 16px;border-bottom:1px solid var(--rule);font-family:var(--font-ui);font-size:14px;line-height:16px;background:var(--surface);z-index:3}
.ph-top .ttl{font-family:var(--font-ui);font-size:13px;color:var(--text-soft);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-top .ttl b{color:var(--text)}
.ph-top.back{padding-left:2px}
.ph-ic{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;background:none;border:0;color:var(--text);cursor:pointer;flex:none}
.ph-tabs{position:absolute;left:0;right:0;bottom:0;height:64px;display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--rule);background:var(--surface);z-index:3}
.ph-tabs a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:44px;color:var(--text-soft);text-decoration:none;font-family:var(--font-ui);font-size:11px;line-height:14px}
.ph-tabs a[aria-current]{color:var(--text);font-weight:700;box-shadow:inset 0 2px 0 var(--text)}
.ph-scroll{position:absolute;left:0;right:0;top:56px;bottom:64px;overflow:hidden;display:flex;flex-direction:column}
.ph-scroll.end{justify-content:flex-end}
.ph-stack{flex:none;padding:0 16px 20px}
/* Today, as a stack */
.p-head{padding:18px 0 14px}
.p-head h1{font-size:30px;line-height:1.15;font-weight:700}
.p-head .meta{display:block;margin-top:4px}
.p-streaks{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--rule)}
.p-streak{padding:12px 0 12px;font-family:var(--font-ui);border-bottom:1px solid var(--rule)}
.p-streak:nth-child(even){border-left:1px solid var(--rule);padding-left:16px}
.s-label{font-size:13px;line-height:16px;color:var(--text-soft)}
.s-num{display:flex;align-items:baseline;gap:8px;margin:4px 0 2px}
.s-num b{font-size:36px;line-height:1;font-weight:700;color:var(--text)}
.s-num span{font-size:13px;color:var(--text-soft)}
.s-state{display:flex;align-items:center;gap:7px;font-size:12px;line-height:16px;color:var(--text)}
.s-best{font-size:12px;line-height:16px;color:var(--text-faint);min-height:16px}
.box{display:inline-block;width:9px;height:9px;border:1.5px solid var(--text-soft);flex:none}
.box.on{background:var(--text);border-color:var(--text)}
.p-week{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--rule);font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.p-week .segs{display:flex;gap:3px}
.p-week .segs i{width:20px;height:8px;border:1.5px solid var(--text-soft)}
.p-week .segs i.on{background:var(--text);border-color:var(--text)}
.p-sec{margin-top:26px}
.p-sec .meta{display:block;margin-top:2px}
.p-sec h2{font-size:22px;line-height:1.3;font-weight:700;margin-top:6px}
.p-sec .desc{color:var(--text-soft);font-size:16px;line-height:1.45;margin-top:2px}
.p-ex{margin-top:12px;border-top:1px solid var(--rule)}
.p-ex>li{border-bottom:1px solid var(--rule)}
.p-row{display:grid;grid-template-columns:22px 1fr auto;column-gap:4px;align-items:baseline;min-height:52px;padding:10px 0;font-size:17px;line-height:1.35;color:var(--text);text-decoration:none}
.p-row .n{font-family:var(--font-ui);font-size:13px;color:var(--text-faint)}
.p-row .st{font-family:var(--font-ui);font-size:13px;line-height:16px;padding:0 3px;margin-left:10px;border-radius:var(--radius-sm);white-space:nowrap}
.st-pass{background:var(--pen-green-soft);border-bottom:4px double var(--pen-green)}
.st-miss{background:var(--pen-red-soft);border-bottom:2px solid var(--pen-red)}
.st-none{color:var(--text-faint)}
.st-prog{border:1px solid var(--rule-strong);color:var(--text)}
.none .t{color:var(--text-soft)}
/* a pin in the flow: it hangs from the row or paragraph above it by a short stem in its pen's line */
.pin.in{position:relative;left:auto;width:auto;margin:10px 0 14px;padding:10px 12px 12px;font-size:16px;line-height:1.45}
.pin.in::before{content:"";position:absolute;top:-11px;height:10px;width:0}
.pin.in.stem-r::before{right:26px}
.pin.in.stem-l::before{left:20px}
.pin-red.in::before{border-left:2px solid var(--pen-red)}
.pin-green.in::before{border-left:4px double var(--pen-green)}
.pin-blue.in::before{border-left:2px dotted var(--pen-blue)}
.pin-hint.in::before{border-left:1px solid var(--text-soft)}
.pin.in a{display:inline-block;padding:2px 0}
.p-cont h3{font-size:19px;line-height:1.35;font-weight:700;margin-top:10px}
.p-cont .for{font-size:15px;line-height:1.45;color:var(--text-soft)}
.p-cont .draft{font-size:16px;line-height:1.5;font-style:italic;margin-top:6px}
.p-cont .draft .katex{font-style:normal}
.p-cont .btn{width:100%;height:44px;justify-content:center;margin-top:12px;font-size:14px}
.p-cont .meta{margin-top:8px;text-align:center}
.p-kind{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--rule);padding-bottom:6px}
.p-list li{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:48px;padding:6px 0;font-size:17px;line-height:1.35;border-bottom:1px solid var(--rule)}
.p-list li .meta{white-space:nowrap;margin:0}
.p-list a{display:inline-block;padding:6px 0}
/* workbench, as a stack */
.w-title{padding-top:16px}
.w-title h1{font-size:24px;line-height:1.25;font-weight:700}
.w-title .for{font-size:15px;line-height:1.6;color:var(--text-soft);margin-top:6px}
.w-prob{font-size:17px;line-height:1.6;margin-top:12px}
.w-prob p+p,.w-prob p+ol,.w-prob ol+p{margin-top:10px}
.w-prob .katex-display{margin:6px 0}
.w-prob ol{counter-reset:q}
.w-prob ol li{counter-increment:q;position:relative;padding-left:24px}
.w-prob ol li+li{margin-top:8px}
.w-prob ol li::before{content:counter(q);position:absolute;left:0;font-family:var(--font-ui);font-size:14px;color:var(--text-soft)}
.w-ans{margin-top:22px;border-top:1px solid var(--rule-strong);padding-top:14px}
.w-tools{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:8px;margin-top:10px}
.w-tools .btn{height:44px;justify-content:center;padding:0 6px;white-space:nowrap}
.w-draft{font-size:18px;line-height:2;margin-top:12px}
.caret{display:inline-block;width:2px;height:22px;background:var(--text);vertical-align:-5px}
.w-note{font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-faint);margin-top:4px}
.w-under{margin-top:6px}
.w-under .pin.in{margin:12px 0 0}
.w-under .pin.in::before{top:-13px;height:12px}
.reply{margin-top:10px}
.reply .field{height:44px;border:1px solid var(--rule-strong);border-radius:var(--radius-md);background:var(--surface);color:var(--text-soft);display:flex;align-items:center;padding:0 12px;font-family:var(--font-ui);font-size:13px}
.ph-act{position:absolute;left:0;right:0;bottom:0;height:104px;border-top:1px solid var(--rule);background:var(--surface);padding:10px 16px 0;z-index:3;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.ph-act .row1{display:flex;align-items:center;gap:8px;height:24px}
.ph-act .row1 .textbtn{margin-left:auto;background:none;border:0;height:44px;margin-top:-10px;margin-bottom:-10px;padding:0 0 0 16px;color:var(--text-soft);font-family:var(--font-ui);font-size:12px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--rule-strong)}
.ph-act .row2{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:8px}
.ph-act .btn{height:44px;justify-content:center;padding:0 10px;font-size:12px;white-space:nowrap}
.ph.bench .ph-scroll{bottom:104px}
/* Atlas */
.ph.map .ph-scroll{display:block}
.ph.map svg.atlas{left:-512px;top:-150px}
.p-lensbar{position:absolute;left:16px;right:16px;bottom:76px;z-index:2;display:flex;align-items:center;gap:8px;height:48px;padding:0 4px 0 12px;background:var(--surface-1);border:1px solid var(--rule-strong);border-radius:var(--radius-md);font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.p-lensbar b{color:var(--text)}
.p-lensbar .btn{margin-left:auto;height:44px;border:0;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--rule-strong)}
.p-north{position:absolute;right:14px;top:70px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;line-height:14px;color:var(--text-soft)}
.p-sheet{position:absolute;left:0;right:0;bottom:64px;z-index:2;background:var(--surface-1);border-top:1px solid var(--rule-strong);padding:8px 16px 14px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.p-sheet .grab{width:36px;height:0;border-top:2px solid var(--rule-strong);margin:0 auto 10px}
.p-sheet h2{display:flex;justify-content:space-between;align-items:center;font-size:13px;line-height:16px;font-weight:700;color:var(--text);margin:0}
.p-sheet h2 .btn{height:44px;border:0;padding:0 0 0 16px;font-weight:400;color:var(--text-soft);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--rule-strong)}
.p-sheet .chips{display:flex;flex-wrap:wrap;gap:8px}
.p-sheet .chips .btn{height:44px;padding:0 14px}
.p-sheet .legend{margin-top:12px;border-top:1px solid var(--rule);padding-top:8px;display:grid;grid-template-columns:1fr 1fr;column-gap:12px}
.p-sheet .legend li{display:flex;align-items:center;gap:8px;min-height:30px}
.p-sheet .legend li.wide{grid-column:1 / -1}
.p-sheet .legend svg{flex:none;overflow:visible}
`;

// ---------- Today ----------
function todayStack() {
  return `
  <div class="p-head"><h1>Today</h1><span class="meta">Sun 4 Oct · DMFT of random networks</span></div>
  <section class="p-streaks" aria-label="Streaks">
    <div class="p-streak"><div class="s-label">All three</div><div class="s-num"><b>0</b><span>days</span></div><div class="s-state"><i class="box"></i>not yet today</div><div class="s-best">best 4</div></div>
    <div class="p-streak"><div class="s-label">Recall</div><div class="s-num"><b>3</b><span>days</span></div><div class="s-state"><i class="box"></i>nothing due today</div><div class="s-best"></div></div>
    <div class="p-streak"><div class="s-label">New learning</div><div class="s-num"><b>0</b><span>days</span></div><div class="s-state"><i class="box"></i>not yet today</div><div class="s-best">best 2</div></div>
    <div class="p-streak"><div class="s-label">Problem solving</div><div class="s-num"><b>1</b><span>day</span></div><div class="s-state"><i class="box on"></i>done today</div><div class="s-best"></div></div>
  </section>
  <div class="p-week">This week <span class="segs" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span> 3 of 4 days <span>·</span> 1 reprieve banked</div>

  <section class="p-sec">
    <span class="kind">Set for you</span><span class="meta">2 of 3 answered · set 2 October by the teacher</span>
    <h2>Diagnostic 1</h2>
    <p class="desc">Probability prerequisites for the cavity method (Gaussian sums, variance scaling, CLT)</p>
    <ol class="p-ex">
      <li><a class="p-row" href="#"><span class="n">1</span><span class="t">Variance of a Gaussian-weighted sum, fixed inputs</span><span class="st st-pass">passed</span></a></li>
      <li data-anchor="mid"><a class="p-row" href="#"><span class="n">2</span><span class="t">Variance of a Gaussian-weighted sum, random inputs</span><span class="st st-miss">missed</span></a>
        <aside class="pin pin-red in stem-r"><div class="pin-head"><b>The teacher’s next step</b></div>
          <p>Fill the gap at <a href="#">variance scaling</a> before the cavity method: one note, then exercise 2 again.</p></aside></li>
      <li><a class="p-row" href="#"><span class="n">3</span><span class="t">Why the recurrent input is Gaussian</span><span class="st st-prog">in progress</span></a></li>
    </ol>
  </section>

  <section class="p-sec p-cont">
    <div class="p-kind"><span class="kind">Continue where you left off</span></div>
    <h3>Why the recurrent input is Gaussian</h3>
    <p class="for">For: Explain DMFT of random networks from first principles</p>
    <p class="draft">Each term ${T.Jj_yj} has mean ${T.zero} and variance ${T.varTerm}, and the terms are independent. So by the central limit theorem …</p>
    <button class="btn primary" type="button">Continue writing</button>
    <div class="meta">Draft saved · 2 of 3 hints used</div>
  </section>

  <section class="p-sec"><div class="p-kind"><span class="kind">Reviews due</span><span class="meta">2</span></div>
    <ul class="p-list"><li><a href="#">Gaussian fields</a></li><li><a href="#">Central limit theorem</a></li></ul></section>
  <section class="p-sec"><div class="p-kind"><span class="kind">Changed since you looked</span><span class="meta">2 notes</span></div>
    <ul class="p-list"><li><a href="#">The cavity method</a><span class="meta">2 commits</span></li><li><a href="#">Self-consistent autocorrelation</a></li></ul></section>
  <section class="p-sec"><div class="p-kind"><span class="kind">Goals</span></div>
    <ul class="p-list">
      <li><span>Explain DMFT of random networks from first principles</span><span class="meta">1 of 3</span></li>
      <li><span>Solve problems with DMFT</span><span class="meta">none yet</span></li>
      <li><span>Understand Clark &amp; Abbott, coupled neuronal-synaptic dynamics</span><span class="meta">arXiv:2302.08985</span></li>
    </ul></section>`;
}

// ---------- workbench ----------
function benchStack() {
  return `
  <div class="w-title"><h1>Why the recurrent input is Gaussian</h1>
    <p class="for">For: <a href="#">Explain DMFT of random networks from first principles</a>. Tests: <a href="#">Gaussian fields</a>.</p></div>
  <div class="w-prob">
    <p>Let ${T.J1JN} be iid, each equal to ${T.pm} or ${T.mm} with probability ${T.half} (so they are not Gaussian). Let ${T.y1yN} be iid random numbers with mean ${T.meanZero} and ${T.Ey2}, independent of the ${T.Jj}, and let</p>
    <div class="eq">${T.eq}</div>
    <ol>
      <li>As ${T.Nsym} becomes large, what can you say about the distribution of ${T.hsym}, and why?</li>
      <li>Now suppose the weights were ${T.pmg} instead of ${T.pmgN}. How would the typical size of ${T.hsym} depend on ${T.Nsym}?</li>
    </ol>
    <p>Answer in a few sentences, with whatever working you need.</p>
  </div>
  <section class="w-ans" aria-label="Your answer" data-anchor="mid">
    <div class="p-kind" style="border:0;padding:0"><span class="kind">Your answer</span><span class="meta">you said you were fairly sure</span></div>
    <div class="w-tools" role="toolbar" aria-label="Ask the teacher">
      <button class="btn" type="button">Hint (2 of 3)</button>
      <button class="btn" type="button" aria-pressed="true">Feedback</button>
      <button class="btn" type="button">Discuss</button>
    </div>
    <p class="w-draft">Each term ${T.Jj_yj} has mean ${T.zero} and variance <span style="white-space:nowrap">${T.varTerm},</span> and <span class="pen pen-hint"><span class="pen pen-green" style="padding:0">the terms are independent</span></span>. So <span class="pen pen-green">by the central limit theorem</span> ${T.h} is <span class="pen pen-blue">approximately Gaussian</span>, with <span class="pen pen-red">${T.varh}</span>.</p>
    <div class="w-under" aria-label="The teacher, on this paragraph">
      <aside class="pin pin-hint in stem-l"><div class="pin-head"><b>Hint 1 of 3</b></div><p>Independence.</p></aside>
      <aside class="pin pin-hint in stem-l"><div class="pin-head"><b>Hint 2 of 3</b></div><div class="pin-quote"><span>the terms are independent</span></div><p>Think about why the cross terms vanish.</p></aside>
      <aside class="pin pin-green in stem-l"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>the terms are independent</span></div><p>Right, and it is why the variances add.</p></aside>
      <aside class="pin pin-green in stem-l"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>by the central limit theorem</span></div><p>The right tool, and named.</p></aside>
      <aside class="pin pin-blue in stem-l"><div class="pin-head"><b>Discussion</b></div><div class="pin-quote"><span>approximately Gaussian</span></div>
        <p><span class="who">You asked</span><br>Is it exactly Gaussian for finite ${T.N}?</p>
        <p><span class="who">The teacher asked back</span><br>What would ${T.hDist}’s distribution be for ${T.N1}?</p>
        <div class="reply"><div class="field">Reply</div></div></aside>
      <aside class="pin pin-red in stem-l"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>${T.varh}</span></div><p>The ${T.invN} in each weight’s variance has gone missing; add up ${T.N} terms of ${T.varTermB} again.</p></aside>
    </div>
    <p class="w-draft" style="margin-top:14px"><span class="caret"></span></p>
    <p class="w-note">Maths is typeset everywhere except the line you are writing.</p>
  </section>`;
}
const benchTop = `<header class="ph-top back"><button class="ph-ic" type="button" aria-label="Back to Diagnostic 1">${ICON.back}</button><div class="ttl">Diagnostic 1 · <b>3 of 3</b></div><button class="ph-ic" type="button" aria-label="Jump to a note or action">${ICON.search}</button></header>`;
const benchFoot = `<div class="ph-act"><div class="row1"><i class="box on" style="width:8px;height:8px"></i>Draft saved<button class="textbtn" type="button">Versions</button></div>
  <div class="row2"><button class="btn" type="button">Mark it yourself</button><button class="btn primary" type="button">Ask an agent to mark it</button></div></div>`;

// ---------- Atlas ----------
const lg = {
  understood: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="9.5" class="ring-green-out"/><circle r="7" class="ring-green-in"/><circle r="3.5" class="m-fill"/></svg>`,
  worked: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="5" class="m-fill"/></svg>`,
  opened: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="4.5" class="m-open"/></svg>`,
  none: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="3.2" class="m-none"/></svg>`,
  needs: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="9" class="ring-red"/><circle r="4.5" class="m-open"/></svg>`,
  frontier: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 12H20" class="a-front"/><path d="M4 12v-6M8 12v-3M12 12v-6M16 12v-3M20 12v-6" class="a-hach"/></svg>`,
  path: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="a-path"/></svg>`,
};
function atlasPhone(open) {
  const svg = atlasSvg(buildAtlas(), { graticule: false, labelRefs: true, labelLeft: new Set(['Self-consistent autocorrelation']), labelBelow: new Set(['Variance scaling', 'The cavity method']) });
  const north = `<div class="p-north"><svg width="20" height="40" viewBox="0 0 28 56" aria-hidden="true"><path d="M14 54V8" stroke="var(--text-soft)" stroke-width="1.5" fill="none"/><path d="M14 2L21 17H14Z" fill="var(--text-soft)"/><path d="M14 2L7 17H14Z" fill="none" stroke="var(--text-soft)" stroke-width="1.25"/></svg><span>N</span></div>`;
  const bar = `<div class="p-lensbar"><span>Lenses</span><b>Understanding · Study path</b><button class="btn" type="button">Change</button></div>`;
  const sheet = `<aside class="p-sheet" aria-label="Lenses"><div class="grab"></div>
    <h2>Lenses<button class="btn" type="button">Done</button></h2>
    <div class="chips"><button class="btn" type="button">Links</button><button class="btn" type="button" aria-pressed="true">Understanding</button><button class="btn" type="button" aria-pressed="true">Study path</button><button class="btn" type="button">Tour</button><button class="btn" type="button">Goal</button></div>
    <ul class="legend">
      <li>${lg.understood}<span>Understood</span></li><li>${lg.worked}<span>Worked through</span></li>
      <li>${lg.opened}<span>Opened</span></li><li>${lg.none}<span>Not reached, in fog</span></li>
      <li class="wide">${lg.needs}<span>The teacher says: needs work</span></li>
      <li class="wide">${lg.frontier}<span>Frontier: hachures face the fog</span></li>
      <li class="wide">${lg.path}<span>Study path to The cavity method</span></li>
      <li class="wide"><span style="width:22px;text-align:center;font-family:var(--font-map);font-size:11px">N</span><span>North is later in the study order</span></li>
    </ul></aside>`;
  return `<div class="ph map">${top()}<div class="ph-scroll">${svg}</div>${north}${open ? sheet : bar}${tabs('Atlas')}</div>`;
}

const mk = (title, subtitle, body, css = '', w = 1290) => doc({
  marker: `@dsCard group="${GROUP_P}" width=${w} height=884 subtitle="${subtitle}"`,
  title, css: PHONE_CSS + css, body, js: SCROLL_JS, dir: 'a',
}).replace('content="width=1440"', `content="width=${w}"`);

export function phoneDocs() {
  const t = (o) => phone({ header: top(), stack: todayStack(), foot: tabs('Today'), ...o });
  const b = (o) => phone({ header: benchTop, stack: benchStack(), foot: benchFoot, cls: 'bench', ...o });
  return {
    PhoneToday: mk('Today, phone', 'Today on a phone, 390 by 844, dark: the same content as one stack, shown at three scroll positions. The teacher’s next step hangs under the row it is about.',
      row([['Top of the stack', t({})], ['Scrolled to exercise 2', t({ to: 'mid' })], ['Scrolled to the end', t({ end: true })]])),
    PhoneWorkbench: mk('Workbench, phone', 'The workbench on a phone, dark, at three scroll positions. The teacher’s cards sit under the paragraph they pin, each quoting its words in its pen’s line.',
      row([['The problem', b({})], ['Your answer, with the teacher’s first cards', b({ to: 'mid' })], ['Scrolled to the end', b({ end: true })]])),
    PhoneAtlas: mk('Atlas, phone', 'The Atlas on a phone, dark: pan and pinch the same map. Lenses collapse to one bar; the legend opens as a sheet. Placeholder folders and notes.',
      row([['Map, lenses collapsed', atlasPhone(false)], ['Lenses and legend open', atlasPhone(true)]]).replace('class="screen"', 'class="screen two"'), ATLAS_CSS, 840),
  };
}
