"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSavedBoats, loadRecentBoats, clearRecentBoats, type VesselStub, BOATS } from "@/lib/boats-data";

/**
 * Client island for the boats landing: surfaces the viewer's Saved and
 * Recently-viewed boats from localStorage. Mirrors the app's da-boats rows.
 * Renders nothing on the server / before hydration to avoid mismatch.
 */
export function BoatsSavedRecent() {
  const [saved, setSaved] = useState<VesselStub[] | null>(null);
  const [recent, setRecent] = useState<VesselStub[]>([]);

  useEffect(() => {
    setSaved(loadSavedBoats());
    setRecent(loadRecentBoats());
  }, []);

  if (saved === null) return null; // not hydrated yet

  // Suppress recent entries that are already saved, to avoid a duplicate row.
  const savedIds = new Set(saved.map((b) => b.id));
  const recentOnly = recent.filter((r) => !savedIds.has(r.id));

  if (saved.length === 0 && recentOnly.length === 0) return null;

  return (
    <div className="mb-10 space-y-8">
      {saved.length > 0 && <StubRow title="Saved boats" stubs={saved} />}
      {recentOnly.length > 0 && (
        <StubRow
          title="Recently viewed"
          stubs={recentOnly}
          onClear={() => { clearRecentBoats(); setRecent([]); }}
        />
      )}
    </div>
  );
}

function StubRow({ title, stubs, onClear }: { title: string; stubs: VesselStub[]; onClear?: () => void }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {onClear && <button onClick={onClear} className="text-xs font-semibold text-ink-faint hover:text-ink">Clear</button>}
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stubs.map((s) => (
          <Link key={s.id} href={`/boats/${s.id}`} className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <div className="relative h-24 overflow-hidden" style={{ background: `${BOATS}14` }}>
              {s.hero_url ? (
                <img src={s.hero_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl opacity-25" aria-hidden="true">⚓</div>
              )}
              {s.lk_number && <span className="absolute bottom-1.5 left-1.5 rounded-pill px-2 py-0.5 text-[11px] font-black text-white shadow" style={{ background: BOATS }}>{s.lk_number}</span>}
            </div>
            <div className="p-2.5">
              <p className="truncate font-display text-sm font-bold leading-tight text-ink group-hover:underline">{s.canonical_name}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{s.built_year ? `Built ${s.built_year}` : "Year unknown"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
