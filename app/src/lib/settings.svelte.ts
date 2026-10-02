// Theme and light or dark mode, per browser (localStorage). The saved choice
// is applied before first paint by a script in app.html.

export const THEMES = [
  { id: "studio", name: "Studio", note: "The original look: engineering paper, Literata for reading, Atkinson Hyperlegible Next for the interface.",
    text: '"Literata", serif', ui: '"Atkinson", sans-serif', light: ["#f4f6f2", "#1c2632", "#5646c0", "#c2560f"], dark: ["#141a20", "#e2e8e3", "#a597f2", "#f2a65a"] },
  { id: "minimalist", name: "Minimalist", note: "Black, white and one blue. One typeface, large titles, space in place of boxes and lines; on the map, plain dots and bare outlines.",
    text: '"Inter", sans-serif', ui: '"Inter", sans-serif', light: ["#ffffff", "#000000", "#002fa7", "#8f8f8f"], dark: ["#000000", "#f0f0f0", "#8ea8ff", "#6e6e6e"] },
  { id: "blueprint", name: "Blueprint", note: "An engineering drawing: a cyanotype in dark, a whiteprint with red markup in light. Martian Mono lettering, a title block on each note, dimension lines under sections, a drafting grid.",
    text: '"IBM Plex Sans", sans-serif', ui: '"Martian Mono", monospace', light: ["#f3f5f8", "#1b3a7c", "#c8402a", "#7a8cba"], dark: ["#123f73", "#f2f6fc", "#ffe07a", "#8aa6cf"] },
  { id: "space", name: "Space", note: "A star field: folders as nebulae, notes as bright stars, links as constellation lines. Light is a celestial atlas.",
    text: '"IBM Plex Sans", sans-serif', ui: '"Ioskeley Mono", monospace', light: ["#f1f3fa", "#141b33", "#2b3a8f", "#c2410c"], dark: ["#05070f", "#e6e9f5", "#8ab4ff", "#ffcf6b"] },
  { id: "terminal", name: "Terminal", note: "One monospace face, square corners, Markdown's marks on headings and lists, inverse video for what is current. Dark is a grey screen with a green prompt; light is a line-printer listing.",
    text: '"Ioskeley Mono", monospace', ui: '"Ioskeley Mono", monospace', light: ["#f7f6ef", "#1d221d", "#1d5a9e", "#b4471c"], dark: ["#121313", "#d9dbd4", "#8fd694", "#e3b75e"] },
  { id: "brutalist", name: "Brutalist", note: "Raw and loud: huge black titles, Charter for reading, pixel labels, thick rules, hard shadows, link blue and highlighter yellow. Flat primary blocks on the map.",
    text: '"Charter", serif', ui: '"Inter", sans-serif', light: ["#ffffff", "#000000", "#0000ee", "#ffe900"], dark: ["#000000", "#ffffff", "#8ea2ff", "#ffe900"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "system" | "light" | "dark";
export const MODES: [Mode, string][] = [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]];

// Themes that have gone, mapped to their nearest successor: under the old key
// (rdstudio.theme) and the current one (rdstudio.look).
const FORMER: Record<string, ThemeId> = { notebook: "studio", journal: "studio", modern: "minimalist", map: "studio", cyber: "terminal", terminal: "terminal" };

function read(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private browsing: applies until reload */ }
}

class Settings {
  theme = $state<ThemeId>("studio");
  mode = $state<Mode>("system");

  constructor() {
    const look = read("rdstudio.look", "");
    const t = THEMES.some((x) => x.id === look) ? look : FORMER[look] || FORMER[read("rdstudio.theme", "")] || "studio";
    this.theme = THEMES.some((x) => x.id === t) ? (t as ThemeId) : "studio";
    const m = read("rdstudio.mode", "system");
    this.mode = m === "light" || m === "dark" ? m : "system";
  }

  setTheme(id: ThemeId): void {
    this.theme = id;
    const link = document.getElementById("theme-css") as HTMLLinkElement | null;
    if (link) link.href = `themes/${id}.css`;
    write("rdstudio.look", id);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    if (mode === "system") delete document.documentElement.dataset.mode;
    else document.documentElement.dataset.mode = mode;
    write("rdstudio.mode", mode);
  }
}

export const settings = new Settings();
