"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import { hasValidPin } from "@/lib/be-found";

/**
 * "Set your location on the map" — drag a pin, don't type coordinates.
 *
 * Reuses the shared Google Maps loader that already powers the read-only
 * BusinessLocationMap on the public listing, so this adds no dependency and no
 * geocoding: the owner knows where their own shop is far better than an address
 * parser does, and dragging is the honest way to say it.
 *
 * If the map can't load — no key, offline, blocked — the owner is not left
 * stuck. Coordinates appear as a last resort, clearly labelled as such, because
 * the alternative is an essential listing milestone nobody can ever complete.
 */

/** Lerwick. Somewhere to start when a business has never had a pin. */
const SHETLAND = { lat: 60.1546, lng: -1.1494 };

export function MapPinPicker({
  lat, lng, onChange, accent,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  accent: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const markerRef = useRef<{ setPosition: (p: { lat: number; lng: number }) => void } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const has = hasValidPin(lat, lng);

  // The map is created once. Later position changes are pushed to the marker
  // rather than rebuilding it, so dragging never fights a re-render.
  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then(() => {
        if (!alive || !mapEl.current) return;
        const g = (window as unknown as { google: any }).google;   // eslint-disable-line @typescript-eslint/no-explicit-any
        const start = hasValidPin(lat, lng) ? { lat: lat as number, lng: lng as number } : SHETLAND;
        const map = new g.maps.Map(mapEl.current, {
          center: start,
          zoom: hasValidPin(lat, lng) ? 16 : 12,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
          gestureHandling: "cooperative",
        });
        const marker = new g.maps.Marker({ position: start, map, draggable: true });
        markerRef.current = marker;
        const place = (p: { lat: () => number; lng: () => number }) => {
          marker.setPosition({ lat: p.lat(), lng: p.lng() });
          onChange(p.lat(), p.lng());
        };
        marker.addListener("dragend", (e: { latLng: { lat: () => number; lng: () => number } }) => place(e.latLng));
        // Tapping the map is the obvious gesture, and much easier on a phone
        // than dragging a pin across the screen.
        map.addListener("click", (e: { latLng: { lat: () => number; lng: () => number } }) => place(e.latLng));
        setState("ready");
      })
      .catch(() => { if (alive) setState("unavailable"); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state === "ready" && markerRef.current && hasValidPin(lat, lng)) {
      markerRef.current.setPosition({ lat: lat as number, lng: lng as number });
    }
  }, [lat, lng, state]);

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-ink-soft">Your location on the map</label>
      <p className="mb-2 text-sm text-ink-muted">
        {has
          ? "Drag the pin, or tap the map, if it isn't quite right."
          : "Tap the map where your business is, so customers can find you."}
      </p>

      {state !== "unavailable" && (
        <div className="relative w-full overflow-hidden rounded-xl border border-line" style={{ height: 260 }}>
          <div ref={mapEl} className="absolute inset-0" />
          {state === "loading" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm" style={{ color: accent }}>
              Loading map…
            </div>
          )}
        </div>
      )}

      {state === "unavailable" && (
        <div className="rounded-xl border border-line bg-sand/40 p-4">
          <p className="text-sm font-semibold text-ink">The map couldn&apos;t load just now.</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            You can still set your location by hand if you know the coordinates.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink shadow-soft outline-none"
              inputMode="decimal" placeholder="Latitude" defaultValue={lat ?? ""}
              onChange={(e) => onChange(parse(e.target.value), lng)}
            />
            <input
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-ink shadow-soft outline-none"
              inputMode="decimal" placeholder="Longitude" defaultValue={lng ?? ""}
              onChange={(e) => onChange(lat, parse(e.target.value))}
            />
          </div>
        </div>
      )}

      {has && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="mt-2 text-sm font-semibold text-ink-soft underline hover:text-ink"
        >
          Remove the pin
        </button>
      )}
    </div>
  );
}

function parse(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}
