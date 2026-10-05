// Token data for rdstudio. Direction A (Marginalia) is the base; B and C add their own named tokens later.
export const themes = [{ id: 'dark', name: 'Dark' }, { id: 'light', name: 'Light' }];

const c = (name, dark, light, usage) => ({ name, value: { dark, light }, usage });

export const colors = [
  c('surface', '#0d1219', '#f3f4f7', 'Page ground of every screen (deep blue-black in dark, cool paper in light, never pure black). Text on it: text, text-soft, text-faint, the pens.'),
  c('surface-1', '#131a24', '#fafbfc', 'First raised step: panels, the top bar, inputs. Same text tokens as surface.'),
  c('surface-2', '#1a2231', '#ffffff', 'Second raised step: teacher cards, menus, the command palette.'),
  c('surface-3', '#232d3f', '#e7eaf0', 'Third step: pressed or selected rows, hint highlights, inset wells. Do not set pen-coloured text on a pen-soft fill here (4.2:1); use text.'),
  c('rule', '#2b3547', '#d6dae2', 'Hairline rules that divide columns and rows. Decorative structure, not a control border.'),
  c('rule-strong', '#6b7a95', '#7a8599', 'Borders of controls, inputs and focusable cards (3:1 or more on every surface). Also the neutral leader line of a hint.'),
  c('text', '#e6e9ef', '#141a25', 'Reading text and the answer. The brightest thing on a screen. On surface to surface-3 in both themes.'),
  c('text-soft', '#aeb7c6', '#454f61', 'Secondary text: labels, nav, captions. On surface to surface-3.'),
  c('text-faint', '#8d98ab', '#5b6678', 'Metadata only (dates, counts, hints of state). Still 4.5:1 on every surface, but never for anything you must read.'),
  c('pen-red', '#ff7f86', '#b42327', 'Red pen = critical: wrong, stale, missed. Lines, underlines and text on surface to surface-2. Always paired with a SOLID underline or line. Never decorative.'),
  c('pen-red-soft', '#ff7f862b', '#b423271f', 'Highlight behind passages the red pen marks. Put text, not pen-red, on it.'),
  c('pen-green', '#7fdba0', '#1b6e3d', 'Green pen = right: verified, passed, understood. Lines and text on surface to surface-2. Always paired with a DOUBLE underline or line.'),
  c('pen-green-soft', '#7fdba029', '#1b6e3d1f', 'Highlight behind passages the green pen marks. Put text, not pen-green, on it.'),
  c('pen-blue', '#82aaff', '#2548b8', 'Blue pen = discussion and links. Link text, dotted underlines, the discussion pin and the focus ring (2px, offset 2px). Always paired with a DOTTED underline or line.'),
  c('pen-blue-soft', '#82aaff29', '#2548b81a', 'Highlight behind discussed passages. Put text, not pen-blue, on it.'),
  c('focus-ring', '{pen-blue}', '{pen-blue}', 'Keyboard focus: a solid 2px blue ring, offset 2px, 6:1 or more on every surface.'),
  c('syntax-keyword', '#c9b0f7', '#6a3fb5', 'Code only: keywords, tags and preprocessor lines, always bold as well. Violet, a hue no pen uses. On surface to surface-3. Never outside a code block.'),
  c('syntax-literal', '#e6bd74', '#845600', 'Code only: strings, numbers and other literal values. Amber, a hue no pen uses. On surface to surface-3. Never outside a code block.'),
  // Direction B (Survey): the same pens on a teal-slate ground, plus the lines of a survey sheet.
  c('survey-surface', '#0a1417', '#eef2f3', 'Direction B ground: teal-slate, never pure black. Replaces surface when a screen is set in Survey.'),
  c('survey-surface-1', '#0f1b1f', '#f7f9fa', 'Direction B first raised step (land, panels).'),
  c('survey-surface-2', '#152429', '#ffffff', 'Direction B second raised step (cards, menus).'),
  c('survey-surface-3', '#1c2e34', '#e1e8ea', 'Direction B third step (selected rows, wells).'),
  c('survey-rule', '#21343b', '#cfd9dc', 'Direction B hairlines and the ticks of a measured rule.'),
  c('survey-rule-strong', '#62808b', '#70838b', 'Direction B control borders, region outlines, route lines (3:1 or more on every Survey surface).'),
  c('survey-grid', '#16262c', '#dbe3e6', 'The graticule behind the Atlas. Decorative, never carries a label.'),
  c('survey-text', '#e4ecee', '#11191c', 'Direction B reading text and map labels on survey-surface to survey-surface-3.'),
  c('survey-text-soft', '#a7b9bf', '#3f4f55', 'Direction B secondary text and contour lines on survey-surface to survey-surface-3.'),
  c('survey-text-faint', '#8aa0a7', '#556870', 'Direction B metadata: grid references, counts. 4.5:1 on every Survey surface.'),
  // Direction C (Instrument): cool chrome, warm reading surface.
  c('instrument-surface', '#0a0d10', '#e9ecef', 'Direction C chrome ground: the housing around the instruments.'),
  c('instrument-panel', '#11161b', '#f5f7f9', 'Direction C panel face: readouts, lists, the teacher column.'),
  c('instrument-panel-2', '#171e25', '#ffffff', 'Direction C raised panel: teacher readouts, menus.'),
  c('instrument-bezel', '#2b343d', '#c6ced6', 'Direction C 1px rules between panels. Decorative structure.'),
  c('instrument-bezel-strong', '#667685', '#6f7c89', 'Direction C control borders and tick marks (3:1 on every Instrument surface).'),
  c('instrument-text', '#e8ecef', '#12171c', 'Direction C text on the chrome and panels.'),
  c('instrument-text-soft', '#a9b3bd', '#424c56', 'Direction C labels on the chrome and panels.'),
  c('instrument-text-faint', '#8793a0', '#5a6672', 'Direction C metadata on the chrome and panels. 4.5:1 or more.'),
  c('instrument-paper', '#1d1b18', '#f8f7f4', 'Direction C reading surface (problem, answer): a warm graphite in dark, near-white in light. The warmth lives here and nowhere else.'),
  c('instrument-ink', '#efe9dc', '#1f1b15', 'Direction C reading text on instrument-paper.'),
  c('instrument-ink-soft', '#b9b2a2', '#5b564b', 'Direction C secondary text on instrument-paper.'),
  c('instrument-ink-faint', '#9a9486', '#6f6a5e', 'Direction C metadata on instrument-paper. 4.5:1 or more.'),
  // Retro-futurist option: a pale straw phosphor display (toned down from amber). The pens keep their own colours, so the phosphor tone is never a meaning.
  c('retro-surface', '#11100c', '#e6eadf', 'Retro option ground: warm black tube in dark, fanfold paper in light. Replaces surface when a screen is set in the retro option.'),
  c('retro-surface-1', '#181610', '#eef1e9', 'Retro option first raised step (panels, land on the Atlas).'),
  c('retro-surface-2', '#201d15', '#f6f8f3', 'Retro option second raised step (teacher cards, closed folders).'),
  c('retro-surface-3', '#2b271c', '#d5dccb', 'Retro option third step (pressed and selected).'),
  c('retro-rule', '#383225', '#c3ccb9', 'Retro option hairlines and scan rules. Decorative structure.'),
  c('retro-rule-strong', '#8a7e5e', '#6d7d70', 'Retro option control borders, panel frames and routes (3:1 or more on every retro surface).'),
  c('retro-text', '#f1e7cf', '#1c2a20', 'Retro option text: pale straw phosphor in dark, dark green-black ink in light. On retro-surface to retro-surface-3.'),
  c('retro-text-soft', '#cdbf9f', '#3c4d40', 'Retro option secondary text, contours. On retro-surface to retro-surface-3.'),
  c('retro-text-faint', '#a89b7c', '#4c5d51', 'Retro option metadata. 4.5:1 or more on every retro surface.'),
  // Station terminal option: a cold white phosphor on blue-black, after late-1970s film computers. For fun; a user setting.
  c('station-surface', '#060a0f', '#e4eaee', 'Station option ground: blue-black tube in dark, cold printout paper in light.'),
  c('station-surface-1', '#0b1118', '#edf1f4', 'Station option first raised step (panels, land on the Atlas).'),
  c('station-surface-2', '#101922', '#f6f8fa', 'Station option second raised step (teacher cards, closed folders).'),
  c('station-surface-3', '#18242f', '#d3dce2', 'Station option third step (pressed and selected).'),
  c('station-rule', '#1c2a35', '#c2cdd4', 'Station option hairlines and the map grid. Decorative structure.'),
  c('station-rule-strong', '#6f8794', '#647883', 'Station option control borders and panel frames (3:1 or more on every station surface).'),
  c('station-text', '#e6eff3', '#101a22', 'Station option text: cold white phosphor in dark, blue-black ink in light. Reversed blocks use it as their fill.'),
  c('station-text-soft', '#a9bcc6', '#34454f', 'Station option secondary text.'),
  c('station-text-faint', '#8499a5', '#4b5d68', 'Station option metadata and dotted leaders. 4.5:1 or more on every station surface.'),
  c('station-line', '#8fcfdb', '#1f6373', 'Station option drawing line: frames, map outlines, contours and connector lines. Pale cyan; structure only, never a meaning.'),
];


