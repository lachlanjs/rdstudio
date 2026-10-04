// Terminal lean: Marginalia's pens and reading type, with the chrome pushed toward a terminal.
// Square corners, framed panes with their titles set into the border, numbered spaces, a prompt, key hints, a status line.
import { todayDoc, workbenchDoc } from './marginalia.mjs';

export const GROUP_T = 'A · Marginalia, terminal lean';

export const status = (mode, left, right) => `<footer class="status" aria-label="Status"><b>${mode}</b>${left.map((t) => `<span>${t}</span>`).join('')}<span class="sp"></span>${right.map(([key, t]) => `<span><kbd>${key}</kbd> ${t}</span>`).join('')}</footer>`;

export const T_CSS = `
[data-dir="t"]{--radius-sm:0px;--radius-md:0px;--radius-lg:0px}
[data-dir="t"] h1,[data-dir="t"] h2,[data-dir="t"] h3{font-family:var(--font-ui);font-weight:700}
.key{color:var(--text-faint);margin-right:8px;font-weight:400}
.btn .key{color:var(--text-soft);margin-right:9px}
.btn .key::before{content:"["}.btn .key::after{content:"]"}
.btn.primary .key{color:var(--surface)}
/* top bar: numbered spaces, the current one in reverse video; the palette is a prompt */
[data-dir="t"] .topbar{padding:0 24px;gap:24px;height:40px}
[data-dir="t"] .spaces{height:40px;align-items:center;gap:4px}
[data-dir="t"] .spaces a{height:24px;padding:0 10px}
[data-dir="t"] .spaces a[aria-current]{background:var(--text);color:var(--surface);box-shadow:none}
[data-dir="t"] .spaces a[aria-current] .key{color:var(--surface)}
[data-dir="t"] .palette{width:320px;gap:10px;height:28px;background:transparent;border:0;border-bottom:1px solid var(--rule-strong);padding:0 2px}
[data-dir="t"] .palette .prompt{color:var(--text);font-weight:700}
[data-dir="t"] .palette kbd{margin-left:auto}
/* status line */
.status{position:absolute;left:0;right:0;bottom:0;height:28px;display:flex;align-items:center;background:var(--surface-2);border-top:1px solid var(--rule);font-family:var(--font-ui);font-size:12px;line-height:16px;color:var(--text-soft);white-space:nowrap}
.status b{display:flex;align-items:center;height:100%;padding:0 12px;background:var(--text);color:var(--surface);font-weight:700}
.status span{padding:0 12px;border-right:1px solid var(--rule-strong)}
.status .sp{flex:1;border:0}
.status .sp~span{border-right:0;border-left:1px solid var(--rule-strong)}
.status kbd{font-family:var(--font-ui);color:var(--text);font-weight:700}
/* framed panes: the title sits in the top border */
[data-dir="t"] .today{top:40px;bottom:28px;padding:0 24px;column-gap:56px;grid-template-columns:1fr 392px}
[data-dir="t"] .page-head{padding:16px 0 20px}
[data-dir="t"] .page-head h1{font-size:20px;line-height:24px}
[data-dir="t"] .streaks,[data-dir="t"] .sec,[data-dir="t"] .mblock{position:relative;border:1px solid var(--rule-strong)}
[data-dir="t"] .streaks{padding:6px 16px 0}
[data-dir="t"] .streaks::before{content:"Streaks";position:absolute;top:-9px;left:10px;padding:0 6px;background:var(--surface);font-family:var(--font-ui);font-size:13px;line-height:16px;font-weight:700}
[data-dir="t"] .sec{margin-top:28px;padding:16px 16px 12px}
[data-dir="t"] .sec-head{position:absolute;top:-9px;left:10px;gap:0}
[data-dir="t"] .sec-head>*{background:var(--surface);padding:0 6px}
[data-dir="t"] .sec h2{font-size:18px;line-height:24px;margin-top:0}
[data-dir="t"] .sec .desc{font-size:16px}
[data-dir="t"] .ex{margin-top:10px}
[data-dir="t"] .ex li{padding:8px 0;font-size:17px}
[data-dir="t"] .ex li:last-child{border-bottom:0}
[data-dir="t"] .cont-body{border-top:0;margin-top:0;padding-top:0}
[data-dir="t"] .cont h3{font-size:16px;line-height:24px}
[data-dir="t"] .margin{padding-top:60px}
[data-dir="t"] .mblock{margin-bottom:28px;padding:12px 14px 2px}
[data-dir="t"] .mblock .kind{position:absolute;top:-9px;left:10px;right:10px;border:0;padding:0}
[data-dir="t"] .mblock .kind>*{background:var(--surface);padding:0 6px}
[data-dir="t"] .mblock li{font-size:16px}
[data-dir="t"] .mblock li:last-child{border-bottom:0}
[data-dir="t"] .pin{border-color:var(--rule-strong)}
[data-dir="t"] .pin.today-pin{margin-bottom:28px}
/* workbench: three titled panes */
[data-dir="t"] .crumb{padding:0 24px;height:36px}
[data-dir="t"] .bench{top:76px;bottom:28px;padding:0 24px;grid-template-columns:330px 620px 1fr}
[data-dir="t"] .problem{padding:0 32px 0 0;margin-right:32px;margin-bottom:20px}
[data-dir="t"] .problem::before,[data-dir="t"] .answer::before{display:flex;box-sizing:border-box;align-items:flex-end;height:40px;padding-bottom:11px;border-bottom:1px solid var(--rule);font-family:var(--font-ui);font-size:13px;line-height:16px;font-weight:700}
[data-dir="t"] .problem::before{content:"Problem";margin-bottom:14px}
[data-dir="t"] .answer::before{content:"Your answer";margin-bottom:8px}
[data-dir="t"] .problem h1{font-size:17px;line-height:24px}
[data-dir="t"] .answer{margin-right:48px;padding-top:0}
[data-dir="t"] .editor{margin-top:10px}
[data-dir="t"] .caret{width:10px;margin-left:0}
[data-dir="t"] .a-foot{bottom:16px;gap:10px;font-size:12px}
[data-dir="t"] .a-foot .btn,[data-dir="t"] .a-foot .textbtn{padding:0 8px;font-size:12px}
[data-dir="t"] .a-foot .textbtn{padding:0}
`;

export function terminalDocs() {
  return {
    TerminalToday: todayDoc({ dir: 't', term: true, css: T_CSS, group: GROUP_T, title: 'Marginalia, terminal lean, Today',
      subtitle: 'Today, desktop, dark, leaning into the terminal: numbered spaces, a prompt, framed panes, a status line. The pens and the reading type are unchanged.',
      extraBody: status('TODAY', ['DMFT of random networks', '2 reviews due', '1 next step'], [['1-4', 'spaces'], ['c', 'continue'], ['?', 'keys']]) }),
    TerminalWorkbench: workbenchDoc({ dir: 't', term: true, css: T_CSS, group: GROUP_T, title: 'Marginalia, terminal lean, workbench',
      subtitle: 'The exercise workbench, dark, leaning into the terminal: titled panes, key hints on every action, a block caret, a status line. Same pins and leader lines.',
      extraBody: status('PRACTICE', ['Diagnostic 1, exercise 3', 'draft saved', 'hints 2 of 3'], [['h', 'hint'], ['f', 'feedback'], ['d', 'discuss'], ['?', 'keys']]) }),
  };
}
