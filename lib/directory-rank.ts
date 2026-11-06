/**
 * directory-rank.ts — the Directory's three tiers, in one place.
 *
 *   0  Featured       active pro/premium (the same test as the Directory's Featured row)
 *   1  Owner-managed  an approved claim OR a listing created by its owner (the ownership record, not the is_claimed flag alone)
 *   2  Unclaimed      everything else
 *
 * The tier is computed by the database (local_businesses_public.directory_rank, migration 20261207000000), because the list
 * is cut at DIRECTORY_LIST_LIMIT and a tier applied after the cut would rank the wrong 200. Within a tier the ORDER IS UNCHANGED:
 * verified first, then name. This file only holds the DB column name and the comparator used when two result sets are merged.
 */
export const DIRECTORY_RANK_COL = "directory_rank";

export type DirectoryRankable = { directory_rank?: number | null; is_verified?: boolean | null; name: string };

/** Tier first (0, 1, 2; a row with no tier sorts last), then verified, then name — the Directory's existing in-tier order. */
export function compareDirectory(a: DirectoryRankable, b: DirectoryRankable): number {
  const ta = a.directory_rank ?? 2, tb = b.directory_rank ?? 2;
  return ta - tb || Number(!!b.is_verified) - Number(!!a.is_verified) || a.name.localeCompare(b.name);
}
