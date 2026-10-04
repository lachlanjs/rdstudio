import { katexCss, m, T } from './tex.mjs';

export const GROUP_A = 'A · Marginalia';

// ---------- shared pieces ----------
const CMD = `<svg class="cmd" viewBox="0 0 16 16" width="13" height="13" aria-label="Command" role="img"><path d="M5.5 5.5h5v5h-5z M5.5 5.5V4a1.75 1.75 0 1 0-1.75 1.75H5.5 M10.5 5.5V4a1.75 1.75 0 1 1 1.75 1.75H10.5 M5.5 10.5V12a1.75 1.75 0 1 1-1.75-1.75H5.5 M10.5 10.5V12a1.75 1.75 0 1 0 1.75-1.75H10.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

export const LEARN = { name: 'DMFT of random networks', mode: 'Learning' };
export function topbar(active, term = false, proj = LEARN) {
  const work = proj.mode === 'Project';
  const item = (n, i) => `<a href="#" ${n === active ? 'aria-current="page"' : ''}>${term ? `<span class="key">${i + 1}</span>` : ''}${n}</a>`;
  return `<header class="topbar">
  <div class="brand">rdstudio</div>
  <button class="proj" type="button" aria-label="Switch project"><span>${proj.name}</span><span class="mode">${proj.mode}</span></button>
  <nav class="spaces" aria-label="Spaces">${['Today', 'Library', 'Atlas', work ? 'Project' : 'Practice'].map(item).join('')}</nav>
  <div class="topbar-right">
    <a href="#" class="quiet">${work ? 'Practice' : 'Project'}</a>
    <button class="palette" type="button">${term ? '<span class="prompt" aria-hidden="true">›</span>' : ''}<span>Jump to a note or action</span><kbd>${CMD}K</kbd></button>
    <button class="you" type="button">You <span aria-hidden="true">▾</span></button>
  </div>
