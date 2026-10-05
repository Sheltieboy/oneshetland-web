"use client";

import { BusinessLocationMap } from "@/components/local/BusinessLocationMap";

/**
 * The location block: an interactive map when Google serves one, and — whenever it can't (no key, blocked
 * referrer, slow network) — a deliberate branded location card. A customer never sees Google's error box or an
 * empty frame; the address and Directions are always there.
 */
export function LocationPanel({ lat, lng, name, accent, address, mapHref, decorativeFallback = true }: { lat: number | null; lng: number | null; name: string; accent: string; address: string | null; mapHref: string | null; /** Prepared drafts show a branded card when the map cannot load; the live page shows nothing instead. */ decorativeFallback?: boolean }) {
  const card = (
    <div className="relative isolate grid min-h-[220px] place-items-center overflow-hidden rounded-3xl p-6 text-center text-white shadow-soft" style={{ background: `linear-gradient(150deg, ${accent}, #1e1b4b)` }}>
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -right-10 -top-10 -z-10 h-64 w-64 opacity-20" fill="none" stroke="white" strokeWidth="2"><circle cx="100" cy="100" r="30" /><circle cx="100" cy="100" r="55" /><circle cx="100" cy="100" r="80" /></svg>
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/20">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
        </span>
        <p className="mt-3 font-display text-2xl font-bold leading-tight">{name}</p>
        {address && <p className="mt-1 text-sm text-white/80">{address}</p>}
        {mapHref && <a href={mapHref} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-bold text-ink">Open in Maps →</a>}
      </div>
    </div>
  );
  if (lat == null || lng == null) return decorativeFallback ? card : null;
  // Live: the map alone, so that when it cannot load nothing — not even an empty frame — is left behind.
  if (!decorativeFallback) return <BusinessLocationMap lat={lat} lng={lng} name={name} accent={accent} height={300} fallback={null} />;
  return <div className="overflow-hidden rounded-3xl bg-white shadow-soft"><BusinessLocationMap lat={lat} lng={lng} name={name} accent={accent} height={300} fallback={card} /></div>;
}
