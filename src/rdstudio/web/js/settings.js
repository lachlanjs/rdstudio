// Settings tab: theme and light/dark mode, stored per browser in localStorage.

import { store } from "./data.js";
import { h } from "./util.js";

export const THEMES = [
  { id: "studio", name: "Studio", note: "The original look: engineering paper, Literata for reading, Atkinson Hyperlegible Next for the interface.",
    text: '"Literata", serif', ui: '"Atkinson", sans-serif', light: ["#f4f6f2", "#1c2632", "#5646c0", "#c2560f"], dark: ["#141a20", "#e2e8e3", "#a597f2", "#f2a65a"] },
  { id: "notebook", name: "Notebook", note: "An exercise book: ruled paper, handwritten headings and map labels, pencil-rough lines. Dark is a chalkboard.",
    text: '"Literata", serif', ui: '"Caveat", cursive', light: ["#fcfcf9", "#1e2a4a", "#2748b8", "#c0392b"], dark: ["#1f2a26", "#ecefe6", "#f4d35e", "#f29e9e"] },
  { id: "map", name: "Map", note: "A topographic chart: tinted land with dash-dot borders on a sea of contours, town dots and cased roads. Dark is a night navigation chart.",
    text: '"Source Serif 4", serif', ui: '"Source Serif 4", serif', light: ["#d9e7ec", "#23291f", "#8fb573", "#1d4e89"], dark: ["#0a1520", "#e6edf2", "#f0b429", "#5fb3f0"] },
  { id: "space", name: "Space", note: "A star field: folders as nebulae, notes as glowing stars, links as constellation lines. Light is a celestial atlas.",
    text: '"IBM Plex Sans", sans-serif', ui: '"IBM Plex Mono", monospace', light: ["#f1f3fa", "#141b33", "#2b3a8f", "#c2410c"], dark: ["#05070f", "#e6e9f5", "#8ab4ff", "#ffcf6b"] },
  { id: "cyber", name: "Cyber", note: "Neon on black over a grid with scanlines, glowing routes, square corners, a monospace interface. Light is a hard-edged daylight version.",
    text: '"IBM Plex Sans", sans-serif', ui: '"JetBrains Mono", monospace', light: ["#eef1f5", "#0a0f1a", "#0068e0", "#d4007a"], dark: ["#04060a", "#d7fbff", "#19e6ff", "#ff2bd6"] },
];
// Theme ids before the redesign, mapped to their nearest successor.
const FORMER = { notebook: "studio", journal: "studio", modern: "studio", blueprint: "map", terminal: "cyber" };
const MODES = [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]];

function read(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private browsing: applies until reload */ }
}

export function currentTheme() {
  const t = read("rdstudio.look", "") || FORMER[read("rdstudio.theme", "")] || "studio";
  return THEMES.some((x) => x.id === t) ? t : "studio";
}
export function currentMode() {
  const m = read("rdstudio.mode", "system");
  return ["light", "dark"].includes(m) ? m : "system";
}

export function applyTheme(id) {
  document.getElementById("theme-css").href = `themes/${id}.css`;
  write("rdstudio.look", id);
}

export function applyMode(mode) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.mode;
  else root.dataset.mode = mode;
  document.getElementById("code-light").media = mode === "system" ? "(prefers-color-scheme: light)" : mode === "light" ? "all" : "not all";
  document.getElementById("code-dark").media = mode === "system" ? "(prefers-color-scheme: dark)" : mode === "dark" ? "all" : "not all";
  write("rdstudio.mode", mode);
}

function swatches(colors) {
  return h("span", { class: "swatches", "aria-hidden": "true" }, colors.map((c) => h("i", { style: `background:${c}` })));
}

export function settingsView() {
  document.title = `Settings · ${store.site.title}`;
  const themeList = h("div", { class: "theme-grid", role: "radiogroup", "aria-label": "Theme" });
  const drawThemes = () => themeList.replaceChildren(...THEMES.map((t) => {
    const selected = t.id === currentTheme();
    const card = h("button", { class: "theme-card", type: "button", role: "radio", "aria-checked": String(selected) },
      h("span", { class: "theme-name", style: `font-family:${t.ui}` }, t.name),
      h("span", { class: "theme-sample", style: `font-family:${t.text}` }, "Geodesics are the straight lines of a curved space."),
      h("span", { class: "theme-note" }, t.note),
      h("span", { class: "theme-swatches" }, swatches(t.light), swatches(t.dark)));
    card.addEventListener("click", () => { applyTheme(t.id); drawThemes(); });
    return card;
  }));
  drawThemes();

  const modes = h("div", { class: "toggles", role: "radiogroup", "aria-label": "Light or dark" });
  const drawModes = () => modes.replaceChildren(...MODES.map(([id, label]) => {
    const b = h("button", { class: "toggle", type: "button", role: "radio", "aria-checked": String(currentMode() === id), "aria-pressed": String(currentMode() === id) }, label);
    b.addEventListener("click", () => { applyMode(id); drawModes(); });
    return b;
  }));
  drawModes();

  const resetGraph = h("button", { class: "toggle", type: "button" }, "Reset graph layout and options");
  resetGraph.addEventListener("click", () => {
    try { localStorage.removeItem("rdstudio.graph"); sessionStorage.removeItem("rdstudio.graph"); } catch { /* ignore */ }
    resetGraph.textContent = "Graph reset. It lays out afresh after a reload.";
  });

  return h("div", { class: "page" },
    h("h1", {}, "Settings"),
    h("p", { class: "lede" }, "Saved in this browser only. Other devices and the exported site keep their own settings."),
    h("h2", { class: "section-h" }, "Theme"),
    themeList,
    h("h2", { class: "section-h" }, "Light or dark"),
    modes,
    h("h2", { class: "section-h" }, "Graph"),
    h("p", { class: "section-note" }, "Forces, filters and node positions are adjusted on the Graph tab and remembered here."),
    h("div", { class: "toggles" }, resetGraph));
}
