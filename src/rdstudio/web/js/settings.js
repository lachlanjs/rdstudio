// Settings tab: theme and light/dark mode, stored per browser in localStorage.

import { store } from "./data.js";
import { h } from "./util.js";

export const THEMES = [
  { id: "notebook", name: "Notebook", note: "Engineering paper. Literata for reading, Atkinson Hyperlegible Next for the interface.",
    text: '"Literata", serif', ui: '"Atkinson", sans-serif', light: ["#f4f6f2", "#1c2632", "#5646c0", "#2e7a58"], dark: ["#141a20", "#e2e8e3", "#a597f2", "#5fbf8f"] },
  { id: "journal", name: "Journal", note: "An academic paper. Source Serif 4 and Source Sans 3, black on white with Oxford blue.",
    text: '"Source Serif 4", serif', ui: '"Source Sans 3", sans-serif', light: ["#ffffff", "#111111", "#1f3a68", "#1d6b45"], dark: ["#17181b", "#e8e6e1", "#9db8e8", "#6cc295"] },
  { id: "modern", name: "Modern", note: "Neutral greys, Inter throughout, a teal accent and rounder shapes.",
    text: '"Inter", sans-serif', ui: '"Inter", sans-serif', light: ["#f7f7f8", "#16171d", "#0f766e", "#2563eb"], dark: ["#0f1115", "#e7e8ec", "#2dd4bf", "#60a5fa"] },
  { id: "blueprint", name: "Blueprint", note: "Drafting-office blue with orange marks. IBM Plex Sans and Plex Mono.",
    text: '"IBM Plex Sans", sans-serif', ui: '"IBM Plex Sans", sans-serif', light: ["#eef3f9", "#0e2a47", "#d9480f", "#1d4f91"], dark: ["#0f2742", "#dbe8f7", "#ffa94d", "#74c0fc"] },
  { id: "terminal", name: "Terminal", note: "A retro phosphor screen. JetBrains Mono everywhere, square corners.",
    text: '"JetBrains Mono", monospace', ui: '"JetBrains Mono", monospace', light: ["#eef1e6", "#1b2a1c", "#1e7a34", "#9a6a00"], dark: ["#0b100c", "#b8f2c0", "#ffb000", "#7ee787"] },
];
const MODES = [["system", "Match system"], ["light", "Light"], ["dark", "Dark"]];

function read(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private browsing: applies until reload */ }
}

export function currentTheme() {
  const t = read("rdstudio.theme", "notebook");
  return THEMES.some((x) => x.id === t) ? t : "notebook";
}
export function currentMode() {
  const m = read("rdstudio.mode", "system");
  return ["light", "dark"].includes(m) ? m : "system";
}

export function applyTheme(id) {
  document.getElementById("theme-css").href = `themes/${id}.css`;
  write("rdstudio.theme", id);
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
      h("span", { class: "theme-sample", style: `font-family:${t.text}` }, "Eigenvalues of random matrices fill the unit disk."),
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
