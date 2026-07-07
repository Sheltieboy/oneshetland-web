"use client";

import { useMemo, useState } from "react";
import { HUB_TYPE_LABELS, type Hub } from "@/lib/hubs-data";
import { HubCard } from "./HubCard";

/** Client-side keyword search over an already-filtered hub list (mirrors the app). */
export function HubSearchGrid({ hubs, typeFiltered }: { hubs: Hub[]; typeFiltered: boolean }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hubs;
    return hubs.filter((h) =>
      h.name.toLowerCase().includes(q) ||
      (h.area ?? "").toLowerCase().includes(q) ||
      (h.description ?? "").toLowerCase().includes(q) ||
      HUB_TYPE_LABELS[h.type].toLowerCase().includes(q),
    );
  }, [hubs, query]);

  return (
    <>
      {/* Search box */}
      <div className="relative mt-8">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">🔍</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search hubs by name…"
          aria-label="Search hubs by name"
          className="w-full rounded-pill border border-line-strong bg-paper py-3 pl-11 pr-11 text-ink shadow-soft outline-none transition focus:border-current"
          style={{ caretColor: "currentColor" }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full text-ink-muted transition hover:bg-sand"
          >
            ✕
          </button>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-paper p-12 text-center shadow-soft">
          <h3 className="font-display text-xl font-bold">Nae hubs here yet</h3>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            {query || typeFiltered ? "No hubs match — try a different search." : "Be the first to start a community hub."}
          </p>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((h) => (
            <HubCard key={h.id} hub={h} />
          ))}
        </div>
      )}
    </>
  );
}