</header>`;
}

export const BASE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:var(--surface)}
body{color:var(--text);font-family:var(--font-reading);font-size:18px;line-height:1.65;-webkit-font-smoothing:antialiased}
.screen{position:relative;width:1440px;height:900px;overflow:hidden;background:var(--surface);color:var(--text)}
h1,h2,h3,p,ol,ul,blockquote{margin:0;padding:0}
ol,ul{list-style:none}
button{font:inherit;color:inherit}
a{color:var(--pen-blue);text-decoration:underline dotted var(--pen-blue);text-decoration-thickness:2px;text-underline-offset:4px}
:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.katex{font-size:1.08em}
/* maths letters and digits are Charter, so they match the reading text; symbols, Greek and big operators stay KaTeX */
@font-face{font-family:"Math Charter";src:url(../../fonts/Charter-Regular.woff2) format("woff2");font-weight:400;font-style:normal;unicode-range:U+30-39,U+41-5A,U+61-7A;size-adjust:92.6%}
@font-face{font-family:"Math Charter";src:url(../../fonts/Charter-Italic.woff2) format("woff2");font-weight:400;font-style:italic;unicode-range:U+30-39,U+41-5A,U+61-7A;size-adjust:92.6%}
@font-face{font-family:"Math Charter";src:url(../../fonts/Charter-Bold.woff2) format("woff2");font-weight:700;font-style:normal;unicode-range:U+30-39,U+41-5A,U+61-7A;size-adjust:92.6%}
@font-face{font-family:"Math Charter";src:url(../../fonts/Charter-BoldItalic.woff2) format("woff2");font-weight:700;font-style:italic;unicode-range:U+30-39,U+41-5A,U+61-7A;size-adjust:92.6%}
.katex,.katex .mathit,.katex .mathbf,.katex .mainrm{font-family:"Math Charter",KaTeX_Main,serif}
.katex .mathnormal,.katex .boldsymbol{font-family:"Math Charter",KaTeX_Math,serif}
/* the three pens: colour AND line style */
.pen{padding:0 1px;border-radius:var(--radius-sm)}
.pen-red{background:var(--pen-red-soft);border-bottom:2px solid var(--pen-red)}
.pen-green{background:var(--pen-green-soft);border-bottom:4px double var(--pen-green)}
.pen-blue{background:var(--pen-blue-soft);border-bottom:2px dotted var(--pen-blue)}
.pen-hint{border-top:1px solid var(--text-soft)}
/* top bar */
.topbar{height:48px;display:flex;align-items:center;gap:28px;padding:0 48px;border-bottom:1px solid var(--rule);background:var(--surface);font-family:var(--font-ui);font-size:13px;line-height:16px}
.brand{font-weight:700}
.proj{display:flex;align-items:center;gap:8px;height:30px;margin-left:-8px;padding:0;background:none;border:0;font-family:var(--font-ui);font-size:13px;color:var(--text);cursor:pointer;white-space:nowrap}
.proj .mode{border:1px solid var(--rule-strong);border-radius:var(--radius-sm);padding:0 6px;font-size:12px;line-height:18px;color:var(--text-soft)}
.spaces{display:flex;gap:0;height:48px}
.spaces a{display:flex;align-items:center;padding:0 14px;color:var(--text-soft);text-decoration:none}
.spaces a[aria-current]{color:var(--text);font-weight:700;box-shadow:inset 0 -2px 0 var(--text)}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:20px}
.topbar-right a.quiet{color:var(--text-soft);text-decoration:none}
.palette{display:flex;align-items:center;gap:24px;height:30px;padding:0 10px 0 12px;background:var(--surface-1);border:1px solid var(--rule-strong);border-radius:var(--radius-md);color:var(--text-soft);font-family:var(--font-ui);font-size:13px;cursor:pointer}
.palette kbd{font-family:var(--font-ui);display:inline-flex;align-items:center;gap:2px;color:var(--text-soft)}
.you{background:none;border:0;color:var(--text-soft);font-family:var(--font-ui);font-size:13px;cursor:pointer}
/* buttons */
.btn{display:inline-flex;align-items:center;height:32px;padding:0 14px;border:1px solid var(--rule-strong);border-radius:var(--radius-md);background:transparent;color:var(--text);font-family:var(--font-ui);font-size:13px;line-height:16px;cursor:pointer}
.btn.primary{background:var(--text);border-color:var(--text);color:var(--surface);font-weight:700}
.btn[aria-pressed="true"]{background:var(--surface-3);border-color:var(--text-soft)}
.kind{font-family:var(--font-ui);font-size:13px;line-height:16px;font-weight:700;color:var(--text)}
.meta{font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-faint)}
/* leaders */
svg.leaders{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:5}
svg.leaders path{fill:none}
.ld-red{stroke:var(--pen-red);stroke-width:1.75}
.ld-green{stroke:var(--pen-green);stroke-width:5}
.ld-green-gap{stroke:var(--surface);stroke-width:2}
.ld-blue{stroke:var(--pen-blue);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:.1 5}
.ld-hint{stroke:var(--rule-strong);stroke-width:1.25}
.dot-red{fill:var(--pen-red)}.dot-green{fill:var(--pen-green)}.dot-blue{fill:var(--pen-blue)}.dot-hint{fill:var(--surface);stroke:var(--rule-strong);stroke-width:1.25}
/* pin cards: pinned marks, not chat bubbles */
.pin{position:absolute;left:0;width:100%;background:var(--surface-1);border:1px solid var(--rule);border-radius:var(--radius-md);padding:8px 12px 10px;font-size:15px;line-height:1.45}
.pin-head{display:flex;align-items:center;gap:10px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.pin-head::before{content:"";width:26px;height:0;flex:none}
.pin-head b{color:var(--text);font-weight:700}
.pin-red .pin-head::before{border-top:2px solid var(--pen-red)}
.pin-green .pin-head::before{border-top:4px double var(--pen-green)}
.pin-blue .pin-head::before{border-top:2px dotted var(--pen-blue)}
.pin-hint .pin-head::before{border-top:1px solid var(--text-soft)}
.pin-quote{margin:4px 0 1px;font-style:italic;color:var(--text)}
.pin-quote>span{padding:0 2px;border-radius:var(--radius-sm)}
.pin-red .pin-quote>span{background:var(--pen-red-soft);border-bottom:2px solid var(--pen-red)}
.pin-green .pin-quote>span{background:var(--pen-green-soft);border-bottom:4px double var(--pen-green)}
.pin-blue .pin-quote>span{background:var(--pen-blue-soft);border-bottom:2px dotted var(--pen-blue)}
.pin-hint .pin-quote>span{border-top:1px solid var(--text-soft);background:var(--surface-3)}
.pin p+p{margin-top:5px}
.pin .who{font-family:var(--font-ui);font-size:12px;color:var(--text-faint)}
`;

