"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

/**
 * Read-only embedded map of a business location — web mirror of the app's
 * BusinessLocationMap. Reuses the shared Google Maps loader (lib/google-maps.ts).
 * Renders nothing (or the caller's `fallback`) when there's no key, the script
 * fails to load, or Google rejects the key — e.g. a referrer the key does not
 * allow, which makes Google paint its own "Sorry! Something went wrong" box. That
 * box is never shown to a customer: Google's gm_authFailure hook, plus a short
 * load timeout, switch to the fallback instead.
 */
export function BusinessLocationMap({
  lat,
  lng,
  name,
  accent,
  height = 220,
  fallback = null,
}: {
  lat: number;
  lng: number;
  name: string;
  accent: string;
  height?: number;
  /** Shown instead of the map whenever it cannot be shown properly. Default: nothing. */
  fallback?: ReactNode;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");

  useEffect(() => {
    let alive = true;
    // Google calls this when the key is rejected (referrer, billing, API not enabled) AFTER it has drawn its error box.
    const prevAuth = window.gm_authFailure;
    window.gm_authFailure = () => { if (alive) setState("hidden"); prevAuth?.(); };
    // A map that has not appeared in a few seconds is not going to.
    const timer = setTimeout(() => { if (alive) setState((st) => (st === "loading" ? "hidden" : st)); }, 8000);
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
    return () => { alive = false; clearTimeout(timer); window.gm_authFailure = prevAuth; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "hidden") return <>{fallback}</>;

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
