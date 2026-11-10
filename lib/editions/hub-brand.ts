/**
 * Branding inheritance for Hub-run Editions (pure: no I/O, unit-tested).
 *
 * An organiser linked to a Hub never copies the Hub's identity. Wherever the organiser (and then the Edition) has not set its own logo, cover, colour, description or website,
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

/** What the Hub contributes when the organiser has left a field empty. A Hub photograph has no focus point, so a cover taken from the Hub is centred. */
export function inheritFromHub<T extends Pick<Organiser, "logo_url" | "cover_url" | "cover_focus" | "brand_color" | "description" | "website">>(organiser: T, hub: HubIdentity | null | undefined): T {
  if (!hub) return organiser;
  const ownCover = !!organiser.cover_url;
  return {
    ...organiser,
    logo_url: organiser.logo_url || https(hub.logo_url),
    cover_url: organiser.cover_url || https(hub.cover_url),
    cover_focus: ownCover ? organiser.cover_focus : (organiser.cover_focus && FOCUS_RE.test(organiser.cover_focus) && !hub.cover_url ? organiser.cover_focus : null),
    brand_color: organiser.brand_color || (hub.brand_color && HEX.test(hub.brand_color) ? hub.brand_color : null),
    description: organiser.description || (hub.description ?? null),
    website: organiser.website || https(hub.website),
  };
}

/** Which of the organiser's visual fields are currently coming from the Hub (for "using your Hub's logo" hints in the Brand screen). */
export function inheritedFields(organiser: Pick<Organiser, "logo_url" | "cover_url" | "brand_color" | "description" | "website">, hub: HubIdentity | null | undefined) {
  const h = hub ?? null;
  return {
    logo: !!h && !organiser.logo_url && !!https(h.logo_url), cover: !!h && !organiser.cover_url && !!https(h.cover_url),
    color: !!h && !organiser.brand_color && !!h.brand_color && HEX.test(h.brand_color), description: !!h && !organiser.description && !!h.description,
    website: !!h && !organiser.website && !!https(h.website),
  };
}

/** The web address a Hub-run organiser suggests: the Hub's own slug plus "-festival" kept within the database's rules (3 to 60 lowercase letters, numbers and hyphens). */
export function suggestOrganiserSlug(hubSlugOrName: string): string {
  const base = hubSlugOrName.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "hub";
  const s = `${base}-editions`.replace(/-+/g, "-");
  return s.length >= 3 ? s.slice(0, 60) : "hub-editions";
}
export const isValidOrganiserSlug = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 60;
