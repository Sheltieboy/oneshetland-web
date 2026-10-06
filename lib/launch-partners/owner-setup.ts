/**
 * The launch-partner OWNER's side of the setup — pure: where they stand, and the small amount of profile editing they may do.
 *
 * Nothing here is stored. The state is read from records that already exist: the launch campaign (does one exist for this business, and
 * can THIS owner see it), the launch grant (is it active), and the profile VERSION trail the database keeps (prepared / owner_edit /
 * approved / published). An owner approving their setup is a real, append-only 'approved' version; there is no separate flag.
 *
 * What this does NOT do, deliberately: it never turns any prepared content into real business content. The database promotes only the
 * profile layer, and only through a go-live step that does not exist yet; example products and services are never promoted at all.
 */
import type { PageDraft } from "../business-page/types.ts";
import type { PreviewPhoto } from "../launch-preview/types.ts";

export type OwnerLaunchState =
  | "none"        // no launch campaign for this owner, or not a launch partner
  | "ended"       // there was launch-partner access, and it has ended (expired / removed): no launch flow, nothing misleading
  | "review"      // access is active; the prepared setup is waiting for the owner to review it
  | "edited"      // the owner has edited their page and has not approved it yet
  | "approved"    // the owner approved their setup — nothing is public yet
  | "live";       // a published version exists (the future go-live step) — nothing left to do

export interface OwnerLaunchInput {
  /** The campaign exists AND this signed-in user is its approved owner (launch_partner_page_draft returned it). */
  hasCampaign: boolean;
  /** The business's launch-grant rows as the owner may read them. */
  grants: { expires_at: string; revoked_at?: string | null; superseded_at?: string | null }[];
  /** launch_partner_profile_versions, newest first. */
  versions: { id: string; kind: "prepared" | "owner_edit" | "approved" | "published"; created_at: string; is_approved_current?: boolean }[];
  now?: Date;
}

export interface OwnerLaunch {
  state: OwnerLaunchState;
  /** Show the prominent card (and outrank "Nothing needs you right now"). */
  showCard: boolean;
  grantActive: boolean;
  steps: { label: string; state: "done" | "current" | "todo" }[];
  title: string;
  body: string;
  cta: string;
}

const activeGrant = (g: OwnerLaunchInput["grants"], now: Date) => g.some((x) => !x.revoked_at && !x.superseded_at && new Date(x.expires_at) > now);

export function deriveOwnerLaunch(i: OwnerLaunchInput): OwnerLaunch {
  const now = i.now ?? new Date();
  const grantActive = activeGrant(i.grants, now);
  const published = i.versions.some((v) => v.kind === "published");
  const approved = i.versions.some((v) => v.kind === "approved" && v.is_approved_current !== false);
  const edited = i.versions.some((v) => v.kind === "owner_edit");
  let state: OwnerLaunchState;
  if (!i.hasCampaign) state = "none";
  else if (published) state = "live";
  else if (!grantActive) state = i.grants.length > 0 ? "ended" : "none";   // no grant yet: the ordinary dashboard until access is given
  else if (approved) state = "approved";
  else if (edited) state = "edited";
  else state = "review";

  const steps: OwnerLaunch["steps"] = [
    { label: "Business claimed", state: "done" },
    { label: "Launch Partner access active", state: "done" },
    { label: "Review your prepared page", state: state === "review" ? "current" : "done" },
    { label: "Confirm your content", state: state === "approved" ? "done" : state === "edited" ? "current" : "todo" },
    { label: "Ready to go live", state: state === "approved" ? "current" : "todo" },
  ];
  const copy: Record<OwnerLaunchState, { title: string; body: string; cta: string }> = {
    none: { title: "", body: "", cta: "" }, ended: { title: "", body: "", cta: "" }, live: { title: "", body: "", cta: "" },
    review: {
      title: "Your OneShetland setup is ready to review",
      body: "We’ve already prepared your business page and initial content. Review what we’ve put together, make any changes you want, and choose when you’re ready to go live. Nothing is public until you say so.",
      cta: "Review my launch setup",
    },
    edited: {
      title: "You’ve started editing your launch setup",
      body: "Your changes are saved privately. When you’re happy with your page, approve it. Nothing is public yet.",
      cta: "Continue my launch setup",
    },
    approved: {
      title: "You’ve approved your launch setup",
      body: "Thank you. Nothing is public yet, and you can still look over what you approved. We’ll let you know when you can go live.",
      cta: "View my launch setup",
    },
  };
  return { state, showCard: state === "review" || state === "edited" || state === "approved", grantActive, steps, ...copy[state] };
}

/* ── the profile layer an owner may edit ─────────────────────────────────── */

/** The slice of a prepared page that is "profile": the only part the database lets an owner save or approve. */
export type OwnerProfile = {
  hero?: { headline?: string; tagline?: string; eyebrow?: string; locality?: string; image?: PreviewPhoto; treatment?: "photo" | "mosaic" | "brand"; gallery?: PreviewPhoto[] };
  story?: { eyebrow?: string; title: string; body: string[]; source?: string };
  useful?: { title: string; body: string[] }[];
  emphasis?: PageDraft["emphasis"];
  layout?: PageDraft["layout"];
};

const HERO_KEYS = ["headline", "tagline", "eyebrow", "locality", "image", "treatment", "gallery"] as const;

