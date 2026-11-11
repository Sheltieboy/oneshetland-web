/**
 * Public Editions promotion surfaces (pure, client-safe). The database decides WHO is featured (edition_featured: a booked, public Edition, rotated daily); this file only
 * shapes what comes back, caps it, and says when a surface must collapse. Nothing here reads a price, a tier or any business placement.
 */
import { KIND_LABEL, type EditionKind } from "./types";

export const HOME_STRIP_CAP = 3;
export const DISCOVERY_ROW_CAP = 4;
export type PromoSurface = "home" | "discovery" | "edition_page";
export type PromoMetric = "shown" | "tap" | "view";

export type FeaturedEdition = {
  edition_id: string; slug: string; title: string; kind: EditionKind; starts_on: string; ends_on: string;
  summary: string | null; cover_url: string | null; organiser_name: string | null; parent_kind: "hub" | "business" | null; parent_slug: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const DAY = /^\d{4}-\d{2}-\d{2}/;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Keep only well-formed rows, drop duplicates, and never return more than `cap`. Anything unexpected (null, an error object, a bad row) yields fewer or no cards. */
export function parseFeatured(rows: unknown, cap: number): FeaturedEdition[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: FeaturedEdition[] = [];
  for (const r of rows) {
    if (out.length >= cap) break;
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = str(o.edition_id), slug = str(o.slug), title = str(o.title), starts = str(o.starts_on), ends = str(o.ends_on);
    if (!id || !UUID.test(id) || seen.has(id) || !slug || !SLUG.test(slug) || !title || !starts || !DAY.test(starts) || !ends || !DAY.test(ends)) continue;
    const kind = o.kind as EditionKind;
    if (!(kind in KIND_LABEL)) continue;
    seen.add(id);
    out.push({
      edition_id: id, slug, title, kind, starts_on: starts.slice(0, 10), ends_on: ends.slice(0, 10), summary: str(o.summary),
      cover_url: str(o.cover_url), organiser_name: str(o.organiser_name),
      parent_kind: o.parent_kind === "hub" || o.parent_kind === "business" ? o.parent_kind : null, parent_slug: str(o.parent_slug),
    });
  }
  return out;
}

/** The index shows its Promoted row only on the plain list: a search or a kind filter hides it (the visitor asked for something specific). */
export const showPromotedRow = (f: { q?: string | null; kind?: string | null }): boolean => !(f.q && f.q.trim()) && !f.kind;

/** Which kind of featuring each surface asks the database for. */
export const FEATURED_KIND: Record<"home" | "discovery", "homepage" | "discovery"> = { home: "homepage", discovery: "discovery" };

/** The body of one tracking call, or null when the arguments would be refused anyway. */
export function trackPayload(editionId: string, surface: PromoSurface, metric: PromoMetric): { p_edition: string; p_surface: PromoSurface; p_metric: PromoMetric } | null {
  if (!UUID.test(editionId)) return null;
  if (!["home", "discovery", "edition_page"].includes(surface) || !["shown", "tap", "view"].includes(metric)) return null;
  return { p_edition: editionId, p_surface: surface, p_metric: metric };
}
