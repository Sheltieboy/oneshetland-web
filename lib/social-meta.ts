/** Shared display metadata for social post kinds (safe for client + server). */

export const KIND_META: Record<string, { label: string; color: string }> = {
  wird_of_day: { label: "Wird o' da Day", color: "#12b3d6" },
  whats_on_roundup: { label: "Whit's On roundup", color: "#d4921a" },
  event_spotlight: { label: "Event spotlight", color: "#7c3aed" },
  offer_roundup: { label: "Offer roundup", color: "#2a8b5c" },
  business_spotlight: { label: "Business spotlight", color: "#4f46e5" },
  ship_day: { label: "Ship day", color: "#1e3a8a" },
  new_business: { label: "New business", color: "#e0722a" },
  almanac_article: { label: "Almanac", color: "#9f1239" },
  jobs_roundup: { label: "Jobs roundup", color: "#2a8b5c" },
  custom: { label: "Custom", color: "#6b7280" },
};

export const kindMeta = (kind: string) => KIND_META[kind] ?? KIND_META.custom;
