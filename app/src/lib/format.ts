// Formatting and links shared by the views.

import type { ConceptRecord } from "@rdstudio/core";

const MINUTE = 60e3, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

export function relTime(iso: string | null | undefined): string {
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

export function fmtDate(iso: string | null | undefined): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return String(iso ?? "");
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type TrustState = ConceptRecord["trust"] | "stale";

/** Trust for display: a stale verification outranks the tier. */
export const trustState = (c: ConceptRecord): TrustState => (c.verification_stale ? "stale" : c.trust);

export const TRUST_LABEL: Record<TrustState, string> = {
  "human-reviewed": "Human-reviewed",
  "machine-confirmed": "Machine-confirmed",
  unverified: "Unverified",
  stale: "Changed since review",
};

const segments = (id: string) => id.split("/").map(encodeURIComponent).join("/");
export const conceptHref = (id: string): string => "#/k/" + segments(id);
export const dirHref = (id: string): string => (id ? "#/d/" + segments(id) : "#/");

export const titleCase = (name: string): string => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
