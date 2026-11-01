/** Shared display metadata for social post kinds (safe for client + server). */

export const KIND_META: Record<string, { label: string; color: string }> = {
  wird_of_day: { label: "Word of the day", color: "#12b3d6" },
  whats_on_roundup: { label: "What's On roundup", color: "#d4921a" },
  event_spotlight: { label: "Event spotlight", color: "#7c3aed" },
  offer_roundup: { label: "Offer roundup", color: "#2a8b5c" },
  business_spotlight: { label: "Business spotlight", color: "#4f46e5" },
  ship_day: { label: "Ship day", color: "#1e3a8a" },
  new_business: { label: "New business", color: "#e0722a" },
  new_product: { label: "New product", color: "#7c3aed" },
  almanac_article: { label: "Almanac", color: "#9f1239" },
  jobs_roundup: { label: "Jobs roundup", color: "#2a8b5c" },
  notice_update: { label: "Notice", color: "#0f766e" },
  essential_alert: { label: "Essential alert", color: "#b91c1c" },
  aald_memory: { label: "Aald Memories", color: "#92400e" },
  hub_community: { label: "Hubs & community", color: "#0369a1" },
  game_challenge: { label: "Games", color: "#059669" },
  cruise_visit: { label: "Cruise visit", color: "#1e3a8a" },
  custom: { label: "Custom", color: "#6b7280" },
};

export const kindMeta = (kind: string) => KIND_META[kind] ?? KIND_META.custom;

/** "Mon, Wed, Sat · about 19:00" from the recipe's own config; empty when it has no fixed schedule. */
export function recipeSchedule(config: Record<string, unknown>): string {
  const days = Array.isArray(config.weekdays) ? (config.weekdays as string[]).join(", ") : "";
  const hour = typeof config.hour === "number" ? `about ${String(config.hour).padStart(2, "0")}:00` : "";
  return [days, hour].filter(Boolean).join(" · ");
}