export function profileOf(d: Partial<PageDraft> | null | undefined): OwnerProfile {
  if (!d) return {};
  const out: OwnerProfile = {};
  if (d.hero) { const h: Record<string, unknown> = {}; for (const k of HERO_KEYS) if ((d.hero as Record<string, unknown>)[k] !== undefined) h[k] = (d.hero as Record<string, unknown>)[k]; out.hero = h as OwnerProfile["hero"]; }
  if (d.story) out.story = d.story;
  if (d.useful) out.useful = d.useful;
  if (d.emphasis) out.emphasis = d.emphasis;
  if (d.layout) out.layout = d.layout;
  return out;
}

/**
 * The draft with an owner's saved profile laid over it. A saved profile is a WHOLE snapshot of the profile layer, so what it leaves out
 * (a story the owner removed, an information section they deleted) is left out of the page too. Commerce, notes and everything else come
 * from the draft untouched — the owner's profile can never carry them.
 */
export function overlayProfile(draft: PageDraft, profile: OwnerProfile | null | undefined): PageDraft {
  if (!profile || !Object.keys(profile).length) return draft;
  const next: PageDraft = { ...draft };
  delete next.story; delete next.useful;
  // Only the required parts fall back to the draft; every OPTIONAL hero part (gallery, headline…) is what the saved profile says.
  if (profile.hero) next.hero = { tagline: draft.hero.tagline, image: draft.hero.image, ...profile.hero } as PageDraft["hero"];
  if (profile.story) next.story = profile.story;
  if (profile.useful?.length) next.useful = profile.useful;
  if (profile.emphasis) next.emphasis = profile.emphasis;
  if (profile.layout) next.layout = profile.layout;
  return next;
}

const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
export const sameProfile = (a: OwnerProfile, b: OwnerProfile): boolean => canon(a) === canon(b);

/**
 * What the owner submits from the editor → the profile to save, checked against the draft they are editing. The owner can reword,
 * remove and add TEXT, choose the hero treatment, and REMOVE pictures. They cannot introduce a picture address: every picture must
 * already be one the page has. (The database then re-checks the profile's keys and sizes.)
 */
export interface OwnerEdit {
  headline: string; tagline: string; eyebrow: string; locality: string; treatment: "photo" | "mosaic" | "brand";
  keepGallery: string[];                      // gallery picture addresses to keep
  story: { title: string; body: string } | null;
  useful: { title: string; body: string }[];
}
export type EditResult = { ok: true; profile: OwnerProfile } | { ok: false; error: string };

const paras = (s: string) => s.split(/\n{2,}|\r\n{2,}/).map((x) => x.trim()).filter(Boolean);

/** `current` is the ADMIN's prepared page: it is the pool the owner may keep pictures from, and where fixed parts (the main picture, story source, emphasis, layout) come from. */
export function buildOwnerProfile(current: PageDraft, e: OwnerEdit): EditResult {
  const tagline = e.tagline.trim();
  if (!tagline) return { ok: false, error: "Your page needs a short line under its name." };
  if (e.headline.length > 160 || tagline.length > 400 || e.eyebrow.length > 120 || e.locality.length > 160) return { ok: false, error: "One of the headings is too long." };
  if (!["photo", "mosaic", "brand"].includes(e.treatment)) return { ok: false, error: "Unknown picture layout." };
  const have = new Set((current.hero.gallery ?? []).map((g) => g.src));
  for (const k of e.keepGallery) if (!have.has(k)) return { ok: false, error: "You can remove pictures from your page, but not add new ones here." };
  const gallery = (current.hero.gallery ?? []).filter((g) => e.keepGallery.includes(g.src));
  if (e.treatment === "mosaic" && gallery.length < 3) return { ok: false, error: "The picture mosaic needs three pictures. Keep three, or choose another layout." };
  const hero: NonNullable<OwnerProfile["hero"]> = { tagline, treatment: e.treatment, image: current.hero.image };
  if (e.headline.trim()) hero.headline = e.headline.trim();
  if (e.eyebrow.trim()) hero.eyebrow = e.eyebrow.trim();
  if (e.locality.trim()) hero.locality = e.locality.trim();
  if (gallery.length) hero.gallery = gallery;
  const profile: OwnerProfile = { hero };
  if (e.story && (e.story.title.trim() || e.story.body.trim())) {
    const body = paras(e.story.body);
    if (!e.story.title.trim() || !body.length) return { ok: false, error: "Your story needs a title and some text — or remove it." };
    if (body.length > 8 || e.story.title.length > 200 || body.some((p) => p.length > 2000)) return { ok: false, error: "Your story is too long." };
    profile.story = { title: e.story.title.trim(), body, ...(current.story?.eyebrow ? { eyebrow: current.story.eyebrow } : {}), ...(current.story?.source ? { source: current.story.source } : {}) };
  }
  const useful = e.useful.filter((u) => u.title.trim() || u.body.trim());
  if (useful.length > 6) return { ok: false, error: "At most six information sections." };
  const outU: NonNullable<OwnerProfile["useful"]> = [];
  for (const u of useful) {
    const body = paras(u.body);
    if (!u.title.trim() || !body.length) return { ok: false, error: "Each information section needs a title and some text — or remove it." };
    if (u.title.length > 200 || body.some((p) => p.length > 2000)) return { ok: false, error: "An information section is too long." };
    outU.push({ title: u.title.trim(), body });
  }
  if (outU.length) profile.useful = outU;
  if (current.emphasis) profile.emphasis = current.emphasis;
  if (current.layout) profile.layout = current.layout;
  return { ok: true, profile };
}
