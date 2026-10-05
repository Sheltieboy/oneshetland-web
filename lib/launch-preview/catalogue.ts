/**
 * The three ways a launch partner can get a catalogue onto OneShetland, and what is TRUE of each today.
 *
 * One place, shared by every preview (and anything else that describes catalogue setup), so a capability is switched
 * on here once and no preview needs editing. CSV import is live and production-accepted; connecting a shop through
 * an API (Shopify, WooCommerce, Square) is NOT built — it must keep saying "Coming next" until it is.
 */
export type CatalogueStatus = "available" | "coming_next";

export interface CatalogueOption {
  id: "import" | "manual" | "connect";
  title: string;
  body: string;
  status: CatalogueStatus;
  chip: string;
}

export const CATALOGUE_OPTIONS: readonly CatalogueOption[] = [
  { id: "import", title: "Import products", body: "Upload your existing catalogue and review everything before anything goes live.", status: "available", chip: "Available" },
  { id: "manual", title: "Add manually", body: "Add individual products yourself, with photos, one at a time.", status: "available", chip: "Available" },
  { id: "connect", title: "Connect your shop", body: "Shopify · WooCommerce · Square", status: "coming_next", chip: "Coming next" },
];

/** Shown under the three options. Says what is live and what is not; never implies an API connection exists. */
export const CATALOGUE_FOOTNOTE =
  "Everything you bring in arrives as a draft that only you can see. You review it, and you decide what to publish. Connecting a shop is still being built — we'll only tell you it works once it does.";
