"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { CRUISE_ACCENT } from "@/lib/cruise-shared";
import type { RoutePoint } from "@/lib/cruise-stats";

/** A small OpenStreetMap route: previous port → Lerwick → next port. */
export function RouteMap({ points }: { points: RoutePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || map) return;
      map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 12, attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      if (points.length >= 2) {
        L.polyline(latlngs, { color: CRUISE_ACCENT, weight: 3, opacity: 0.85, dashArray: "7 7" }).addTo(map);
      }
      points.forEach((p) => {
        const isLerwick = p.kind === "lerwick";
        L.circleMarker([p.lat, p.lng], {
          radius: isLerwick ? 8 : 6, color: "#fff", weight: 2,
          fillColor: isLerwick ? CRUISE_ACCENT : "#5b6b75", fillOpacity: 1,
        })
          .addTo(map!)
          .bindTooltip(p.name, { permanent: true, direction: "top", offset: [0, -4] });
      });

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds.pad(0.45));
      if (points.length === 1) map.setView(latlngs[0], 8);
      setTimeout(() => map?.invalidateSize(), 60);
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [points]);

  return <div ref={ref} className="isolate z-0 h-64 w-full overflow-hidden rounded-2xl border border-line" style={{ background: "#a9d3ef" }} />;
}
