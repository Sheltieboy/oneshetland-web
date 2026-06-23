"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { CRUISE_ACCENT, LERWICK } from "@/lib/cruise-shared";
import type { Origin } from "@/lib/cruise-stats";

/** Where ships sail from: every origin port, sized by frequency, lined to Lerwick. */
export function SeasonMap({ origins }: { origins: Origin[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || map) return;
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12, attribution: "&copy; OpenStreetMap" }).addTo(map);

      const maxCount = Math.max(1, ...origins.map((o) => o.count));
      // lines from each origin to Lerwick
      origins.forEach((o) => {
        L.polyline([[o.lat, o.lng], LERWICK], { color: CRUISE_ACCENT, weight: 1, opacity: 0.35 }).addTo(map!);
      });
      // origin markers, radius by frequency
      origins.forEach((o) => {
        const r = 4 + Math.round((o.count / maxCount) * 10);
        L.circleMarker([o.lat, o.lng], { radius: r, color: "#fff", weight: 1.5, fillColor: "#5b6b75", fillOpacity: 0.9 })
          .addTo(map!)
          .bindTooltip(`${o.name} · ${o.count} ${o.count === 1 ? "call" : "calls"}`, { direction: "top" });
      });
      // Lerwick hub
      L.circleMarker(LERWICK, { radius: 9, color: "#fff", weight: 2, fillColor: CRUISE_ACCENT, fillOpacity: 1 })
        .addTo(map)
        .bindTooltip("Lerwick", { permanent: true, direction: "top", offset: [0, -4] });

      const pts: [number, number][] = [...origins.map((o) => [o.lat, o.lng] as [number, number]), LERWICK];
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.2));
      else map.setView(LERWICK, 6);
      setTimeout(() => map?.invalidateSize(), 60);
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [origins]);

  return <div ref={ref} className="isolate z-0 h-[420px] w-full overflow-hidden rounded-2xl border border-line" style={{ background: "#a9d3ef" }} />;
}
