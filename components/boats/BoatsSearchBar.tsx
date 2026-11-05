"use client";

import { SiteSearch } from "@/components/search/SiteSearch";

/** The Boats search box: the shared live search, scoped to boats, keeping the decade / photos / builder filters on Enter. */
export function BoatsSearchBar({ q, decade, photos, builder, accent }: { q: string; decade?: string; photos?: string; builder?: string; accent: string }) {
  return (
    <div className="mb-3">
      <SiteSearch scope="boat" variant="bar" accent={accent} initial={q} label="Search boats" placeholder="Search by name or number — e.g. Brilliant, LK123…"
        submit={{ path: "/boats", params: { decade, photos, builder } }} />
    </div>
  );
}
