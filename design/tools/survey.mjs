import { todayDoc, workbenchDoc, topbar, doc, RULER_DEFS } from './marginalia.mjs';
import { buildAtlas, atlasSvg } from './atlas.mjs';

export const GROUP_B = 'B · Survey';
export const GROUP_AB = 'A + B · Marginalia with the Survey Atlas';

const MAP = 'font-family:var(--font-map);font-variation-settings:"wdth" 84;letter-spacing:0';

export const B_CSS = `
[data-dir="b"]{--surface:var(--survey-surface);--surface-1:var(--survey-surface-1);--surface-2:var(--survey-surface-2);--surface-3:var(--survey-surface-3);--rule:var(--survey-rule);--rule-strong:var(--survey-rule-strong);--text:var(--survey-text);--text-soft:var(--survey-text-soft);--text-faint:var(--survey-text-faint)}
[data-dir="b"] .topbar,[data-dir="b"] .proj,[data-dir="b"] .kind,[data-dir="b"] .meta,[data-dir="b"] .btn,[data-dir="b"] .pin-head,[data-dir="b"] .pin .who,[data-dir="b"] .s-label,[data-dir="b"] .s-state,[data-dir="b"] .s-best,[data-dir="b"] .s-num span,[data-dir="b"] .week,[data-dir="b"] .ex .n,[data-dir="b"] .ex .st,[data-dir="b"] .crumb,[data-dir="b"] .a-foot,[data-dir="b"] .a-foot .textbtn,[data-dir="b"] .a-note,[data-dir="b"] .m-head,[data-dir="b"] .palette,[data-dir="b"] .palette kbd,[data-dir="b"] .you,[data-dir="b"] .reply .field,[data-dir="b"] .problem ol li::before{${MAP}}
[data-dir="b"] .topbar,[data-dir="b"] .proj,[data-dir="b"] .btn,[data-dir="b"] .palette,[data-dir="b"] .a-foot,[data-dir="b"] .a-foot .textbtn,[data-dir="b"] .you{font-size:12px}
[data-dir="b"] .s-num b{font-family:var(--font-map);font-weight:300;font-variation-settings:"wdth" 75;font-size:54px;letter-spacing:-1px}
[data-dir="b"] .streaks{border-top:0}
[data-dir="b"] .ex{border-top:0}
[data-dir="b"] .streak{position:relative}
.ref{position:absolute;right:14px;top:13px;font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;line-height:14px;color:var(--text-faint)}
svg.ruler{display:block;color:var(--rule-strong)}
.rt{stroke:var(--rule-strong);stroke-width:1;fill:none}
svg.sheet{position:absolute;left:0;top:0;pointer-events:none}
svg.sheet .tk{stroke:var(--rule-strong);stroke-width:1;fill:none}
svg.sheet text{font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;fill:var(--text-faint)}
[data-dir="b"] .a-foot .btn{padding:0 10px}
.cont-body .meta{white-space:nowrap}
`;

// graticule ticks along the left and top edges of the page, as on a survey sheet
export function sheetFrame() {
  const t = [], lab = [];
  for (let i = 0; i <= 12; i++) t.push(`M${i * 120} 48v6`);
  for (let j = 0; j <= 7; j++) t.push(`M0 ${j * 122 || 48}h6`);
  for (let i = 0; i < 12; i++) lab.push(`<text x="${i * 120 + 60}" y="66" text-anchor="middle">${'ABCDEFGHIJKL'[i]}</text>`);
  for (let j = 1; j < 7; j++) lab.push(`<text x="14" y="${j * 122 + 61}" text-anchor="middle">${j + 1}</text>`);
  lab.push(`<text x="14" y="${122 * 0 + 61}" text-anchor="middle"></text>`);
  return `<svg class="sheet" width="1440" height="900" viewBox="0 0 1440 900" aria-hidden="true"><path class="tk" d="${t.join('')}"/>${lab.join('')}</svg>`;
}