// shared JS: draws pen-styled leader lines and places margin cards by the words they pin
export const LEADERS_JS = `
(function(){
  var root=document.querySelector('[data-leaders]'); if(!root) return;
  var svg=root.querySelector('svg.leaders'), NS='http://www.w3.org/2000/svg';
  function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e;}
  function rounded(pts,r){
    var d='M'+pts[0][0]+' '+pts[0][1];
    for(var i=1;i<pts.length-1;i++){
      var a=pts[i-1],b=pts[i],c=pts[i+1];
      var l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),rr=Math.min(r,l1/2,l2/2);
      if(rr<0.5){d+=' L'+b[0]+' '+b[1];continue;}
      var p1=[b[0]-(b[0]-a[0])/l1*rr,b[1]-(b[1]-a[1])/l1*rr], p2=[b[0]+(c[0]-b[0])/l2*rr,b[1]+(c[1]-b[1])/l2*rr];
      d+=' L'+p1[0]+' '+p1[1]+' Q'+b[0]+' '+b[1]+' '+p2[0]+' '+p2[1];
    }
    var z=pts[pts.length-1]; return d+' L'+z[0]+' '+z[1];
  }
  function run(){
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    var rb=root.getBoundingClientRect(), k=(rb.width/root.offsetWidth)||1;
    function P(r){return {l:(r.left-rb.left)/k,r:(r.right-rb.left)/k,t:(r.top-rb.top)/k,b:(r.bottom-rb.top)/k};}
    svg.setAttribute('width',root.offsetWidth); svg.setAttribute('height',root.offsetHeight);
    var col=root.querySelector('[data-margin]'), colR=P(col.getBoundingClientRect());
    var edge=P(root.querySelector('[data-edge]').getBoundingClientRect()).r+10;
    var cards=[].slice.call(col.querySelectorAll('.pin')), cursor=0, drawn=[];
    cards.forEach(function(card){
      var tgt=card.dataset.target?document.getElementById(card.dataset.target):null;
      var dir=card.dataset.dir||'down', lane=parseFloat(card.dataset.lane||'5'), pen=card.dataset.pen||'hint';
      var info=null;
      if(tgt){var rs=tgt.getClientRects(), r=P(rs[rs.length-1]);
        var x0=r.r-4, y0=dir==='up'?r.t:r.b, yl=dir==='up'?r.t-lane:r.b+lane;
        info={x0:x0,y0:y0,yl:yl,pen:pen};}
      var top=Math.max(cursor, info?info.yl-colR.t-16:0);
      card.style.top=top+'px'; cursor=top+card.offsetHeight+10;
      if(info){info.card=card; drawn.push(info);}
    });
    drawn.forEach(function(info,i){
      var cr=P(info.card.getBoundingClientRect()), xc=cr.l, yc=cr.t+16;
      var xv=xc-14-i*8;
      var pts=[[info.x0,info.y0],[info.x0,info.yl],[xv,info.yl],[xv,yc],[xc,yc]];
      var d=rounded(pts,5);
      if(info.pen==='green'){svg.appendChild(el('path',{d:d,class:'ld-green'}));svg.appendChild(el('path',{d:d,class:'ld-green-gap'}));}
      else svg.appendChild(el('path',{d:d,class:'ld-'+info.pen}));
      svg.appendChild(el('circle',{cx:xc,cy:yc,r:3.5,class:'dot-'+info.pen}));
    });
    col.style.height=cursor+'px';
  }
  window.addEventListener('resize',run);
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){run();setTimeout(run,60);});
})();
`;

