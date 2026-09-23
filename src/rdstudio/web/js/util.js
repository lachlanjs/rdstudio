// Small DOM and formatting helpers.

export function h(tag, attrs = {}, ...children) {
  const node = tag.includes(":")
    ? document.createElementNS("http://www.w3.org/2000/svg", tag.split(":")[1])
    : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.setAttribute("class", value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const MINUTE = 60e3, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

export function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const diff = Date.now() - t;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  if (diff < 14 * DAY) return `${Math.round(diff / DAY)} days ago`;
  return fmtDate(iso);
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeEl(iso, rel = true) {
  if (!iso) return "";
  return h("time", { datetime: iso, title: fmtDateTime(iso) }, rel ? relTime(iso) : fmtDate(iso));
}

// Trust state for display: stale verification outranks the tier.
export function trustState(c) {
  return c.verification_stale ? "stale" : c.trust;
}

export const TRUST_LABEL = {
  "human-reviewed": "Human-reviewed",
  "machine-confirmed": "Machine-confirmed",
  unverified: "Unverified",
  stale: "Changed since review",
};

export function trustBadge(c) {
  const s = trustState(c);
  return h("span", { class: `trust ${s}` }, h("span", { class: `dot ${s}` }), TRUST_LABEL[s]);
}

export function conceptHref(id) {
  return "#/k/" + id.split("/").map(encodeURIComponent).join("/");
}
export function dirHref(id) {
  return id ? "#/d/" + id.split("/").map(encodeURIComponent).join("/") : "#/";
}

export function titleCase(name) {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}