// ---------- the Atlas page (B chrome, or A chrome when dir = 'a') ----------
export const ATLAS_CSS = `
.atlas-wrap{position:absolute;left:0;right:0;top:48px;bottom:0;background:var(--surface);overflow:hidden}
svg.atlas{position:absolute;left:0;top:0;display:block}
.a-sea{fill:var(--surface)}
.a-grat{stroke:var(--survey-grid);stroke-width:1;fill:none}
.a-land{fill:var(--surface-1)}
.a-tint{fill:var(--text)}
.a-tint.t1{fill-opacity:.05}.a-tint.t2{fill-opacity:.05}.a-tint.t3{fill-opacity:.06}
.a-route{stroke:var(--rule-strong);stroke-width:1;fill:none;opacity:.75}
.a-fog{fill:var(--surface);fill-opacity:.58}
.a-fogdots{fill:url(#fogdots)}
.fogdot{fill:var(--text-soft);opacity:.5}
.a-contour{fill:none;stroke:var(--text-soft);stroke-width:1}
.a-contour.c1{opacity:.5}.a-contour.c2{opacity:.7}.a-contour.c3{opacity:.95;stroke-width:1.5}
.a-front{fill:none;stroke:var(--text);stroke-width:1.5}
.a-hach{stroke:var(--text);stroke-width:1.25;fill:none}
.a-outline{fill:none;stroke:var(--rule-strong);stroke-width:1;stroke-dasharray:7 5}
.a-path-halo{fill:none;stroke:var(--surface);stroke-width:8;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.a-path{fill:none;stroke:var(--pen-blue);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:.1 7.5}
.stop-ring{fill:none;stroke:var(--pen-blue);stroke-width:1.75;stroke-dasharray:.1 4.6;stroke-linecap:round}
.a-stopno{font-family:var(--font-map);font-variation-settings:"wdth" 84;font-weight:700;font-size:12px;fill:var(--text);paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}
.m-none{fill:var(--surface);stroke:var(--text-faint);stroke-width:1.25}
.m-open{fill:var(--surface);stroke:var(--text);stroke-width:1.75}
.m-fill{fill:var(--text);stroke:none}
.ring-red{fill:none;stroke:var(--pen-red);stroke-width:2.2}
.ring-plain{fill:none;stroke:var(--text);stroke-width:1.5}
.ring-green-out,.ring-green-in{fill:none;stroke:var(--pen-green);stroke-width:1.6}
.a-label{font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;fill:var(--text);paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}
.a-label.dim{fill:var(--text-faint)}
.a-ref{fill:var(--text-faint)}
.a-folder{font-family:var(--font-map);font-variation-settings:"wdth" 90;font-weight:600;font-size:12px;fill:var(--text-soft);paint-order:stroke;stroke:var(--surface);stroke-width:5px;stroke-linejoin:round}
.a-count{fill:var(--text-faint);font-weight:400}
.a-edge{font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;fill:var(--text-faint)}
.a-tick{stroke:var(--rule-strong);stroke-width:1}
.lens{position:absolute;left:16px;top:16px;width:276px;background:var(--surface-1);border:1px solid var(--rule);border-radius:var(--radius-md);padding:12px 14px 14px;font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft)}
.lens h2{font-size:13px;line-height:16px;font-weight:700;color:var(--text);margin:0 0 8px}
.lens .chips{display:flex;flex-wrap:wrap;gap:6px}
.lens .btn{height:28px;padding:0 10px;font-size:12px}
.lens .legend{margin-top:14px;border-top:1px solid var(--rule);padding-top:10px}
.lens .legend li{display:flex;align-items:center;gap:10px;min-height:24px;padding:1px 0}
.lens .legend svg{flex:none;overflow:visible}
.lens .note{margin-top:8px;color:var(--text-faint)}
.north{position:absolute;right:44px;bottom:92px;display:flex;flex-direction:column;align-items:center;gap:6px;font-family:var(--font-map);font-variation-settings:"wdth" 84;font-size:11px;line-height:14px;color:var(--text-soft);text-align:center;width:120px}
.north svg{display:block}
.hint{position:absolute;left:16px;bottom:14px;font-family:var(--font-ui);font-size:12px;color:var(--text-faint);background:var(--surface);padding:2px 6px}
.fabs{position:absolute;right:16px;bottom:14px;display:flex;gap:8px}
.fabs .btn{background:var(--surface-1)}
`;

