/**
 * The PROFILE layer of a Business Page — what may be promoted prepared → owner-reviewed → approved → live — and the
 * COMMERCE layer, which may never be promoted.
 *
 *   PROFILE (presentation, can move forward): hero headline / tagline / label / place / picture / treatment / gallery,
 *     the business story, "useful information" blocks, which strength leads (emphasis) and the section order (layout).
 *   COMMERCE (never promoted automatically): example products, example experience, booking illustration, suggested
 *     rewards — and the internal notes. A real product, service, offer, pass or reward programme appears on a live page
 *     only because it genuinely exists in OneShetland, never because a draft said so.
 *
 * The database enforces the same split (see launch_partner_page_versions); this is the web's copy, used to render
 * the future-live preview and covered by tests so the two cannot drift.
 */
import type { PageDraft, SectionId } from "./types.ts";

export const PROFILE_TOP_KEYS = ["hero", "story", "useful", "emphasis", "layout"] as const;
export const PROFILE_HERO_KEYS = ["headline", "tagline", "eyebrow", "locality", "image", "treatment", "gallery"] as const;
/** Never promoted. (Anything not in the profile lists is also dropped; these are named so a test can prove it.) */
export const COMMERCE_KEYS = ["products", "productsTitle", "experience", "booking", "rewards", "notes"] as const;

export type PageProfile = Pick<PageDraft, "version" | "emphasis" | "layout" | "story" | "useful"> & { hero: PageDraft["hero"] };

/** The profile layer of a draft — everything else (all commerce, the notes) is dropped. */
export function extractProfile(draft: PageDraft): PageProfile {
  const hero: Record<string, unknown> = {};
  for (const k of PROFILE_HERO_KEYS) if ((draft.hero as Record<string, unknown>)[k] !== undefined) hero[k] = (draft.hero as Record<string, unknown>)[k];
  const out: Record<string, unknown> = { version: 1, hero };
  for (const k of PROFILE_TOP_KEYS) if (k !== "hero" && (draft as unknown as Record<string, unknown>)[k] !== undefined) out[k] = (draft as unknown as Record<string, unknown>)[k];
  return out as unknown as PageProfile;
}

/** A profile viewed as a draft with no commerce at all (the shape the model builder consumes in live mode). */
export const profileAsDraft = (p: PageProfile): PageDraft => ({ ...p, version: 1 });

/** Keys present in a document that are NOT part of the profile (for an owner submission this must be empty). */
export function nonProfileKeys(doc: unknown): string[] {
  if (!doc || typeof doc !== "object") return [];
  const top = new Set<string>(PROFILE_TOP_KEYS);
  const hero = new Set<string>(PROFILE_HERO_KEYS);
  const bad: string[] = [];
  for (const k of Object.keys(doc as object)) if (k !== "version" && !top.has(k)) bad.push(k);
  const h = (doc as { hero?: unknown }).hero;
  if (h && typeof h === "object") for (const k of Object.keys(h)) if (!hero.has(k)) bad.push(`hero.${k}`);
  return bad;
}

/**
 * Where real commerce WILL slot in, read from what the prepared draft showed as examples. Used only to place review
 * notes in the Admin/owner "future live preview"; it never carries content into the page.
 */
export function slotHintsFromDraft(draft: PageDraft | null): SectionId[] {
  if (!draft) return [];
  const out: SectionId[] = [];
  if (draft.products?.length) out.push("shop");
  if (draft.booking) out.push("book");
  if (draft.experience) out.push("experience");
  if (draft.rewards) out.push("rewards");
  return out;
}
