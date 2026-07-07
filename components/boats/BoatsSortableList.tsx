"use client";

import { useMemo, useState } from "react";
import { type VesselSearchRow, BOATS } from "@/lib/boats-data";
import { BoatCard } from "@/components/boats/BoatsUI";

type BoatSort = "default" | "name" | "year_new" | "year_old" | "photos";

const SORT_OPTIONS: { key: BoatSort; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "name", label: "Name A–Z" },
  { key: "year_new", label: "Year (newest)" },
  { key: "year_old", label: "Year (oldest)" },
  { key: "photos", label: "Most photos" },
];

/** Pure client-side reorder of the already-loaded rows. 'default' leaves order untouched. */
function sortRows(rows: VesselSearchRow[], sort: BoatSort): VesselSearchRow[] {
  if (sort === "default") return rows;
  const r = [...rows];
  switch (sort) {
    case "name":
      return r.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, "en", { sensitivity: "base" }));
    case "year_new":
      return r.sort((a, b) => (b.built_year ?? -Infinity) - (a.built_year ?? -Infinity));
    case "year_old":
      return r.sort((a, b) => (a.built_year ?? Infinity) - (b.built_year ?? Infinity));
    case "photos":
      return r.sort((a, b) => (b.media_asset_count ?? 0) - (a.media_asset_count ?? 0));
    default:
      return r;
  }
}

/**
 * Sortable vessel grid. Renders a small chip-style sort control (matching the
 * page's filter chips) above the grid and reorders the loaded rows client-side.
 */
export function BoatsSortableList({ rows, heroes }: { rows: VesselSearchRow[]; heroes: Record<string, string> }) {
  const [sort, setSort] = useState<BoatSort>("default");
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <div>
      {rows.length > 1 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Sort boats">
          <span className="shrink-0 text-sm font-semibold text-ink-muted">Sort</span>
          {SORT_OPTIONS.map((o) => {
            const on = sort === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setSort(o.key)}
                aria-pressed={on}
                className={"shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition " + (on ? "text-white shadow-soft" : "border border-line-strong text-ink-soft hover:bg-sand")}
                style={on ? { background: BOATS } : undefined}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((v) => <BoatCard key={v.id} v={v} hero={heroes[v.id]} />)}
      </div>
    </div>
  );
}