export function doc({ marker, title, css, body, js = '', theme = 'dark', dir = 'a' }) {
  return `<!-- ${marker} -->
<!doctype html>
<html lang="en" data-theme="${theme}" data-dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1440">
<title>${title}</title>
<style>${katexCss}</style>
<style>${BASE_CSS}${css}</style>
</head>
<body>
${body.replace('<div class="screen">', `<div class="screen" data-theme="${theme}" data-dir="${dir}">`)}
<script>${js}</script>
</body>
</html>
`;
}

// ---------- measured rule (used by direction B) ----------
export const RULER_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="rulerpat" width="40" height="9" patternUnits="userSpaceOnUse"><path class="rt" d="M.5 9V0M8.5 9V5M16.5 9V5M24.5 9V5M32.5 9V5"/></pattern></defs></svg>`;
export const RULER_SVG = `<svg class="ruler" width="100%" height="9" aria-hidden="true"><rect width="100%" height="9" fill="url(#rulerpat)"/></svg>`;

// ---------- TODAY ----------
export const TODAY_CSS = `
.today{position:absolute;left:0;right:0;top:48px;bottom:0;padding:0 56px;display:grid;grid-template-columns:1fr 372px;column-gap:88px}
.page-head{display:flex;align-items:baseline;gap:20px;padding:26px 0 18px}
.page-head h1{font-size:36px;line-height:1.15;font-weight:700}
.streaks{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.s-row{display:grid;grid-template-columns:repeat(4,1fr)}
.streak{padding:14px 18px 14px 0;font-family:var(--font-ui)}
.streak+.streak{border-left:1px solid var(--rule);padding-left:18px}
.s-label{font-size:13px;line-height:16px;color:var(--text-soft)}
.s-num{display:flex;align-items:baseline;gap:8px;margin:4px 0 2px}
.s-num b{font-size:44px;line-height:1;font-weight:700;color:var(--text)}
.s-num span{font-size:13px;color:var(--text-soft)}
.s-state{display:flex;align-items:center;gap:7px;font-size:12px;line-height:16px;color:var(--text)}
.box{display:inline-block;width:9px;height:9px;border:1.5px solid var(--text-soft)}
.box.on{background:var(--text);border-color:var(--text)}
.s-best{font-size:12px;line-height:16px;color:var(--text-faint);margin-top:2px;min-height:16px}
.week{display:flex;align-items:center;gap:12px;border-top:1px solid var(--rule);padding:9px 0;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.week .segs{display:flex;gap:3px}
.week .segs i{width:22px;height:8px;border:1.5px solid var(--text-soft)}
.week .segs i.on{background:var(--text);border-color:var(--text)}
.sec{margin-top:26px}
.sec-head{display:flex;align-items:baseline;gap:16px}
.sec h2{font-size:24px;line-height:1.3;font-weight:700;margin-top:6px}
.sec .desc{color:var(--text-soft);font-size:17px;line-height:1.5;margin-top:2px;max-width:640px}
.ex{margin-top:14px;border-top:1px solid var(--rule)}
.ex li{display:grid;grid-template-columns:28px 1fr auto;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--rule);font-size:18px;line-height:1.4}
.ex .n{font-family:var(--font-ui);font-size:13px;color:var(--text-faint)}
.ex .st{font-family:var(--font-ui);font-size:13px;line-height:16px;padding:0 3px;border-radius:var(--radius-sm)}
.st-pass{background:var(--pen-green-soft);border-bottom:4px double var(--pen-green)}
.st-miss{background:var(--pen-red-soft);border-bottom:2px solid var(--pen-red)}
.st-none{color:var(--text-faint)}
.st-prog{border:1px solid var(--rule-strong);color:var(--text)}
.ex li.none .t{color:var(--text-soft)}
.cont-body{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-top:8px;border-top:1px solid var(--rule);padding-top:12px}
.cont h3{font-size:20px;line-height:1.35;font-weight:700}
.cont .for{font-size:16px;line-height:1.5;color:var(--text-soft)}
.cont .draft{font-size:17px;line-height:1.5;font-style:italic;margin-top:6px;max-width:600px}
.cont .draft .katex{font-style:normal}
.margin{position:relative;padding-top:26px;min-height:0}
.mblock{margin-bottom:24px}
.mblock .kind{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--rule);padding-bottom:6px}
.mblock ul{margin-top:2px}
.mblock li{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;font-size:17px;line-height:1.35;border-bottom:1px solid var(--rule)}
.mblock li .meta{margin-left:12px;white-space:nowrap}
.pin.today-pin{position:relative;margin:0 0 24px}
.goal b{font-weight:400}
`;

export function today(opts = {}) {
  const R = (r) => (opts.refs ? `<span class="ref">${r}</span>` : '');
  const RULER = opts.ruler ? RULER_SVG : '';
  const body = `${opts.ruler ? RULER_DEFS : ''}<div class="screen">
