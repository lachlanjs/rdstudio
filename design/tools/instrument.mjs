import { todayDoc, workbenchDoc, RULER_DEFS } from './marginalia.mjs';

export const GROUP_C = 'C · Instrument';

export const C_CSS = `
[data-dir="c"]{--surface:var(--instrument-surface);--surface-1:var(--instrument-panel);--surface-2:var(--instrument-panel-2);--surface-3:#232c35;--rule:var(--instrument-bezel);--rule-strong:var(--instrument-bezel-strong);--text:var(--instrument-text);--text-soft:var(--instrument-text-soft);--text-faint:var(--instrument-text-faint);--radius-md:2px;--radius-sm:1px}
[data-theme="light"][data-dir="c"]{--surface-3:#dde2e8}
/* the reading surface: warm, the only warm thing */
[data-dir="c"] .paper{background:var(--instrument-paper);--surface:var(--instrument-paper);--surface-1:var(--instrument-paper);--text:var(--instrument-ink);--text-soft:var(--instrument-ink-soft);--text-faint:var(--instrument-ink-faint);--rule:#3a362f;color:var(--text)}
[data-dir="c"] .topbar{background:var(--surface-1);border-bottom:1px solid var(--rule-strong)}
[data-dir="c"] .spaces a[aria-current]{box-shadow:inset 0 -3px 0 var(--text)}
[data-dir="c"] .palette{background:var(--surface);border-radius:2px}
.panel{background:var(--surface-1);border:1px solid var(--rule)}
.px{font-family:var(--font-pixel);font-weight:400;letter-spacing:0}
svg.ruler{display:block}
.rt{stroke:var(--rule-strong);stroke-width:1;fill:none}
/* segment readouts */
.segs3{display:inline-flex;gap:2px;margin-left:10px}
.segs3 i{width:8px;height:10px;border:1px solid var(--text-soft);display:inline-block}
.segs3 i.on{background:var(--text);border-color:var(--text)}
.btn .segs3{vertical-align:-1px}
/* TODAY as a rack of panels */
[data-dir="c"] .today{top:48px;padding:12px 16px 16px;column-gap:4px;grid-template-columns:1fr 396px}
[data-dir="c"] .main-col{display:flex;flex-direction:column;gap:4px}
[data-dir="c"] .page-head{padding:2px 4px 6px;gap:16px}
[data-dir="c"] .page-head h1{font-size:30px}
[data-dir="c"] .streaks{border:0;display:flex;flex-direction:column;gap:4px}
[data-dir="c"] .s-row{gap:4px}
[data-dir="c"] .streak{background:var(--surface-1);border:1px solid var(--rule);padding:10px 14px 12px}
[data-dir="c"] .streak+.streak{border-left:1px solid var(--rule);padding-left:14px}
[data-dir="c"] .s-num{margin:10px 0 8px}
[data-dir="c"] .s-num b{font-family:var(--font-pixel);font-weight:400;font-size:64px;line-height:1}
[data-dir="c"] .s-label{color:var(--text)}
[data-dir="c"] .box{width:10px;height:10px;border:1px solid var(--text-soft);outline:0;background:var(--surface)}
[data-dir="c"] .box.on{background:var(--text);border-color:var(--text);outline:1px solid var(--rule-strong);outline-offset:2px}
[data-dir="c"] .week{background:var(--surface-1);border:1px solid var(--rule);padding:10px 14px;gap:14px}
[data-dir="c"] .week .segs{gap:4px}
[data-dir="c"] .week .segs i{width:56px;height:14px;border:1px solid var(--text-soft)}
[data-dir="c"] .week .segs i.on{background:var(--text);border-color:var(--text)}
[data-dir="c"] .sec{margin:0;background:var(--surface-1);border:1px solid var(--rule);padding:12px 16px 14px}
[data-dir="c"] .sec h2{margin-top:4px;font-size:22px}
[data-dir="c"] .ex{border-top:0;margin-top:10px}
[data-dir="c"] .ex li{background:transparent}
[data-dir="c"] .sec.cont{padding:12px 16px 14px}
[data-dir="c"] .cont-body{border-top:1px solid var(--rule)}
[data-dir="c"] .margin{padding-top:0;display:flex;flex-direction:column;gap:4px}
[data-dir="c"] .mblock{margin:0;background:var(--surface-1);border:1px solid var(--rule);padding:10px 14px 6px}
[data-dir="c"] .pin.today-pin{margin:0;background:var(--surface-2);border-color:var(--rule-strong)}
[data-dir="c"] .goal li{font-size:16px}
/* WORKBENCH as three tight panels */
[data-dir="c"] .crumb{height:36px;padding:0 16px}
[data-dir="c"] .bench{top:84px;padding:0 16px 16px;grid-template-columns:360px 684px 1fr;column-gap:4px}
[data-dir="c"] .problem{margin:0;padding:12px 18px 0;border:1px solid var(--rule)}
[data-dir="c"] .answer{margin:0;padding:10px 18px 0 22px;border:1px solid var(--rule);padding-right:84px}
[data-dir="c"] .margin-col{background:var(--surface-1);border:1px solid var(--rule);padding:0 12px}
[data-dir="c"] .m-head{border-bottom:1px solid var(--rule)}
[data-dir="c"] .a-foot{left:22px;right:18px;border-top:1px solid var(--rule)}
[data-dir="c"] .a-tools{border-bottom:0}
[data-dir="c"] .editor{margin-top:6px}
[data-dir="c"] .pin{background:var(--surface-2);border-radius:2px}
[data-dir="c"] .pin-head b{font-weight:700}
.ld-green-gap{stroke:var(--instrument-paper)}
[data-dir="c"] .problem .prob .eq .katex-display{margin:4px 0}
`;

export function instrumentDocs() {
  return {
    InstrumentToday: todayDoc({ dir: 'c', ruler: true, css: C_CSS, group: GROUP_C, title: 'Instrument, Today', subtitle: 'Today, desktop, dark. Pixel readouts, lamps, a rack of panels; the draft sits on the warm reading surface.' }),
    InstrumentWorkbench: workbenchDoc({ dir: 'c', segs: true, ruler: true, defs: RULER_DEFS, css: C_CSS, group: GROUP_C, title: 'Instrument, workbench', subtitle: 'The exercise workbench, dark. Problem and answer on the warm reading surface; the teacher as a cool panel of readouts.' }),
  };
}
