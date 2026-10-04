// Retro-futurist option: the same screens as an pale phosphor display out of a 1970s film computer.
// Built on the terminal lean (numbered spaces, framed panes, key hints, status line) with its own surfaces, pixel headings and scan lines.
// No glow: the brief rules out blur and large shadows, so the phosphor look is colour, type and line only.
import { todayDoc, workbenchDoc } from './marginalia.mjs';
import { T_CSS, status } from './terminal.mjs';

export const GROUP_R = 'Option · retro-futurist';

export const R_CSS = T_CSS.replaceAll('[data-dir="t"]', '[data-dir="r"]') + `
[data-dir="r"]{--surface:var(--retro-surface);--surface-1:var(--retro-surface-1);--surface-2:var(--retro-surface-2);--surface-3:var(--retro-surface-3);--rule:var(--retro-rule);--rule-strong:var(--retro-rule-strong);--text:var(--retro-text);--text-soft:var(--retro-text-soft);--text-faint:var(--retro-text-faint);--radius-sm:0px;--radius-md:0px;--radius-lg:0px}
/* scan lines: a hard-edged rule every third pixel, over everything, never taking clicks */
[data-dir="r"].screen::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:20;background:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,var(--retro-surface) 2px,var(--retro-surface) 3px);opacity:.28}
/* pixel type for names, headings and numbers; Ioskeley stays for small labels; Charter stays for prose and maths */
[data-dir="r"] h1,[data-dir="r"] h2,[data-dir="r"] h3,[data-dir="r"] .brand,[data-dir="r"] .kind,[data-dir="r"] .s-num b,[data-dir="r"] .pin-head b,[data-dir="r"] .status b,[data-dir="r"] .m-head b,[data-dir="r"] .lens h2,[data-dir="r"] .problem::before,[data-dir="r"] .answer::before,[data-dir="r"] .streaks::before{font-family:var(--font-pixel);font-weight:400;text-transform:uppercase;letter-spacing:0}
[data-dir="r"] .page-head h1{font-size:22px}
[data-dir="r"] .sec h2{font-size:18px}
[data-dir="r"] .cont h3,[data-dir="r"] .problem h1{font-size:16px;line-height:24px}
[data-dir="r"] .s-num b{font-size:55px}
[data-dir="r"] .kind,[data-dir="r"] .pin-head b,[data-dir="r"] .m-head b,[data-dir="r"] .lens h2,[data-dir="r"] .problem::before,[data-dir="r"] .answer::before,[data-dir="r"] .streaks::before{font-size:11px}
[data-dir="r"] .proj .mode{text-transform:uppercase;font-family:var(--font-pixel);font-size:11px}
/* panels: a heavier frame with the title as a reversed block */
[data-dir="r"] .streaks,[data-dir="r"] .sec,[data-dir="r"] .mblock{border-width:2px}
[data-dir="r"] .sec-head .kind,[data-dir="r"] .mblock .kind>span:first-child,[data-dir="r"] .streaks::before{background:var(--text);color:var(--surface);padding:1px 8px}
[data-dir="r"] .btn{border-width:2px;text-transform:uppercase;font-size:12px}
[data-dir="r"] .btn.primary{clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))}
[data-dir="r"] .pin{border-width:2px}
[data-dir="r"] .box{border-width:2px}
[data-dir="r"] .week .segs i{border-width:2px;height:10px}
[data-dir="r"] .topbar{border-bottom:2px solid var(--rule-strong)}
[data-dir="r"] .status{border-top:2px solid var(--rule-strong)}
[data-dir="r"] .caret{background:var(--text)}
/* the Atlas as a vector display */
[data-dir="r"] .atlas-wrap{background:var(--surface)}
[data-dir="r"] .a-sea{fill:url(#rgrid)}
[data-dir="r"] .a-contour,[data-dir="r"] .a-front,[data-dir="r"] .a-hach{stroke:var(--text)}
[data-dir="r"] .w-top{stroke:var(--text-soft);stroke-width:1.5;stroke-dasharray:10 4 2 4}
[data-dir="r"] .a-folder{font-family:var(--font-pixel);font-weight:400;font-size:11px;text-transform:uppercase;font-variation-settings:normal;fill:var(--text)}
[data-dir="r"] .a-label{font-family:var(--font-ui);font-variation-settings:normal}
[data-dir="r"] .lens,[data-dir="r"] .crumbs{border:2px solid var(--rule-strong)}
[data-dir="r"] .north{font-family:var(--font-pixel);text-transform:uppercase;font-variation-settings:normal;font-size:11px}
`;

// the Atlas is built elsewhere: re-skin a finished Atlas page into the retro option
export function retroAtlas(html, subtitle) {
  const grid = '<pattern id="rgrid" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="var(--retro-surface)"/><path d="M30 26v8M26 30h8" stroke="var(--retro-rule)" stroke-width="1" fill="none"/></pattern>';
  return html
    .replace(/<!-- @dsCard group="[^"]*" width=1440 height=900 subtitle="[^"]*" -->/, `<!-- @dsCard group="${GROUP_R}" width=1440 height=900 subtitle="${subtitle}" -->`)
    .replaceAll('data-dir="a"', 'data-dir="r"')
    .replace('<pattern id="fogdots"', grid + '<pattern id="fogdots"')
    .replace('</style>\n</head>', R_CSS + '</style>\n</head>')
    .replace(/<title>[^<]*<\/title>/, '<title>Retro-futurist option, Atlas</title>');
}

export function retroDocs() {
  return {
    RetroToday: todayDoc({ dir: 'r', term: true, css: R_CSS, group: GROUP_R, title: 'Retro-futurist option, Today',
      subtitle: 'Today as an pale phosphor display: pixel headings, reversed title blocks, scan lines, a status line. The three pens keep their own colours and line styles.',
      extraBody: status('TODAY', ['DMFT of random networks', '2 reviews due', '1 next step'], [['1-4', 'spaces'], ['c', 'continue'], ['?', 'keys']]) }),
    RetroWorkbench: workbenchDoc({ dir: 'r', term: true, css: R_CSS, group: GROUP_R, title: 'Retro-futurist option, workbench',
      subtitle: 'The workbench in the retro option. Prose and maths stay in Charter; everything around them is pixel and mono type on a pale phosphor tone. Same pins and leader lines.',
      extraBody: status('PRACTICE', ['Diagnostic 1, exercise 3', 'draft saved', 'hints 2 of 3'], [['h', 'hint'], ['f', 'feedback'], ['d', 'discuss'], ['?', 'keys']]) }),
  };
}
