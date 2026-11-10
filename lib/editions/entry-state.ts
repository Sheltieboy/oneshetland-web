/** Plain (server-safe) helpers for the Editions entry screens: no "use client" here, so both server pages and client components can import them. */
export type EntryState = { slug: string; editions: number; inReview: number } | null;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One short sentence about where a Business or Hub stands with Editions. */
export function entryStateText(s: EntryState): string {
  if (!s) return "Not started";
  if (s.editions === 0) return "Ready: no Editions yet";
  return s.inReview > 0 ? `${plural(s.editions, "Edition", "Editions")} · ${s.inReview} in review` : plural(s.editions, "Edition", "Editions");
}