export const spacing = [
  ['space-1', '4px', 'Hairline gaps, icon to label.'],
  ['space-2', '8px', 'Inside controls, between a label and its value.'],
  ['space-3', '12px', 'Between rows in a list, between pin cards.'],
  ['space-4', '16px', 'Phone gutters, card padding.'],
  ['space-5', '20px', 'Between a heading and its content.'],
  ['space-6', '24px', 'Between groups inside a column.'],
  ['space-8', '32px', 'Between sections.'],
  ['space-10', '40px', 'Between columns of the workbench (problem to answer).'],
  ['space-12', '48px', 'Page margin on desktop.'],
  ['space-16', '64px', 'Leader-line run between the answer and the teacher margin.'],
].map(([name, value, usage]) => ({ name, value, usage }));

export const radius = [
  ['radius-sm', '2px', 'Highlights behind marked passages, small chips.'],
  ['radius-md', '4px', 'Buttons, inputs, pin cards. Keep corners small: structure comes from rules, not from soft cards.'],
  ['radius-lg', '8px', 'Menus and the command palette only.'],
].map(([name, value, usage]) => ({ name, value, usage }));

const f = (family, file, weight, style = 'normal') => ({ family, file: `fonts/${file}`, weight, style });
export const fonts = [
  f('Charter', 'Charter-Regular.woff2', '400'),
  f('Charter', 'Charter-Italic.woff2', '400', 'italic'),
  f('Charter', 'Charter-Bold.woff2', '700'),
  f('Charter', 'Charter-BoldItalic.woff2', '700', 'italic'),
  f('Ioskeley Mono', 'IoskeleyMono-Regular.woff2', '400'),
  f('Ioskeley Mono', 'IoskeleyMono-Italic.woff2', '400', 'italic'),
  f('Ioskeley Mono', 'IoskeleyMono-Bold.woff2', '700'),
  f('Ioskeley Mono', 'IoskeleyMono-BoldItalic.woff2', '700', 'italic'),
  f('Martian Mono', 'MartianMono-Variable.woff2', '100 800'),
  f('Departure Mono', 'DepartureMono-Regular.woff2', '400'),
  f('KaTeX_Main', 'KaTeX_Main-Regular.woff2', '400'),
  f('KaTeX_Main', 'KaTeX_Main-Italic.woff2', '400', 'italic'),
  f('KaTeX_Main', 'KaTeX_Main-Bold.woff2', '700'),
  f('KaTeX_Main', 'KaTeX_Main-BoldItalic.woff2', '700', 'italic'),
  f('KaTeX_Math', 'KaTeX_Math-Italic.woff2', '400', 'italic'),
  f('KaTeX_Math', 'KaTeX_Math-BoldItalic.woff2', '700', 'italic'),
  f('KaTeX_AMS', 'KaTeX_AMS-Regular.woff2', '400'),
  f('KaTeX_Size1', 'KaTeX_Size1-Regular.woff2', '400'),
  f('KaTeX_Size2', 'KaTeX_Size2-Regular.woff2', '400'),
  f('KaTeX_Size3', 'KaTeX_Size3-Regular.woff2', '400'),
  f('KaTeX_Size4', 'KaTeX_Size4-Regular.woff2', '400'),
];

