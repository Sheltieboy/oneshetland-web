/**
 * Identity inheritance for Editions run by a Hub or a Business (pure: no I/O, unit-tested).
 *
 * An organiser linked to a Hub or Business never copies its identity. Wherever the organiser (and then the Edition) has not set its own logo, cover, colour, description or website,
 * the page reads the Hub's PUBLIC columns live: a Hub that changes its logo or colour changes it for its Editions too, while any Edition-specific choice still wins. Only the
 * public Hub whitelist is ever read (never owner, members, payout or contact fields).
 */
import { FOCUS_RE } from "./brand";
import type { Organiser } from "./types";

/** Hub columns safe for anyone to read (the database grants exactly these to the public). */
export const HUB_PUBLIC_COLUMNS = "id, name, slug, type, description, area, website, logo_url, cover_url, brand_color, is_verified, is_charity";
export type HubIdentity = {
  id: string; name: string; slug: string | null; type: string | null; description: string | null; area: string | null; website: string | null;
  logo_url: string | null; cover_url: string | null; brand_color: string | null; is_verified: boolean; is_charity: boolean;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const https = (u: string | null | undefined) => (typeof u === "string" && /^https:\/\/[^\s<>"']+$/.test(u) ? u : null);

/** Business columns safe for anyone to read, from the public view (never owner, payout, wallet or contact-person fields). */
export const BUSINESS_PUBLIC_COLUMNS = "id, name, slug, description, website, logo_url, cover_url, brand_color, is_active";

export type ParentKind = "hub" | "business";
/** The identity of whatever runs the Editions: a Hub or a Business. Read live, never copied. */
export type ParentIdentity = {
  kind: ParentKind; id: string; name: string; /** the public page of the Hub or Business */ href: string; manageHref: string;
  description: string | null; website: string | null; logo_url: string | null; cover_url: string | null; brand_color: string | null;
};
type Identity = { logo_url: string | null; cover_url: string | null; brand_color: string | null; description: string | null; website: string | null };

/** A Hub's public page and where its owner edits its details. */
export const hubParent = (h: Pick<HubIdentity, "id" | "slug" | "name" | "description" | "website" | "logo_url" | "cover_url" | "brand_color">): ParentIdentity => ({
  kind: "hub", id: h.id, name: h.name, href: `/hubs/${h.slug || h.id}`, manageHref: `/hubs/${h.slug || h.id}/manage/settings`,
  description: h.description, website: h.website, logo_url: h.logo_url, cover_url: h.cover_url, brand_color: h.brand_color,
});
/** A Business's directory page and where its owner edits its details. */
export const businessParent = (b: { id: string; name: string; description: string | null; website: string | null; logo_url: string | null; cover_url: string | null; brand_color: string | null }): ParentIdentity => ({
  kind: "business", id: b.id, name: b.name, href: `/directory/${b.id}`, manageHref: `/business/${b.id}/manage/profile`,
  description: b.description, website: b.website, logo_url: b.logo_url, cover_url: b.cover_url, brand_color: b.brand_color,
});

/**
 * What the parent (Hub or Business) contributes when the organiser has left a field empty. A parent photograph has no focus point, so a cover taken from the parent is centred.
 * Anything the Edition or its profile sets itself still wins.
 */
export function inheritFromParent<T extends Pick<Organiser, "logo_url" | "cover_url" | "cover_focus" | "brand_color" | "description" | "website">>(organiser: T, parent: Identity | null | undefined): T {
  if (!parent) return organiser;
  const ownCover = !!organiser.cover_url;
  return {
    ...organiser,
    logo_url: organiser.logo_url || https(parent.logo_url),
    cover_url: organiser.cover_url || https(parent.cover_url),
    cover_focus: ownCover ? organiser.cover_focus : (organiser.cover_focus && FOCUS_RE.test(organiser.cover_focus) && !parent.cover_url ? organiser.cover_focus : null),
    brand_color: organiser.brand_color || (parent.brand_color && HEX.test(parent.brand_color) ? parent.brand_color : null),
    description: organiser.description || (parent.description ?? null),
    website: organiser.website || https(parent.website),
  };
}
/** Kept for the Hub call sites: a Hub is just one kind of parent. */
export const inheritFromHub = inheritFromParent;

/** Which of the organiser's visual fields are currently coming from the parent (Hub or Business) (for "using your Hub's logo" hints in the Brand screen). */
export function inheritedFields(organiser: Pick<Organiser, "logo_url" | "cover_url" | "brand_color" | "description" | "website">, hub: Identity | null | undefined) {
  const h = hub ?? null;
  return {
    logo: !!h && !organiser.logo_url && !!https(h.logo_url), cover: !!h && !organiser.cover_url && !!https(h.cover_url),
    color: !!h && !organiser.brand_color && !!h.brand_color && HEX.test(h.brand_color), description: !!h && !organiser.description && !!h.description,
    website: !!h && !organiser.website && !!https(h.website),
  };
}
