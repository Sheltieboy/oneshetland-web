"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

/**
 * Read-only embedded map of a business location — web mirror of the app's
 * BusinessLocationMap. Reuses the shared Google Maps loader (lib/google-maps.ts).
 * Renders nothing when there's no key / load fails, so the page's directions
 * link remains the fallback.
 */
export function BusinessLocationMap({
  lat,
  lng,
  name,
  accent,
  height = 220,
}: {
  lat: number;
  lng: number;
  name: string;
  accent: string;
  height?: number;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");

  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then(() => {
        if (!alive || !mapEl.current) return;
        const g = window.google!;
        const center = { lat, lng };
        const map = new g.maps.Map(mapEl.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });
        new g.maps.Marker({ position: center, map, title: name });
        setState("ready");
      })
      .catch(() => {
        if (alive) setState("hidden");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "hidden") return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-line"
      style={{ height }}
    >
      <div ref={mapEl} className="absolute inset-0" />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-muted" style={{ color: accent }}>
          Loading map…
        </div>
      )}
    </div>
  );
}