export const families = {
  reading: '"Charter", "Bitstream Charter", Georgia, serif',
  ui: '"Ioskeley Mono", ui-monospace, Menlo, monospace',
  map: '"Martian Mono", ui-monospace, Menlo, monospace',
  pixel: '"Departure Mono", ui-monospace, Menlo, monospace',
};

const s = (name, fontSize, lineHeight, fontWeight, extra = {}) => ({ name, fontSize, lineHeight, fontWeight, ...extra });
export const typeGroups = [
  { name: 'Reading', family: 'reading', styles: [
    s('note-title', '36px', '1.15', 700, { usage: 'Page and note titles.', sample: 'Today' }),
    s('heading', '24px', '1.3', 700, { usage: 'Section headings inside a note or card.', sample: 'Diagnostic 1' }),
    s('subheading', '20px', '1.35', 700, { usage: 'Exercise titles, sub-sections.', sample: 'Why the recurrent input is Gaussian' }),
    s('body', '18px', '1.65', 400, { usage: 'Notes, problems and the answer. About 70 characters a line in the Library reader.', sample: 'Each term has mean 0 and variance g²/N q.' }),
    s('body-small', '16px', '1.55', 400, { usage: 'Teacher card text, list rows.', sample: 'Right, and it is why the variances add.' }),
    s('quote', '16px', '1.5', 400, { fontStyle: 'italic', usage: 'The words a pin quotes.', sample: 'the terms are independent' }),
  ] },
  { name: 'Interface', family: 'ui', styles: [
    s('label', '13px', '16px', 400, { usage: 'Buttons, nav, field labels, row status. Sentence case, no tracking.', sample: 'Ask an agent to mark it' }),
    s('label-strong', '13px', '16px', 700, { usage: 'Active nav item, card kind (Hint 2 of 3, Feedback).', sample: 'Hint 2 of 3' }),
    s('caption', '12px', '16px', 400, { usage: 'Metadata: dates, counts, units.', sample: 'set 2 October by the teacher' }),
    s('code', '14px', '1.5', 400, { usage: 'Code blocks and the line of the editor being written (source shown).', sample: '\\mathrm{Var}(h)' }),
    s('number-lg', '44px', '1', 700, { usage: 'Streak counters. Numbers first, labels second.', sample: '3' }),
  ] },
  { name: 'Map and pixel', family: 'map', styles: [
    s('map-label', '12px', '16px', 500, { usage: 'Atlas region and note labels (Martian Mono, width axis set with font-variation-settings).', sample: 'Gaussian fields' }),
    s('pixel-number', '56px', '1', 400, { family: 'pixel', usage: 'Big numbers only (Departure Mono). Used in direction C; direction A does not use it.', sample: '1.84' }),
  ] },
];

