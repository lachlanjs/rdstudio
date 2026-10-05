// Station terminal option, for fun: the screens as a late-1970s film computer, the look that certain survival games revive.
// Cold white phosphor on blue-black, pixel and mono type with upper-case labels, reversed header bars, thin cyan frames with
// connector lines, segmented counters, a dotted-leader key legend, a gridded map, scan lines. No glow (the brief rules out blur).
// Built on the terminal lean. The three pens keep their colours and line styles.
import { todayDoc, workbenchDoc } from './marginalia.mjs';
import { T_CSS, status } from './terminal.mjs';
import { reskinAtlas } from './retro.mjs';

export const GROUP_S = 'Option · station terminal (for fun)';

export const S_CSS = T_CSS.replaceAll('[data-dir="t"]', '[data-dir="x"]') + `
[data-dir="x"]{--surface:var(--station-surface);--surface-1:var(--station-surface-1);--surface-2:var(--station-surface-2);--surface-3:var(--station-surface-3);--rule:var(--station-rule);--rule-strong:var(--station-rule-strong);--text:var(--station-text);--text-soft:var(--station-text-soft);--text-faint:var(--station-text-faint);--line:var(--station-line);--radius-sm:0px;--radius-md:0px;--radius-lg:0px}
/* everything is upper case mono; maths keeps its own letters */
[data-dir="x"].screen{font-family:var(--font-ui);letter-spacing:.01em}
[data-dir="x"] .katex{letter-spacing:0}
[data-dir="x"].screen::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:20;background:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,var(--station-surface) 2px,var(--station-surface) 3px);opacity:.3}
[data-dir="x"] h1,[data-dir="x"] h2,[data-dir="x"] h3,[data-dir="x"] .brand,[data-dir="x"] .kind,[data-dir="x"] .s-num b,[data-dir="x"] .pin-head b,[data-dir="x"] .status b,[data-dir="x"] .m-head b,[data-dir="x"] .lens h2,[data-dir="x"] .problem::before,[data-dir="x"] .answer::before,[data-dir="x"] .streaks::before,[data-dir="x"] .btn,[data-dir="x"] .spaces a,[data-dir="x"] .proj .mode{font-family:var(--font-pixel);font-weight:400;letter-spacing:0}
[data-dir="x"] .kind,[data-dir="x"] .pin-head b,[data-dir="x"] .m-head b,[data-dir="x"] .lens h2,[data-dir="x"] .problem::before,[data-dir="x"] .answer::before,[data-dir="x"] .streaks::before,[data-dir="x"] .btn,[data-dir="x"] .spaces a,[data-dir="x"] .proj .mode{font-size:11px}
[data-dir="x"] .page-head h1{font-size:22px}
[data-dir="x"] .sec h2{font-size:22px;line-height:28px}
[data-dir="x"] .cont h3,[data-dir="x"] .problem h1{font-size:16px;line-height:24px}
/* reading sizes come down, since upper-case mono runs wide */
[data-dir="x"] .ex li,[data-dir="x"] .mblock li,[data-dir="x"] .sec .desc,[data-dir="x"] .cont .for,[data-dir="x"] .cont .draft,[data-dir="x"] .problem .prob,[data-dir="x"] .problem .for,[data-dir="x"] .pin{font-size:13px;line-height:1.55}
[data-dir="x"] .cont .draft,[data-dir="x"] .pin-quote{font-style:normal}
[data-dir="x"] .editor{font-size:14px;line-height:2.5}
[data-dir="x"] .s-num b{font-size:55px}
/* upper case only for the short labels: title bars, buttons, tabs, the key legend */
[data-dir="x"] .kind,[data-dir="x"] .pin-head b,[data-dir="x"] .m-head b,[data-dir="x"] .lens h2,[data-dir="x"] .problem::before,[data-dir="x"] .answer::before,[data-dir="x"] .streaks::before,[data-dir="x"] .btn,[data-dir="x"] .spaces a,[data-dir="x"] .proj .mode,[data-dir="x"] .status,[data-dir="x"] .brand{text-transform:uppercase}
/* rows are numbered like log entries */
[data-dir="x"] .ex .n::before{content:"00"}
[data-dir="x"] .ex li{grid-template-columns:44px 1fr auto}
[data-dir="x"] .problem ol li::before{content:counter(q, decimal-leading-zero)}
/* thin cyan frames; titles are reversed bars */
[data-dir="x"] .streaks,[data-dir="x"] .sec,[data-dir="x"] .mblock,[data-dir="x"] .pin,[data-dir="x"] .lens,[data-dir="x"] .crumbs{border:1px solid var(--line)}
[data-dir="x"] .sec-head .kind,[data-dir="x"] .mblock .kind>span:first-child,[data-dir="x"] .streaks::before{background:var(--text);color:var(--surface);padding:2px 10px}
[data-dir="x"] .topbar{border-bottom:1px solid var(--line)}
[data-dir="x"] .palette{border-bottom-color:var(--line)}
[data-dir="x"] .btn{border:1px solid var(--text);height:30px}
[data-dir="x"] .btn[aria-pressed="true"]{background:var(--text);color:var(--surface);border-color:var(--text)}
[data-dir="x"] .btn[aria-pressed="true"] .key{color:var(--surface)}
[data-dir="x"] .s-row{gap:0}
[data-dir="x"] .streak+.streak{border-left-color:var(--line)}
[data-dir="x"] .box{width:12px;height:12px;border:1px solid var(--text)}
[data-dir="x"] .week .segs i{width:26px;height:12px;border:1px solid var(--text)}
[data-dir="x"] .st-prog{border-color:var(--text)}
[data-dir="x"] .ex,[data-dir="x"] .ex li,[data-dir="x"] .mblock li,[data-dir="x"] .week{border-color:var(--rule-strong)}
[data-dir="x"] .ex li,[data-dir="x"] .mblock li{border-bottom-style:dotted}
[data-dir="x"] .problem{border-right-color:var(--line)}
[data-dir="x"] .problem::before,[data-dir="x"] .answer::before,[data-dir="x"] .m-head{border-bottom-color:var(--line)}
[data-dir="x"] .caret{background:var(--text)}
[data-dir="x"] .reply .field{border-color:var(--line)}
/* the key legend: reversed mode block, then keys with dotted leaders */
[data-dir="x"] .status{background:var(--surface);border-top:1px solid var(--line);height:30px;font-family:var(--font-pixel);font-size:11px}
[data-dir="x"] .status span{border:0}
[data-dir="x"] .status .sp~span{border:0}
[data-dir="x"] .status .sp~span::after{content:" .....";color:var(--text-faint)}
[data-dir="x"] .status .sp~span:last-child::after{content:""}
[data-dir="x"] .status kbd{font-family:var(--font-pixel);font-weight:400;background:var(--text);color:var(--surface);padding:1px 5px;margin-right:4px}
/* the Atlas as a deck plan */
[data-dir="x"] .a-sea{fill:url(#xgrid)}
[data-dir="x"] .a-land{fill:var(--surface-1)}
[data-dir="x"] .w-top{stroke:var(--line);stroke-width:1.5;stroke-dasharray:none}
[data-dir="x"] .w-sub{stroke:var(--line);stroke-dasharray:6 4}
[data-dir="x"] .w-closed{stroke:var(--line)}
[data-dir="x"] .a-contour{stroke:var(--line)}
[data-dir="x"] .rt{stroke:var(--text)}
[data-dir="x"] .a-folder{font-family:var(--font-pixel);font-weight:400;font-size:11px;font-variation-settings:normal;fill:var(--text)}
[data-dir="x"] .a-label{font-family:var(--font-pixel);font-size:11px;font-variation-settings:normal}
[data-dir="x"] .north,[data-dir="x"] .hint{font-family:var(--font-pixel);font-variation-settings:normal;font-size:11px}
[data-dir="x"] .hint{background:var(--surface)}
/* the grid Atlas */
[data-dir="x"] .gridmap .a-sea{fill:var(--station-surface)}
[data-dir="x"] .g-dots{stroke:var(--line);opacity:.4}
[data-dir="x"] .g-wall{stroke:var(--line)}
[data-dir="x"] .g-title,[data-dir="x"] .g-note{font-family:var(--font-pixel);font-variation-settings:normal;font-weight:400}
[data-dir="x"] .g-title{text-transform:uppercase}
[data-dir="x"] .g-note{font-size:11px}
`;

