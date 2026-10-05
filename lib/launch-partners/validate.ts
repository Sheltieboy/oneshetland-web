/* eslint-disable @typescript-eslint/no-explicit-any -- validators read untrusted JSON, narrowing field by field */
/**
 * Validation for the two JSON documents a campaign stores — the Launch Preview (PreviewConfig) and the prepared
 * Business Page draft (PageDraft). Both are written by an administrator and later RENDERED to someone else, so the
 * rule is strict and simple: every address in them must be our own path or https, and the structure must be what the
 * renderers expect. Anything else is refused, not repaired.
 *
 * Pure: no database, no framework.
 */
import type { PreviewConfig } from "../launch-preview/types.ts";
import { EMPHASES, HERO_VISUALS, type PageDraft } from "../business-page/types.ts";

/** Our own path ("/launch/…") or an https address. Never javascript:, data:, http:, or a protocol-relative "//host". */
export const isSafeUrl = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 2048 && ((v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) || /^https:\/\/[^\s/]+/.test(v));

const URL_KEYS = new Set(["src", "image", "source", "url", "logo"]);

/** Every value under a url-like key (anywhere in the tree) must be a safe address. */
export function allUrlsSafe(node: unknown, path = ""): string | null {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const bad = allUrlsSafe(node[i], `${path}[${i}]`); if (bad) return bad; } return null; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (URL_KEYS.has(k) && typeof v === "string" && !isSafeUrl(v)) return `${path}.${k}`;
      const bad = allUrlsSafe(v, `${path}.${k}`); if (bad) return bad;
    }
  }
  return null;
}

const str = (v: unknown, max = 4000): v is string => typeof v === "string" && v.length <= max;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const photoOk = (p: unknown) => isObj(p) && isSafeUrl(p.src) && str(p.alt, 400);

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function parsePreviewConfig(raw: unknown, expectSlug?: string): Parsed<PreviewConfig> {
  if (!isObj(raw)) return fail("The preview is empty.");
  const c = raw as Record<string, any>;
  if (!str(c.slug, 61) || !/^[a-z0-9][a-z0-9-]{2,60}$/.test(c.slug)) return fail("Invalid preview name.");
  if (expectSlug && c.slug !== expectSlug) return fail("The preview belongs to a different name.");
  if (!str(c.businessName, 160) || !c.businessName.trim()) return fail("The business name is missing.");
  if (c.outreachOpening !== undefined && !str(c.outreachOpening, 600)) return fail("The outreach opening is too long.");
  if (!isObj(c.hero) || !str(c.hero.support, 1200)) return fail("The introduction is missing.");
  if (c.hero.headline !== undefined && !(Array.isArray(c.hero.headline) && c.hero.headline.length === 3 && c.hero.headline.every((x: unknown) => str(x, 120)))) return fail("The headline must be three short lines.");
  const b = c.business;
  if (!isObj(b) || !str(b.categoryLabel, 120) || !str(b.locality, 160) || !str(b.description, 2000) || !Array.isArray(b.tags) || b.tags.length > 12 || !b.tags.every((t: unknown) => str(t, 80)) || !photoOk(b.image)) return fail("The business details are incomplete.");
  if (!Array.isArray(c.products) || c.products.length > 6) return fail("A preview shows at most six example products.");
  for (const p of c.products) {
    if (!isObj(p) || !str(p.id, 80) || !str(p.title, 200) || typeof p.price !== "number" || !(p.price > 0) || p.price > 100000 || !isSafeUrl(p.image) || !str(p.blurb, 400)) return fail("An example product is incomplete.");
    if (p.source !== undefined && !isSafeUrl(p.source)) return fail("A source address is not allowed.");
    // An example product is a picture, never a record: no stock, sku, checkout or link fields.
    for (const k of Object.keys(p)) if (!["id", "title", "price", "image", "blurb", "source"].includes(k)) return fail(`An example product may not carry "${k}".`);
  }
  if (!isObj(c.sourceSite) || !str(c.sourceSite.label, 120) || !isSafeUrl(c.sourceSite.url)) return fail("The business's own site is missing.");
  if (!Array.isArray(c.sources) || c.sources.length > 40 || !c.sources.every((s: unknown) => isObj(s) && str(s.label, 200) && isSafeUrl(s.url) && str(s.used, 400))) return fail("The sources are incomplete.");
  if (!str(c.searchTerm, 80)) return fail("The search example is missing.");
  const bad = allUrlsSafe(c);
  if (bad) return fail(`An address is not allowed (${bad}). Use https links or our own paths.`);
  return { ok: true, value: c as PreviewConfig };
}

export function parsePageDraft(raw: unknown): Parsed<PageDraft> {
  if (!isObj(raw)) return fail("The page draft is empty.");
  const d = raw as Record<string, any>;
  if (d.version !== 1) return fail("Unknown page draft version.");
  if (!isObj(d.hero) || !str(d.hero.tagline, 400) || !photoOk(d.hero.image)) return fail("The page needs a tagline and a picture.");
  if (d.hero.headline !== undefined && !str(d.hero.headline, 160)) return fail("The headline is too long.");
  if ((d.hero.eyebrow !== undefined && !str(d.hero.eyebrow, 120)) || (d.hero.locality !== undefined && !str(d.hero.locality, 160))) return fail("The hero label or place is too long.");
  if (d.hero.treatment !== undefined && !(HERO_VISUALS as readonly string[]).includes(String(d.hero.treatment))) return fail("Unknown hero treatment.");
  if (d.hero.gallery !== undefined && !(Array.isArray(d.hero.gallery) && d.hero.gallery.length <= 3 && d.hero.gallery.every(photoOk))) return fail("The hero gallery must be up to three pictures.");
  if (d.emphasis !== undefined && !(EMPHASES as readonly string[]).includes(d.emphasis)) return fail("Unknown emphasis.");
  if (d.story !== undefined && !(isObj(d.story) && str(d.story.title, 200) && Array.isArray(d.story.body) && d.story.body.length <= 8 && d.story.body.every((p: unknown) => str(p, 2000)))) return fail("The story is incomplete.");
  if (d.products !== undefined && !(Array.isArray(d.products) && d.products.length <= 6 && d.products.every((p: unknown) => isObj(p) && str(p.id, 80) && str(p.title, 200) && typeof p.price === "number" && p.price > 0 && isSafeUrl(p.image) && str(p.blurb, 400)))) return fail("An example product is incomplete.");
  if (d.experience !== undefined && !(isObj(d.experience) && str(d.experience.title, 200) && str(d.experience.blurb, 1200) && photoOk(d.experience.image) && isSafeUrl(d.experience.source))) return fail("The example experience is incomplete.");
  if (d.booking !== undefined && !(isObj(d.booking) && str(d.booking.cta, 200) && str(d.booking.line, 800))) return fail("The booking example is incomplete.");
  if (d.rewards !== undefined && !(isObj(d.rewards) && str(d.rewards.title, 200) && str(d.rewards.body, 800))) return fail("The rewards idea is incomplete.");
  if (d.useful !== undefined && !(Array.isArray(d.useful) && d.useful.length <= 6 && d.useful.every((u: unknown) => isObj(u) && str(u.title, 200) && Array.isArray(u.body) && u.body.every((p: unknown) => str(p, 2000))))) return fail("The useful information is incomplete.");
  const bad = allUrlsSafe(d);
  if (bad) return fail(`An address is not allowed (${bad}). Use https links or our own paths.`);
  return { ok: true, value: d as PageDraft };
}
