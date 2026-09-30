// Theme and light or dark mode, per browser (localStorage). The saved choice
// is applied before first paint by a script in app.html.

export const THEMES = [
  { id: "studio", name: "Studio", note: "The original look: engineering paper, Literata for reading, Atkinson Hyperlegible Next for the interface.",
    text: '"Literata", serif', ui: '"Atkinson", sans-serif', light: ["#f4f6f2", "#1c2632", "#5646c0", "#c2560f"], dark: ["#141a20", "#e2e8e3", "#a597f2", "#f2a65a"] },
  { id: "notebook", name: "Notebook", note: "An exercise book: ruled paper, handwritten headings and map labels, sketchy pencil outlines. Dark is a chalkboard.",
    text: '"Literata", serif', ui: '"Caveat", cursive', light: ["#fcfcf9", "#1e2a4a", "#2748b8", "#c0392b"], dark: ["#1f2a26", "#ecefe6", "#f4d35e", "#f29e9e"] },
  { id: "map", name: "Map", note: "A topographic chart: tinted land with dash-dot borders on a sea of contours, town dots and cased roads. Dark is a night navigation chart.",
    text: '"Source Serif 4", serif', ui: '"Source Serif 4", serif', light: ["#d9e7ec", "#23291f", "#8fb573", "#1d4e89"], dark: ["#0a1520", "#e6edf2", "#f0b429", "#5fb3f0"] },
  { id: "space", name: "Space", note: "A star field: folders as nebulae, notes as bright stars, links as constellation lines. Light is a celestial atlas.",
    text: '"IBM Plex Sans", sans-serif', ui: '"IBM Plex Mono", monospace', light: ["#f1f3fa", "#141b33", "#2b3a8f", "#c2410c"], dark: ["#05070f", "#e6e9f5", "#8ab4ff", "#ffcf6b"] },
  { id: "cyber", name: "Cyber", note: "Neon on black over a grid with scanlines, bright routes, square corners, a monospace interface. Light is a hard-edged daylight version.",
    text: '"IBM Plex Sans", sans-serif', ui: '"JetBrains Mono", monospace', light: ["#eef1f5", "#0a0f1a", "#0068e0", "#d4007a"], dark: ["#04060a", "#d7fbff", "#19e6ff", "#ff2bd6"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "system" | "light" | "dark";
export const MODES: [Mode, string][] = [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]];

// Theme ids before the redesign, mapped to their nearest successor.
const FORMER: Record<string, ThemeId> = { notebook: "studio", journal: "studio", modern: "studio", blueprint: "map", terminal: "cyber" };

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
    const t = read("rdstudio.look", "") || FORMER[read("rdstudio.theme", "")] || "studio";
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