${topbar('Today', opts.term)}
<main class="today" data-leaders>
  <svg class="leaders" aria-hidden="true"></svg>
  <div class="main-col" data-edge>
    <div class="page-head"><h1>Today</h1><span class="meta">Sun 4 Oct · DMFT of random networks</span></div>
    <section class="streaks" aria-label="Streaks">${RULER}
      <div class="s-row">
        <div class="streak">${R('A2')}<div class="s-label">All three</div><div class="s-num"><b>0</b><span>days</span></div><div class="s-state"><i class="box"></i>not yet today</div><div class="s-best">best 4</div></div>
        <div class="streak">${R('C2')}<div class="s-label">Recall</div><div class="s-num"><b>3</b><span>days</span></div><div class="s-state"><i class="box"></i>nothing due today</div><div class="s-best"></div></div>
        <div class="streak">${R('E2')}<div class="s-label">New learning</div><div class="s-num"><b>0</b><span>days</span></div><div class="s-state"><i class="box"></i>not yet today</div><div class="s-best">best 2</div></div>
        <div class="streak">${R('F2')}<div class="s-label">Problem solving</div><div class="s-num"><b>1</b><span>day</span></div><div class="s-state"><i class="box on"></i>done today</div><div class="s-best"></div></div>
      </div>
      <div class="week">This week <span class="segs" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span> 3 of 4 days <span>·</span> 1 reprieve banked</div>
    </section>

    <section class="sec">
      <div class="sec-head"><span class="kind">Set for you</span><span class="meta">2 of 3 answered · set 2 October by the teacher</span></div>
      <h2>Diagnostic 1</h2>
      <p class="desc">Probability prerequisites for the cavity method (Gaussian sums, variance scaling, CLT)</p>
      ${RULER}
      <ol class="ex">
        <li><span class="n">1</span><span class="t">Variance of a Gaussian-weighted sum, fixed inputs</span><span class="st st-pass">passed</span></li>
        <li><span class="n">2</span><span class="t">Variance of a Gaussian-weighted sum, random inputs</span><span class="st st-miss" id="m-missed">missed</span></li>
        <li><span class="n">3</span><span class="t">Why the recurrent input is Gaussian</span><span class="st st-prog">in progress</span></li>
      </ol>
    </section>

    <section class="sec cont${opts.dir === 'c' ? ' paper' : ''}">
      <div class="sec-head"><span class="kind">Continue where you left off</span></div>
      <div class="cont-body">
        <div>
          <h3>Why the recurrent input is Gaussian</h3>
          <p class="for">For: Explain DMFT of random networks from first principles</p>
          <p class="draft">Each term ${T.Jj_yj} has mean ${T.zero} and variance ${T.varTerm}, and the terms are independent. So by the central limit theorem …</p>
        </div>
        <div style="text-align:right"><button class="btn primary" type="button">${opts.term ? '<span class="key">c</span>' : ''}Continue writing</button><div class="meta" style="margin-top:8px">Draft saved · 2 of 3 hints used</div></div>
      </div>
    </section>
  </div>

  <aside class="margin" data-margin>
    <div class="mblock"><div class="kind"><span>Reviews due</span><span class="meta">2</span></div>
      <ul><li><a href="#">Gaussian fields</a></li><li><a href="#">Central limit theorem</a></li></ul></div>
    <div class="mblock"><div class="kind"><span>Changed since you looked</span><span class="meta">2 notes</span></div>
      <ul><li><a href="#">The cavity method</a><span class="meta">2 commits</span></li><li><a href="#">Self-consistent autocorrelation</a></li></ul></div>
    <aside class="pin pin-red today-pin" data-target="m-missed" data-dir="right" data-pen="red" id="pin-next">
      <div class="pin-head"><b>The teacher’s next step</b></div>
      <div class="pin-quote"><span>missed</span></div>
      <p>Fill the gap at <a href="#">variance scaling</a> before the cavity method: one note, then exercise 2 again.</p>
    </aside>
    <div class="mblock goal"><div class="kind"><span>Goals</span></div>
      <ul>
        <li><span>Explain DMFT of random networks from first principles</span><span class="meta">1 of 3</span></li>
        <li><span>Solve problems with DMFT</span><span class="meta">none yet</span></li>
        <li><span>Understand Clark &amp; Abbott, coupled neuronal-synaptic dynamics</span><span class="meta">arXiv:2302.08985</span></li>
      </ul></div>
  </aside>
