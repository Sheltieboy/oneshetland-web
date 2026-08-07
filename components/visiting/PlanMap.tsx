"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * The itinerary map: numbered stops in order, joined by a line.
 *
 * Same approach as the cruise maps — Leaflet loaded inside the effect so it
 * never runs during SSR. The line is dashed on purpose: it's the order of the
 * day, not the road you'll actually drive, and drawing a solid route would
 * claim a precision the straight-line estimates don't have.
 */

export type PlanPoint = { lat: number; lng: number; label: string; time: string };

export function PlanMap({ points, accent }: { points: PlanPoint[]; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || map || points.length === 0) return;

      map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);

      if (points.length >= 2) {
        L.polyline(latlngs, { color: accent, weight: 3, opacity: 0.8, dashArray: "7 7" }).addTo(map);
      }

      points.forEach((p, i) => {
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:${accent};color:#fff;width:26px;height:26px;border-radius:50%;
                   display:flex;align-items:center;justify-content:center;font:700 13px/1 system-ui;
                   box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff">${i + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .addTo(map!)
          .bindPopup(`<strong>${p.time}</strong><br/>${p.label}`);
      });

      // One stop can't make a bounding box, so centre on it instead.
      if (points.length === 1) map.setView(latlngs[0], 14);
      else map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
    })();

    return () => { cancelled = true; map?.remove(); };
  }, [points, accent]);

  if (points.length === 0) return null;

  return (
    <div
      ref={ref}
      className="h-[360px] w-full overflow-hidden rounded-card border border-line shadow-soft"
      role="img"
      aria-label={`Map of your day: ${points.map((p, i) => `${i + 1} ${p.label}`).join(", ")}`}
    />
  );
}