const legendIcon = {
  understood: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="9.5" class="ring-green-out"/><circle r="7" class="ring-green-in"/><circle r="3.5" class="m-fill"/></svg>`,
  worked: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="5" class="m-fill"/></svg>`,
  opened: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="4.5" class="m-open"/></svg>`,
  none: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="3.2" class="m-none"/></svg>`,
  needs: `<svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="9" class="ring-red"/><circle r="4.5" class="m-open"/></svg>`,
  frontier: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 12H20" class="a-front"/><path d="M4 12v-6M8 12v-3M12 12v-6M16 12v-3M20 12v-6" class="a-hach"/></svg>`,
  path: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 11H20" class="a-path"/></svg>`,
  contour: `<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 6H20M2 11H20M2 16H20" class="a-contour c2"/></svg>`,
};

export function atlasBody({ dir }) {
  const a = buildAtlas();
  const svg = atlasSvg(a, { graticule: dir === 'b', labelRefs: true });
  const north = `<div class="north"><svg width="28" height="56" viewBox="0 0 28 56" aria-hidden="true"><path d="M14 54V8" stroke="var(--text-soft)" stroke-width="1.5" fill="none"/><path d="M14 2L21 17H14Z" fill="var(--text-soft)"/><path d="M14 2L7 17H14Z" fill="none" stroke="var(--text-soft)" stroke-width="1.25"/></svg><span>N · later in the study order</span></div>`;
  const lens = `<aside class="lens" aria-label="Lenses">
    <h2>Lenses</h2>
    <div class="chips"><button class="btn" type="button">Links</button><button class="btn" type="button" aria-pressed="true">Understanding</button><button class="btn" type="button" aria-pressed="true">Study path</button><button class="btn" type="button">Tour</button><button class="btn" type="button">Goal</button></div>
    <ul class="legend" style="list-style:none;margin:14px 0 0;padding:10px 0 0;border-top:1px solid var(--rule)">
      <li>${legendIcon.understood}<span>Understood</span></li>
      <li>${legendIcon.worked}<span>Worked through</span></li>
      <li>${legendIcon.opened}<span>Opened</span></li>
      <li>${legendIcon.none}<span>Not reached, in fog</span></li>
      <li>${legendIcon.needs}<span>The teacher says: needs work</span></li>
      <li>${legendIcon.contour}<span>One line = one step of understanding</span></li>
      <li>${legendIcon.frontier}<span>Frontier: hachures face the fog</span></li>
      <li>${legendIcon.path}<span>Study path to The cavity method</span></li>
    </ul>
  </aside>`;
  return `<div class="screen">
${topbar('Atlas')}
<div class="atlas-wrap">
${svg}
${lens}
${north}
<div class="hint">Click a note to open it, a region to zoom in, empty space to step out.</div>
<div class="fabs"><button class="btn" type="button">New note</button><button class="btn" type="button">New folder</button></div>
</div>
</div>`;
}

export function atlasDoc({ dir = 'b', group = GROUP_B, title = 'Survey, Atlas', subtitle } = {}) {
  return doc({
    marker: `@dsCard group="${group}" width=1440 height=900 subtitle="${subtitle || 'The Atlas, dark: understanding lens on, frontier hachured, a study path. Placeholder folders and notes.'}"`,
    title,
    css: (dir === 'b' ? B_CSS : '') + ATLAS_CSS,
    body: atlasBody({ dir }),
    js: '',
    dir,
  });
}

export function abDocs() {
  return {
    MarginaliaAtlas: atlasDoc({ dir: 'a', group: GROUP_AB, title: 'Marginalia, Atlas with Survey contours', subtitle: 'The Atlas in Marginalia chrome: Survey contours, hachures, grid references and north arrow, used only here. Placeholder folders and notes.' }),
  };
}

export function surveyDocs() {
  return {
    SurveyToday: todayDoc({ dir: 'b', refs: true, ruler: true, css: B_CSS, group: GROUP_B, title: 'Survey, Today', subtitle: 'Today, desktop, dark. Grid references beside the streak counters, measured rules.', extraBody: sheetFrame() }),
    SurveyWorkbench: workbenchDoc({ dir: 'b', ruler: true, css: B_CSS, defs: RULER_DEFS, group: GROUP_B, title: 'Survey, workbench', subtitle: 'The exercise workbench, dark, on a survey sheet. Same pins, Martian Mono labels.' }),
    SurveyAtlas: atlasDoc({ dir: 'b' }),
  };
}