</main>
${opts.extraBody || ''}
</div>`;
  return body;
}

// Today's pin is in normal flow: push it down so it sits level with the row it is about.
export const TODAY_JS = `
(function(){
  function place(){
    var pin=document.getElementById('pin-next'), tgt=document.getElementById('m-missed'), col=pin.parentNode;
    pin.style.marginTop='0px';
    var t=tgt.getBoundingClientRect(), p=pin.getBoundingClientRect(), root=document.querySelector('[data-leaders]'), k=(root.getBoundingClientRect().width/root.offsetWidth)||1;
    var delta=((t.top+t.bottom)/2-17*k)-p.top; pin.style.marginTop=Math.max(0,delta/k)+'px';
  }
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(place);
  window.addEventListener('resize',place);
})();
`;

// Today uses a simpler leader: the pin is in flow, so we only draw the line.
export const TODAY_LEADER_JS = `
(function(){
  var root=document.querySelector('[data-leaders]'), svg=root.querySelector('svg.leaders'), NS='http://www.w3.org/2000/svg';
  function draw(){
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    var rb=root.getBoundingClientRect(), k=(rb.width/root.offsetWidth)||1;
    svg.setAttribute('width',root.offsetWidth); svg.setAttribute('height',root.offsetHeight);
    var t=document.getElementById('m-missed').getBoundingClientRect(), p=document.getElementById('pin-next').getBoundingClientRect();
    var y=((t.top+t.bottom)/2-rb.top)/k, x0=(t.right-rb.left)/k+6, x1=(p.left-rb.left)/k, yc=(p.top-rb.top)/k+17;
    var d=document.createElementNS(NS,'path'); d.setAttribute('d','M'+x0+' '+y+' H'+(x1-40)+' L'+x1+' '+yc); d.setAttribute('class','ld-red'); svg.appendChild(d);
    var c=document.createElementNS(NS,'circle'); c.setAttribute('cx',x1); c.setAttribute('cy',yc); c.setAttribute('r',3.5); c.setAttribute('class','dot-red'); svg.appendChild(c);
  }
  function go(){ draw(); setTimeout(draw,60); }
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(go);
  window.addEventListener('resize',draw);
})();
`;

export function todayDoc(opts = {}) {
  return doc({
    marker: `@dsCard group="${opts.group || GROUP_A}" width=1440 height=900 subtitle="${opts.subtitle || "Today, desktop, dark. The teacher's next step is pinned to the row it is about."}"`,
    title: opts.title || 'Marginalia, Today',
    css: TODAY_CSS + (opts.css || ''),
    body: today(opts),
    js: TODAY_JS + TODAY_LEADER_JS,
    theme: opts.theme || 'dark',
    dir: opts.dir || 'a',
  });
}

