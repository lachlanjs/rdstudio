// Theme and light or dark mode, per browser (localStorage). The saved choice
// is applied before first paint by a script in app.html.

// Marginalia (design/project/README.md), and the Station terminal option
// layered on it (T61, themes/station.css, applied by data-theme on <html>).
export const THEMES = [
  { id: "marginalia", name: "Marginalia", what: "Charter for reading, three pens in the margin. The default." },
  { id: "station", name: "Station", what: "A late-1970s film computer: cold phosphor, pixel labels, cyan frames. For fun." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "system" | "light" | "dark";
export const MODES: [Mode, string][] = [["dark", "Dark"], ["light", "Light"], ["system", "Match system"]];

function read(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private browsing: applies until reload */ }
}

class Settings {
  theme = $state<ThemeId>("marginalia");
  /** Dark first: dark unless light, or following the system, was chosen. */
  mode = $state<Mode>("dark");

  constructor() {
    const m = read("rdstudio.mode", "dark");
    this.mode = m === "light" || m === "system" ? m : "dark";
    this.theme = read("rdstudio.theme", "marginalia") === "station" ? "station" : "marginalia";
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    write("rdstudio.theme", theme);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    document.documentElement.dataset.mode = mode;
    write("rdstudio.mode", mode);
  }
}

export const settings = new Settings();
