/**
 * nav-groups.ts — how the mobile menu groups the site's destinations.
 *
 * The destinations themselves (labels, links, colours) come from lib/sections.ts, the single source for the header, footer and home grid. This only
 * decides ORDER and GROUPING. Any section not named below still appears, in a final "More" group, so a destination can never be lost from the menu.
 */
import type { Section } from "@/lib/sections";

export type NavGroup = { title: string | null; featured?: boolean; items: Section[] };

/** The four most-used sections, shown first and larger. */
const FEATURED = ["whats-on", "local", "shop", "jobs"];
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Find & get things done", keys: ["directory", "get-it-done", "fetch"] },
  { title: "Island life", keys: ["cruise", "notices", "hubs", "boats", "memories", "spik", "games"] },
];

export function mobileNavGroups(primary: Section[], more: Section[]): NavGroup[] {
  const all = [...primary, ...more];
  const byKey = new Map(all.map((s) => [s.key, s]));
  const used = new Set<string>();
  const take = (keys: string[]) => keys.flatMap((k) => { const s = byKey.get(k); if (!s || used.has(k)) return []; used.add(k); return [s]; });
  const out: NavGroup[] = [{ title: null, featured: true, items: take(FEATURED) }];
  for (const g of GROUPS) out.push({ title: g.title, items: take(g.keys) });
  const rest = all.filter((s) => !used.has(s.key));
  if (rest.length) out.push({ title: "More", items: rest });
  return out.filter((g) => g.items.length > 0);
}