// ---------- WORKBENCH ----------
const BENCH_CSS = `
.crumb{height:40px;display:flex;align-items:center;padding:0 48px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft);gap:10px}
.crumb b{font-weight:700;color:var(--text)}
.bench{position:absolute;left:0;right:0;top:88px;bottom:0;padding:0 40px 0 48px;display:grid;grid-template-columns:330px 580px 340px;grid-template-rows:minmax(0,1fr)}
.problem{padding:6px 40px 0 0;border-right:1px solid var(--rule);margin-right:40px;margin-bottom:24px}
.problem h1{font-size:24px;line-height:1.3;font-weight:700}
.problem .for{font-size:15px;line-height:1.5;color:var(--text-soft);margin-top:6px}
.problem .prob{font-size:17px;line-height:1.6;margin-top:14px}
.problem .prob p+p,.problem .prob p+ol,.problem .prob ol+p{margin-top:10px}
.problem .prob .eq{margin:2px 0}
.problem .prob .eq .katex-display{margin:6px 0}
.problem ol{counter-reset:q}
.problem ol li{counter-increment:q;position:relative;padding-left:26px}
.problem ol li+li{margin-top:8px}
.problem ol li::before{content:counter(q);position:absolute;left:0;font-family:var(--font-ui);font-size:14px;color:var(--text-soft)}
.answer{margin-right:64px;padding-top:2px}
.a-tools{display:flex;align-items:center;gap:8px;height:40px}
.a-tools .sp{margin-left:auto}
.editor{position:relative;margin-top:14px;font-size:18px;line-height:2.05;min-height:260px}
.editor p{margin:0}
.caret{display:inline-block;width:2px;height:22px;background:var(--text);vertical-align:-5px;margin-left:1px}
.a-note{margin-top:8px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-faint)}
.a-foot{position:absolute;left:0;right:0;bottom:24px;display:flex;align-items:center;gap:14px;white-space:nowrap;border-top:1px solid var(--rule);padding-top:14px;font-family:var(--font-ui);font-size:13px;line-height:16px;color:var(--text-soft)}
.a-foot .sp{margin-left:auto}.a-foot .btn{padding:0 12px}
.a-foot .saved{display:flex;align-items:center;gap:7px}
.a-foot .textbtn{background:none;border:0;padding:0;color:var(--text-soft);font-family:var(--font-ui);font-size:13px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--rule-strong);cursor:pointer}
.answer{position:relative}
.m-head{display:flex;align-items:baseline;justify-content:space-between;height:40px;padding-top:12px;border-bottom:1px solid var(--rule);font-family:var(--font-ui);font-size:13px;line-height:16px}
.m-head span{font-size:12px;color:var(--text-faint)}
.margin-col{position:relative}
.margin-col [data-margin]{position:relative;margin-top:14px}
.reply{margin-top:10px;display:flex;gap:8px}
.reply .field{flex:1;height:32px;border:1px solid var(--rule-strong);border-radius:var(--radius-md);background:var(--surface);color:var(--text-faint);display:flex;align-items:center;padding:0 10px;font-family:var(--font-ui);font-size:12px}
`;

