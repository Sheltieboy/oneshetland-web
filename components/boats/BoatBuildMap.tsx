"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadGoogleMaps, GOOGLE_MAPS_KEY } from "@/lib/google-maps";
import { type BuildPlaceCount, BOATS } from "@/lib/boats-data";

/**
 * Plots where the Shetland fleet was built — one marker per boat-building
 * town, sized by how many boats came from there. Mirrors the app's
 * BoatBuildMap (react-native-maps) using the Google Maps JS loader.
 * Falls back to a ports bar breakdown when no Maps key is configured or
 * the script fails to load.
 */
export function BoatBuildMap({ places }: { places: BuildPlaceCount[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(GOOGLE_MAPS_KEY ? "loading" : "fallback");

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !places.length) { setStatus("fallback"); return; }
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        const map = new g.maps.Map(ref.current, {
          center: { lat: 58.4, lng: -0.5 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const maxCount = places.reduce((m, p) => Math.max(m, p.count), 1);
        const info = new g.maps.InfoWindow();
        for (const p of places) {
          const size = 22 + Math.round((p.count / maxCount) * 26);
          const marker = new g.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            label: { text: String(p.count), color: "#fff", fontSize: "11px", fontWeight: "900" },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: size / 2,
              fillColor: BOATS,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
            title: `${p.label} — ${p.count} boat${p.count === 1 ? "" : "s"}`,
          });
          marker.addListener("click", () => {
            info.setContent(`<div style="font-weight:700;font-size:13px">${p.label}</div><div style="font-size:12px;color:#555">${p.count} boat${p.count === 1 ? "" : "s"} built here</div>`);
            info.open(map, marker);
          });
        }
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("fallback"); });
    return () => { cancelled = true; };
  }, [places]);

  if (status === "fallback") return <PortsBars places={places} />;

  return (
    <div className="relative">
      <div ref={ref} className="h-72 w-full overflow-hidden rounded-card border border-line" style={{ background: "#cfe0ee" }} />
      {status === "loading" && <div className="absolute inset-0 grid place-items-center text-sm text-ink-muted">Loading map…</div>}
    </div>
  );
}

/** Builders/ports bar breakdown — used when the map can't render. */
function PortsBars({ places }: { places: BuildPlaceCount[] }) {
  const max = Math.max(...places.map((p) => p.count), 1);
  return (
    <div className="space-y-1.5">
      {places.map((p) => (
        <Link key={p.key} href={`/boats?builder=${encodeURIComponent(p.label.replace(/\s*\(.*\)$/, ""))}`} className="flex items-center gap-2 text-sm hover:opacity-80">
          <span className="w-28 shrink-0 truncate text-ink-muted">{p.label}</span>
          <span className="h-3 rounded-pill" style={{ width: `${Math.max(6, (p.count / max) * 100)}%`, background: BOATS }} />
          <span className="text-xs font-semibold text-ink-faint">{p.count}</span>
        </Link>
      ))}
    </div>
  );
}
