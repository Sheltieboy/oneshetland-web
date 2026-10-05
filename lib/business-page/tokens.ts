/** The V2 palette and small helpers shared by Business Page V2 and the Launch Partner Preview (one design system). */
export const NAVY = "#032f4c";
export const CORAL = "#ff6b57";
export const TEAL = "#12b3d6";
export const LIME = "#c8f169";

/** Tile / accent colour per real OneShetland category (same values as Home V2 / Local V2). */
export const CAT_COLOR: Record<string, string> = { food_drink: "#c2410c", retail: "#7c3aed", services: "#0e7490", accommodation: "#15803d" };
export const catColorFor = (category: string | null | undefined): string => CAT_COLOR[category ?? ""] ?? "#4f46e5";

export const gbp = (n: number): string => `£${n.toFixed(2)}`;

/** Trim to whole sentences within `max` characters (Directory text can be long). */
export function shorten(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/** A brand colour is used only if it is a plain 6-digit hex. */
export function accentOf(brand: string | null | undefined, fallback: string): string {
  if (brand && /^#?[0-9a-f]{6}$/i.test(brand)) return brand.startsWith("#") ? brand : `#${brand}`;
  return fallback;
}
