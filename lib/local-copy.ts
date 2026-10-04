/**
 * local-copy.ts — what the Local hero says, derived from what the page can actually show.
 *
 * The hero used to promise "offers, bookable experiences and cashback partners" whether or not any existed. A
 * promise the page cannot keep is worse than a modest, true line, so the sentence is built from the modules that
 * will genuinely render.
 */
export function localHeroCopy(o: { areaLabel?: string; hasOffers: boolean; hasPasses: boolean; hasBookable: boolean }): string {
  const extras: string[] = [];
  if (o.hasOffers) extras.push("offers");
  if (o.hasPasses) extras.push("experiences");
  if (o.hasBookable) extras.push("bookings");
  const list = extras.length === 0 ? "" : extras.length === 1 ? extras[0] : `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}`;
  const where = o.areaLabel ? `in ${o.areaLabel}` : "across Shetland";
  if (!list) return `Shetland's trading community — the businesses ${where}, and who's hiring.`;
  return `Shetland's trading community — the businesses ${where}, with their ${list}.`;
}