export function stationDocs(atlasHtml) {
  return {
    StationToday: todayDoc({ dir: 'x', term: true, css: S_CSS, group: GROUP_S, title: 'Station terminal option, Today',
      subtitle: 'For fun: Today as a late-1970s film computer. Pixel and mono type, upper case for labels only, reversed header bars, thin cyan frames, segmented counters, a dotted-leader key legend. The pens are unchanged.',
      extraBody: status('TODAY', ['DMFT of random networks', '2 reviews due', '1 next step'], [['1-4', 'spaces'], ['c', 'continue'], ['?', 'keys']]) }),
    StationWorkbench: workbenchDoc({ dir: 'x', term: true, css: S_CSS, group: GROUP_S, title: 'Station terminal option, workbench',
      subtitle: 'For fun: the workbench as a station terminal. Prose is mono in mixed case; labels are upper case. Same pins and leader lines.',
      extraBody: status('PRACTICE', ['Diagnostic 1, exercise 3', 'draft saved', 'hints 2 of 3'], [['h', 'hint'], ['f', 'feedback'], ['d', 'discuss'], ['?', 'keys']]) }),
    StationAtlas: reskinAtlas(atlasHtml, { group: GROUP_S, dir: 'x', css: S_CSS, title: 'Station terminal option, Atlas',
      subtitle: 'For fun: the Atlas as a deck plan on a grid. Contour folders, trunks with counts, cyan drawing lines. The pens are unchanged.',
      defs: '<pattern id="xgrid" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="var(--station-surface)"/><path d="M40 0H0V40" stroke="var(--station-rule)" stroke-width="1" fill="none"/></pattern>' }),
  };
}
