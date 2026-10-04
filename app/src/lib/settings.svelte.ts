// Theme and light or dark mode, per browser (localStorage). The saved choice
// is applied before first paint by a script in app.html.

// One theme now (Marginalia, design/project/README.md). The terminal lean and
// the retro-futurist option return later as settings layered on it.
export const THEMES = [{ id: "marginalia", name: "Marginalia" }] as const;

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
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    document.documentElement.dataset.mode = mode;
    write("rdstudio.mode", mode);
  }
}

export const settings = new Settings();
