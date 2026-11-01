/**
 * business-match.ts — "is this business already listed?"
 *
 * Used by the /business finder (to send an owner to the claim journey for the listing that already exists) and by the add-a-business form
 * (to stop a duplicate being created for something that is already in the Directory). Pure: no network, so it can be tested exhaustively.
 *
 * A match NEVER grants anything. Claiming an existing listing still goes through the manual claim review; creating a new one never touches an
 * existing record. This only decides what to SHOW.
 */

export type ListedBusiness = { id: string; name: string; slug: string | null; category: string | null; address: string | null; is_claimed: boolean };

const LEGAL = new Set(["ltd", "limited", "llp", "plc", "co", "company", "inc"]);

/** "Anderson & Co. Ltd" -> "anderson and". Lower-case, accents and punctuation removed, "&" read as "and", legal suffixes and a leading "the" dropped. */
export function normaliseName(raw: string): string {
  const base = raw
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const words = base.split(" ").filter(Boolean).filter((w) => !LEGAL.has(w));
  if (words[0] === "the" && words.length > 1) words.shift();
  return words.join(" ");
}

export type MatchKind = "exact" | "strong" | "possible";

/** How alike a typed name and a listed name are. exact = same once normalised; strong = one contains the other (or nearly all words shared); else possible. */
export function matchKind(typed: string, listed: string): MatchKind {
  const a = normaliseName(typed), b = normaliseName(listed);
  if (!a || !b) return "possible";
  if (a === b) return "exact";
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 5 && ` ${long} `.includes(` ${short} `)) return "strong";
  const wa = new Set(a.split(" ")), wb = new Set(b.split(" "));
  const shared = [...wa].filter((w) => wb.has(w)).length;
  const overlap = shared / Math.min(wa.size, wb.size);
  return shared >= 2 && overlap >= 0.8 ? "strong" : "possible";
}

/** A search term safe to put inside a PostgREST ilike: no wildcards, commas or brackets; empty if too short to be useful. */
export function searchTerm(raw: string): string {
  const t = raw.replace(/[%_,()*\\"]/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 2 ? t.slice(0, 60) : "";
}

/** The most distinctive single word of a name, for a second try when the whole phrase finds nothing. */
export function distinctiveWord(raw: string): string {
  const words = normaliseName(raw).split(" ").filter((w) => w.length >= 3 && w !== "and");
  return words.sort((x, y) => y.length - x.length)[0] ?? "";
}

/** Existing listings that the typed name might be: strongest first, claimed ones last (nothing to claim there). */
export function rankMatches(typed: string, found: ListedBusiness[]): (ListedBusiness & { kind: MatchKind })[] {
  const order: Record<MatchKind, number> = { exact: 0, strong: 1, possible: 2 };
  return found
    .map((b) => ({ ...b, kind: matchKind(typed, b.name) }))
    .sort((p, q) => order[p.kind] - order[q.kind] || Number(p.is_claimed) - Number(q.is_claimed) || p.name.localeCompare(q.name));
}

/** True if creating a NEW listing under this name would very probably duplicate one that is already there. */
export function likelyDuplicate(typed: string, found: ListedBusiness[]): boolean {
  return rankMatches(typed, found).some((m) => m.kind === "exact" || m.kind === "strong");
}

export const claimHref = (b: Pick<ListedBusiness, "id" | "slug">) => `/directory/${b.slug || b.id}/claim`;
export const listingHref = (b: Pick<ListedBusiness, "id" | "slug">) => `/directory/${b.slug || b.id}`;
export const addHref = (typed: string, plan?: string | null) => {
  const p = new URLSearchParams();
  const t = typed.trim().slice(0, 80);
  if (t) p.set("name", t);
  if (plan === "pro" || plan === "premium") p.set("plan", plan);
  const qs = p.toString();
  return qs ? `/directory/new?${qs}` : "/directory/new";
};

/** Searches the public directory view (anyone may read it) by name; falls back to the most distinctive word. `sb` is a Supabase client. */
export async function findListed(sb: any, typed: string, limit = 8): Promise<(ListedBusiness & { kind: MatchKind })[]> {
  const term = searchTerm(typed);
  if (!term) return [];
  const run = async (t: string): Promise<ListedBusiness[]> => {
    const { data, error } = await sb.from("local_businesses_public").select("id, name, slug, category, address, is_claimed")
      .eq("is_active", true).ilike("name", `%${t}%`).order("name", { ascending: true }).limit(limit);
    if (error) throw error;
    return (data ?? []) as ListedBusiness[];
  };
  let rows = await run(term);
  if (rows.length === 0 && term.includes(" ")) { const w = distinctiveWord(term); if (w && w !== term.toLowerCase()) rows = await run(w); }
  return rankMatches(term, rows);
}

/**
 * Whether the add-a-business form may create a new listing right now. A probable duplicate blocks it unless the person has said, explicitly, that
 * theirs is a different business. (Never decides anything about an EXISTING listing: it cannot be claimed this way.)
 */
export function createDecision(typed: string, found: ListedBusiness[], confirmedDifferent: boolean): { allowed: boolean; reason: "ok" | "probable-duplicate" } {
  if (!likelyDuplicate(typed, found)) return { allowed: true, reason: "ok" };
  return confirmedDifferent ? { allowed: true, reason: "ok" } : { allowed: false, reason: "probable-duplicate" };
}
