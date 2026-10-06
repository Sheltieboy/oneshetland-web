/**
 * Launch Partner Preview — the configuration one preview page is built from.
 *
 * A preview is DATA, not bespoke JSX: to prepare the next business, add one file under ./partners and register it.
 * Everything a preview says about a business comes from here (or from its existing public Directory record, read-only);
 * everything it says about OneShetland is shared copy in the page component.
 *
 * Nothing in a preview is a record in OneShetland: products below are pictures of what is already public on the
 * business's own website, shown so the owner can judge the experience. They are never written to the database.
 */

export interface PreviewProduct {
  id: string;
  title: string;
  /** Price in pounds, as displayed publicly on the business's own site when the preview was prepared. */
  price: number;
  image: string;
  /** One honest line, in our words, describing the item. */
  blurb: string;
  /** The public page on the business's own site this item (name, price, picture) was taken from. Recorded for the owner and for review. */
  source?: string;
}

export interface PreviewPhoto {
  src: string; alt: string;
  /** CSS object-position for cropping a wide photo into a tall frame, e.g. '30% 50%'. */ position?: string;
  /** Optional explicit role. A logo is shown whole (contained); omitted, the role is worked out from the file name, alt text and the business's logo field (lib/business-page/image-role.ts). */
  role?: 'logo' | 'photo';
}

/** An experience the business's own public site already offers, shown as it COULD look on OneShetland. Never bookable. */
export interface PreviewExperience {
  title: string;
  blurb: string;
  image: PreviewPhoto;
  /** Short facts exactly as the business states them publicly (duration, price…). Omit anything not public. */
  meta?: string;
  price?: string;
  source: string;
}

/** A source of public information used on the page. Every external product, price, image or description traces to one. */
export interface PreviewSource { label: string; url: string; used: string }

/** Where a business sits in OneShetland's real categories (drives tile colour and label, as on Home V2 / Local V2). */
export type PreviewCategory = 'retail' | 'food_drink' | 'services';

/** The possibilities cards shown in "Things you could do — if you want to". Always labelled as examples. */
export type PreviewPossibility = 'offers' | 'rewards' | 'discovery';

export interface PreviewConfig {
  /** URL slug: /launch/{slug}. Also the key invites are issued under. */
  slug: string;
  businessName: string;
  /** Existing Directory record to read (read-only) for name, description and location. Null = use the config values only. */
  directoryBusinessId: string | null;

  /**
   * 'live'    — the claim button leads into the real claim flow (needs a database invitation).
   * 'holding' — the safe default for a preview still being prepared: the button explains that claiming is not open yet,
   *             and the claim page itself refuses. Switch to 'live' only when the invitation is actually being issued.
   * Omitted = 'live' (Love From Shetland, already approved).
   */
  claim?: 'live' | 'holding';
  /** One line naming the pitch ("Products + experiences"). Shown on the internal review index only. */
  positioning?: string;
  /**
   * The short personal line that opens the outreach email, WHERE ONE HAS BEEN WRITTEN FOR THIS BUSINESS. Never generated
   * from data; absent means the email draft carries a clear prompt for Darren to write one. Private: not shown on the preview.
   */
  outreachOpening?: string;

  hero: {
    /** Short line under the main headline, written for this business. */
    support: string;
    /** Three display lines; the last is accented. Defaults to the shop headline. */
    headline?: [string, string, string];
    /** 'photo' (default) shows the business photo. 'ambient' is for businesses whose own site has no strong photograph. */
    treatment?: 'photo' | 'ambient';
    /** CSS object-position for the ambient hero background (defaults to the photo's own position). */
    position?: string;
    /** Small pictures overlapping the hero photo; defaults to the first two products. */
    collage?: { src: string; alt: string; label: string; price?: number }[];
  };

  business: {
    categoryLabel: string;
    /** The business's real OneShetland category; default 'retail'. */
    category?: PreviewCategory;
    /** Short word on the Home tile / Local card / search row, e.g. "Shop", "Eat & drink". Default "Shop". */
    pillarLabel?: string;
    /** The OneShetland logo already on the listing (shown small, on tiles). Falls back to the photo. */
    logo?: string;
    locality: string;
    /** Used only if the Directory record cannot be read. */
    description: string;
    tags: string[];
    /** A public photograph of the business, already on its OneShetland listing. */
    image: PreviewPhoto;
  };

  /** 0–6 representative items. Empty for a business whose proposition is not a shop. */
  products: PreviewProduct[];
  /** Heading override for the products section: [plain, accented]. */
  productsTitle?: [string, string];
  /** Extra line under the products, e.g. a clarification about makers. */
  productsNote?: string;
  /** A genuine experience from the business's own site, if there is one. */
  experience?: PreviewExperience;
  /** Shows how a booking/reservation entry could appear. Only where the business's own site really takes bookings. */
  booking?: { cta: string; line: string };
  /** The business story, using only what its own public material supports. */
  story?: { eyebrow: string; title: [string, string]; body: string[]; source: string };
  /** Cards for "Things you could do". Default: offers, rewards, discovery. */
  possibilities?: PreviewPossibility[];
  /** Extra sentence on the Rewards card, for an example specific to the business. Clearly an example. */
  rewardsNote?: string;
  /** Show "Already selling online?" (default: true when there are products). */
  catalogue?: boolean;
  /** Launch-offer line about appearing across OneShetland; default "Your products can appear across OneShetland". */
  appearLine?: string;
  /** Replaces step 4 of the six steps, for a business with no catalogue. */
  stepFour?: [string, string];
  /** What is searched for in the "search" mock. */
  searchTerm: string;
  /** The main public site, linked under the products. */
  sourceSite: { label: string; url: string };
  /** Every source of public information used. */
  sources: PreviewSource[];
}
