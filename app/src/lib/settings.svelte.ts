// Theme and light or dark mode, per browser (localStorage). The saved choice
// is applied before first paint by a script in app.html.

// Marginalia is the theme (design/project/README.md); Station restyles it as a
// film computer's terminal (static/themes/station.css, the Station rules in
// app.css, and the status line).
export const THEMES = [{ id: "marginalia", name: "Marginalia" }, { id: "station", name: "Station" }] as const;

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
  /** Station's scan lines: on unless turned off. */
  scanlines = $state(true);

  constructor() {
    const m = read("rdstudio.mode", "dark");
    this.mode = m === "light" || m === "system" ? m : "dark";
    this.theme = read("rdstudio.theme", "marginalia") === "station" ? "station" : "marginalia";
    this.scanlines = read("rdstudio.scanlines", "on") !== "off";
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    document.documentElement.dataset.mode = mode;
    write("rdstudio.mode", mode);
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
    document.documentElement.dataset.theme = theme;
    write("rdstudio.theme", theme);
  }

  setScanlines(on: boolean): void {
    this.scanlines = on;
    document.documentElement.dataset.scan = on ? "on" : "off";
    write("rdstudio.scanlines", on ? "on" : "off");
  }
}

export const settings = new Settings();