export function tokensJson() {
  return {
    name: 'rdstudio',
    version: 1,
    color: { themes, tokens: colors },
    type: { fonts, families, groups: typeGroups },
    spacing: { tokens: spacing },
    radius: { tokens: radius },
  };
}

// Mirror of the page's compiler, for local rendering only.
export function tokensCss(fontBase = 'fonts/') {
  const out = [];
  const val = (t, th) => (typeof t.value === 'string' ? t.value : t.value[th]);
  const decl = (t, th) => {
    const v = val(t, th);
    return `--${t.name}:${v.startsWith('{') ? `var(--${v.slice(1, -1)})` : v};`;
  };
  out.push(`:root,[data-theme="dark"]{${colors.map((t) => decl(t, 'dark')).join('')}}`);
  out.push(`[data-theme="light"]{${colors.map((t) => decl(t, 'light')).join('')}}`);
  out.push(`:root{${spacing.map((t) => `--${t.name}:${t.value};`).join('')}${radius.map((t) => `--${t.name}:${t.value};`).join('')}${Object.entries(families).map(([k, v]) => `--font-${k}:${v};`).join('')}}`);
  for (const ft of fonts) out.push(`@font-face{font-family:"${ft.family}";src:url(${fontBase}${ft.file.replace('fonts/', '')}) format("woff2");font-weight:${ft.weight};font-style:${ft.style};font-display:swap}`);
  return out.join('\n');
}
