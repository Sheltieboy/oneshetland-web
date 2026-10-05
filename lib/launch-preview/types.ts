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
}

export interface PreviewConfig {
  /** URL slug: /launch/{slug}. Also the key invites are issued under. */
  slug: string;
  businessName: string;
  /** Existing Directory record to read (read-only) for name, description and location. Null = use the config values only. */
  directoryBusinessId: string | null;

  hero: {
    /** Short line under the main headline, written for this business. */
    support: string;
  };

  business: {
    categoryLabel: string;
    locality: string;
    /** Used only if the Directory record cannot be read. */
    description: string;
    tags: string[];
    /** A public photograph of the business, already on its OneShetland listing. */
    image: { src: string; alt: string };
  };

  products: PreviewProduct[];
  /** What is searched for in the "search" mock. */
  searchTerm: string;
  /** Where the public information came from, shown to the owner in the footer of the products section. */
  sourceSite: { label: string; url: string };
}