export function workbench(opts = {}) {
  const jy = T.Jj_yj;
  const k = (c) => (opts.term ? `<span class="key">${c}</span>` : '');
  return `<div class="screen">
${topbar('Practice', opts.term)}
<div class="crumb"><span>Practice</span><span>/</span><span>Diagnostic 1</span><span>/</span><b>3 Why the recurrent input is Gaussian</b></div>
<main class="bench" data-leaders>
  <svg class="leaders" aria-hidden="true"></svg>

  <section class="problem${opts.dir === 'c' ? ' paper' : ''}" aria-label="Problem">
    <h1>Why the recurrent input is Gaussian</h1>
    <p class="for">For: <a href="#">Explain DMFT of random networks from first principles</a>. Tests: <a href="#">Gaussian fields</a>.</p>
    <div class="prob">
      <p>Let ${T.J1JN} be iid, each equal to ${T.pm} or ${T.mm} with probability ${T.half} (so they are not Gaussian). Let ${T.y1yN} be iid random numbers with mean ${T.meanZero} and ${T.Ey2}, independent of the ${T.Jj}, and let</p>
      <div class="eq">${T.eq}</div>
      <ol>
        <li>As ${T.Nsym} becomes large, what can you say about the distribution of ${T.hsym}, and why?</li>
        <li>Now suppose the weights were ${T.pmg} instead of ${T.pmgN}. How would the typical size of ${T.hsym} depend on ${T.Nsym}?</li>
      </ol>
      <p>Answer in a few sentences, with whatever working you need.</p>
    </div>
  </section>

  <section class="answer${opts.dir === 'c' ? ' paper' : ''}" aria-label="Your answer">
    <div class="a-tools" role="toolbar" aria-label="Ask the teacher">
      <button class="btn" type="button">${k('h')}Hint (2 of 3)${opts.segs ? '<span class="segs3" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i></span>' : ''}</button>
      <button class="btn" type="button" aria-pressed="true">${k('f')}Feedback</button>
      <button class="btn" type="button">${k('d')}Discuss</button>
    </div>
    ${opts.ruler ? RULER_SVG : ''}
    <div class="editor" id="editor" data-edge>
      <p>Each term ${jy} has mean ${T.zero} and variance ${T.varTerm},<br>and <span id="t-indep" class="pen pen-hint"><span class="pen pen-green" style="padding:0">the terms are independent</span></span>.<br>So <span id="t-clt" class="pen pen-green">by the central limit theorem</span> ${T.h} is<br><span id="t-approx" class="pen pen-blue">approximately Gaussian</span>, with <span id="t-var" class="pen pen-red">${T.varh}</span>.</p>
      <p><span class="caret"></span></p>
    </div>
    <p class="a-note">Maths is typeset everywhere except the line you are writing.</p>
    <div class="a-foot">
      <span class="saved"><i class="box on" style="width:8px;height:8px"></i>Draft saved</span>
      <button class="textbtn" type="button">Versions</button>
      <span class="sp"></span>
      <button class="btn" type="button">${k('m')}Mark it yourself</button>
      <button class="btn primary" type="button">${k('a')}Ask an agent to mark it</button>
    </div>
  </section>

  <section class="margin-col" aria-label="The teacher">
    <div class="m-head"><b>The teacher</b><span>you said you were fairly sure</span></div>
    <div data-margin>
      <aside class="pin pin-hint" data-pen="hint"><div class="pin-head"><b>Hint 1 of 3</b></div><p>Independence.</p></aside>
      <aside class="pin pin-hint" data-pen="hint" data-target="t-indep" data-dir="up" data-lane="6"><div class="pin-head"><b>Hint 2 of 3</b></div><div class="pin-quote"><span>the terms are independent</span></div><p>Think about why the cross terms vanish.</p></aside>
      <aside class="pin pin-green" data-pen="green" data-target="t-indep" data-dir="down" data-lane="5"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>the terms are independent</span></div><p>Right, and it is why the variances add.</p></aside>
      <aside class="pin pin-green" data-pen="green" data-target="t-clt" data-dir="down" data-lane="4"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>by the central limit theorem</span></div><p>The right tool, and named.</p></aside>
      <aside class="pin pin-blue" data-pen="blue" data-target="t-approx" data-dir="up" data-lane="4"><div class="pin-head"><b>Discussion</b></div><div class="pin-quote"><span>approximately Gaussian</span></div>
        <p><span class="who">You asked</span><br>Is it exactly Gaussian for finite ${T.N}?</p>
        <p><span class="who">The teacher asked back</span><br>What would ${T.hDist}’s distribution be for ${T.N1}?</p>
        <div class="reply"><div class="field">Reply</div></div></aside>
      <aside class="pin pin-red" data-pen="red" data-target="t-var" data-dir="down" data-lane="5"><div class="pin-head"><b>Feedback</b></div><div class="pin-quote"><span>${T.varh}</span></div><p>The ${T.invN} in each weight’s variance has gone missing; add up ${T.N} terms of ${T.varTermB} again.</p></aside>
    </div>
  </section>
</main>
${opts.extraBody || ''}
</div>`;
}

export function workbenchDoc({ theme = 'dark', ...opts } = {}) {
  const light = theme === 'light';
  return doc({
    marker: `@dsCard group="${opts.group || GROUP_A}" width=1440 height=900 subtitle="${opts.subtitle || `The exercise workbench, ${light ? 'light' : 'dark'}. Problem, answer, and the teacher's pins joined to the words they are about.`}"`,
    title: opts.title || `Marginalia, workbench (${theme})`,
    css: BENCH_CSS + (opts.css || ''),
    body: (opts.defs || '') + workbench(opts),
    js: LEADERS_JS,
    theme,
    dir: opts.dir || 'a',
  });
}
