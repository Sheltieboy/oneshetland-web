/**
 * Business Page V2 — the shapes it is built from.
 *
 * Two inputs, kept apart on purpose:
 *   • FACTS  — what OneShetland already holds about the business (Directory record, real products, offers, services,
 *              events). These are the only things a customer ever transacts with.
 *   • DRAFT  — presentation prepared in Admin (PageDraft): the headline, the story, which picture leads, the order
 *              emphasis, and clearly-labelled EXAMPLE items for sections the business has no real content for yet.
 *
 * The page model (BusinessPageModel) is the merge of the two, with every item marked `example` or real. Nothing in
 * a draft is a record anywhere else, and a draft never changes the facts.
 */
import type { PreviewExperience, PreviewPhoto, PreviewProduct } from "../launch-preview/types.ts";

/** Everything a Business Page V2 can show. Order is decided by sections.ts; absent content means the section is skipped. */
export type SectionId =
  | "actions" | "hours" | "story" | "shop" | "offers" | "book" | "experience" | "rewards" | "events" | "useful" | "location" | "contact";

/** Which of the business's strengths leads the page. Chosen per business in Admin, or inferred from its content. */
export type Emphasis = "story_then_shop" | "shop_first" | "book_first" | "experience_first";
export const EMPHASES: readonly Emphasis[] = ["story_then_shop", "shop_first", "book_first", "experience_first"];
export const EMPHASIS_LABEL: Record<Emphasis, string> = {
  story_then_shop: "Story, then shop",
  shop_first: "Shop first",
  book_first: "Booking first",
  experience_first: "Experience first",
};

/** The prepared Business Page V2 draft — stored as `page_config` on a launch-partner campaign. Private until published. */
export interface PageDraft {
  version: 1;
  emphasis?: Emphasis;
  /** Optional explicit order of the middle sections (hero is always first; location and contact always close the page). */
  layout?: SectionId[];
  hero: {
    /** Display headline. Defaults to the business name. */
    headline?: string;
    /** One line under the name. */
    tagline: string;
    image: PreviewPhoto;
  };
  story?: { eyebrow?: string; title: string; body: string[]; source?: string };
  /** EXAMPLE items shown only while the business has no real products. Never for sale; replaced by the real catalogue. */
  products?: PreviewProduct[];
  productsTitle?: string;
  /** EXAMPLE experience (from the business's own public site). */
  experience?: PreviewExperience;
  /** EXAMPLE of how a booking entry could look — only where the business really takes bookings elsewhere. */
  booking?: { cta: string; line: string };
  /** An idea for rewards/offers, worded as a possibility. Shown only if the business has no real programme. */
  rewards?: { title: string; body: string };
  /** "Useful local information" / a second, shorter story (e.g. a social-enterprise note). */
  useful?: { title: string; body: string[] }[];
  /** Internal review notes. Admin only — never rendered on the page. */
  notes?: string;
}

export interface ModelItem { id: string; title: string; pricePounds: number; image: string | null; blurb?: string; href?: string; example: boolean }
export interface ModelEvent { id: string; title: string; startsAt: string; venue: string | null }
export interface ModelOffer { id: string; title: string; description: string | null; image: string | null }
export interface ModelService { id: string; name: string; description: string | null; durationMinutes: number | null; pricePence: number | null }

/** What the page renders. Built by model.ts; every field is plain data (safe to serialise). */
export interface BusinessPageModel {
  mode: "draft" | "live";
  emphasis: Emphasis;
  layout?: SectionId[];
  identity: {
    id: string; name: string; categoryLabel: string | null; categoryKey: string | null; locality: string | null;
    address: string | null; verified: boolean; claimed: boolean; logo: string | null; accent: string;
  };
  hero: { headline: string; tagline: string | null; image: PreviewPhoto | null };
  story: { eyebrow: string; title: string; body: string[]; source?: string } | null;
  about: string | null;
  shop: { title: string; items: ModelItem[]; example: boolean } | null;
  offers: ModelOffer[];
  book: { example: boolean; cta: string; line: string; services: ModelService[] } | null;
  experience: (PreviewExperience & { example: true }) | null;
  rewards: { example: boolean; title: string; body: string } | null;
  events: ModelEvent[];
  useful: { title: string; body: string[] }[];
  location: { address: string | null; lat: number | null; lng: number | null; mapHref: string | null };
  contact: { phone: string | null; website: string | null; email: string | null };
  hours: { hours: Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>> | null; until: string | null };
}
