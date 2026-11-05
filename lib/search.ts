/**
 * lib/search.ts — shared, dependency-free pieces of site search (runs on server and client, and under node --test).
 * The database does the matching (public.search_site, migration 20261122000000); this file only names, links and tidies results.
 */
export type SearchKind = "business" | "event" | "job" | "boat" | "spik" | "hub";
export type SearchHit = { kind: SearchKind; ref: string; title: string; subtitle: string; score: number; close: boolean };
export type SuggestResponse = { results: SearchHit[]; unavailable?: boolean };

export const MIN_CHARS = 2;
export const MAX_CHARS = 60;
export const SUGGEST_LIMIT = 8;
export const RESULTS_LIMIT = 40;
export const DEBOUNCE_MS = 300;

export const KIND_LABEL: Record<SearchKind, string> = {
  business: "Business", event: "Event", job: "Job", boat: "Boat", spik: "Spik", hub: "Hub",
};
/** Plural headings for the full results page, in display order. */
export const KIND_ORDER: SearchKind[] = ["business", "event", "job", "boat", "hub", "spik"];
export const KIND_HEADING: Record<SearchKind, string> = {
  business: "Businesses", event: "What's On", job: "Jobs", boat: "Boats", hub: "Hubs", spik: "Spik",
};

/** Where a result opens. Only known kinds produce a link; a ref is URL-encoded. */
export function hrefFor(kind: SearchKind, ref: string): string {
  const r = encodeURIComponent(ref);
  switch (kind) {
    case "business": return `/directory/${r}`;
    case "event": return `/whats-on/${r}`;
    case "job": return `/jobs/${r}`;
    case "boat": return `/boats/${r}`;
    case "spik": return `/spik/${r}`;
    case "hub": return `/hubs/${r}`;
  }
}

/** The text actually sent: trimmed, collapsed, capped. Returns "" when too short to search. */
export function cleanQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const q = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  return q.replace(/[^\p{L}\p{N}]/gu, "").length >= MIN_CHARS ? q : "";
}

/** Defensive parse of the database rows: unknown kinds and malformed rows are dropped, never rendered. */
export function parseHits(rows: unknown): SearchHit[] {
  if (!Array.isArray(rows)) return [];
  const out: SearchHit[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const kind = r?.kind as SearchKind;
    if (!KIND_ORDER.includes(kind) || typeof r.ref !== "string" || typeof r.title !== "string" || !r.ref || !r.title) continue;
    out.push({ kind, ref: r.ref, title: r.title, subtitle: typeof r.subtitle === "string" ? r.subtitle : "", score: Number(r.score) || 0, close: r.close === true });
  }
  return out;
}

/** Subtitle shown beside a result: category codes become words ("food_drink" -> "Food & drink"). */
export function subtitleFor(h: SearchHit): string {
  const s = h.subtitle.trim();
  if (!s) return KIND_LABEL[h.kind];
  if (h.kind === "business") return s.replace(/_/g, " ").replace(/^food drink$/i, "Food & drink").replace(/^./, (c) => c.toUpperCase());
  return s.length > 70 ? s.slice(0, 67) + "…" : s;
}

export function groupHits(hits: SearchHit[]): { kind: SearchKind; heading: string; hits: SearchHit[] }[] {
  return KIND_ORDER.map((kind) => ({ kind, heading: KIND_HEADING[kind], hits: hits.filter((h) => h.kind === kind) })).filter((g) => g.hits.length > 0);
}

export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q)}`;

/* ── scope: which sources a search box covers ───────────────────────────────────────────────────────────────────────────── */
export type SearchScope = "all" | SearchKind;
export const SCOPES: SearchScope[] = ["all", "business", "event", "job", "boat", "spik", "hub"];
export const parseScope = (v: unknown): SearchScope => (typeof v === "string" && (SCOPES as string[]).includes(v) ? (v as SearchScope) : "all");
/** "Businesses", "Events"… for headings and the "see all" row. */
export const SCOPE_NOUN: Record<SearchScope, string> = { all: "OneShetland", business: "businesses", event: "events", job: "jobs", boat: "boats", spik: "Spik words", hub: "hubs" };

/** Where Enter goes in a contextual box: the section's own results page, keeping every filter the page already had. */
export type SearchSubmit = { path: string; params?: Record<string, string | string[] | undefined>; param?: string };
export function submitHref(s: SearchSubmit, q: string): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(s.params ?? {})) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) if (x !== "") u.append(k, x);
  u.set(s.param ?? "q", q);
  return `${s.path}?${u.toString()}`;
}
/** The site-wide results page, optionally narrowed to one source. */
export const searchHrefScoped = (q: string, scope: SearchScope = "all") => `/search?q=${encodeURIComponent(q)}${scope === "all" ? "" : `&scope=${scope}`}`;

/**
 * Suggestions should be tidy: when there are real name matches, drop the weak ones (a word that only appears inside a description, or a
 * Spik meaning). They stay on the full results page. If ALL matches are weak (e.g. "chippy" found only through descriptions) they are kept,
 * so a search never comes back empty when something relevant exists.
 */
export function trimWeak(hits: SearchHit[]): SearchHit[] {
  const strong = hits.some((h) => !h.close && h.score >= 50);
  return strong ? hits.filter((h) => h.close || h.score >= 50) : hits;
}

/** A mixed (all-OneShetland) dropdown shows at most `n` of each kind, so one chatty source (Spik words) cannot crowd out the rest. */
export function capPerKind(hits: SearchHit[], n = 3): SearchHit[] {
  const seen: Record<string, number> = {};
  return hits.filter((h) => (seen[h.kind] = (seen[h.kind] ?? 0) + 1) <= n);
}
