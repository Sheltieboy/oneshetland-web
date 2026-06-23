"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGoogleMaps, GOOGLE_MAPS_KEY, SHETLAND_CENTER, SHETLAND_ZOOM } from "@/lib/google-maps";
import { MEMORIES } from "@/lib/memories-data";

type Pin = { id: string; lat: number | null; lng: number | null; title: string | null; hero_url?: string | null; hero_kind?: string | null };

export function MemoryMap({
  mode, pins = [], onOpenPin, value, onPick, height = 420,
}: {
  mode: "browse" | "pick";
  pins?: Pin[];
  onOpenPin?: (id: string) => void;
  value?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number, placeName?: string) => void;
  height?: number;
}) {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "nokey" | "error">("loading");

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then(() => {
      if (!alive || !mapEl.current) return;
      const g = window.google!;
      const map = new g.maps.Map(mapEl.current, {
        center: value ?? SHETLAND_CENTER, zoom: value ? 13 : SHETLAND_ZOOM,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
      mapRef.current = map;
      setState("ready");

      if (mode === "browse") {
        // Custom photo-bubble markers. Google's classic Marker can't render a
        // framed circular thumbnail, so we use an OverlayView per pin: a
        // memory with a hero photo/video shows that image; others get a
        // coloured dot. Both point at the memory on click.
        class PhotoMarker extends g.maps.OverlayView {
          pin: Pin; click: () => void; el: HTMLDivElement | null = null;
          constructor(pin: Pin, click: () => void) { super(); this.pin = pin; this.click = click; this.setMap(map); }
          onAdd() {
            const wrap = document.createElement("div");
            wrap.style.cssText = "position:absolute;transform:translate(-50%,-100%);cursor:pointer;will-change:transform;";
            wrap.title = this.pin.title ?? "";
            const bubble = document.createElement("div");
            bubble.style.cssText = `width:46px;height:46px;border-radius:9999px;border:3px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.4);overflow:hidden;background:${MEMORIES};display:grid;place-items:center;`;
            if (this.pin.hero_url) {
              const img = document.createElement("img");
              img.src = this.pin.hero_url; img.alt = "";
              img.style.cssText = "width:100%;height:100%;object-fit:cover;";
              bubble.appendChild(img);
              if (this.pin.hero_kind === "video") {
                const play = document.createElement("div");
                play.style.cssText = "position:absolute;color:#fff;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,.6);";
                play.textContent = "▶";
                wrap.appendChild(play);
              }
            } else {
              bubble.innerHTML = `<span style="color:#fff;font-size:18px;line-height:1;">📍</span>`;
            }
            const tip = document.createElement("div");
            tip.style.cssText = "width:0;height:0;margin:-1px auto 0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #fff;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));";
            wrap.append(bubble, tip);
            wrap.addEventListener("click", (e) => { e.stopPropagation(); this.click(); });
            this.el = wrap;
            this.getPanes()!.overlayMouseTarget.appendChild(wrap);
          }
          draw() {
            const proj = this.getProjection();
            if (!proj || !this.el || this.pin.lat == null || this.pin.lng == null) return;
            const pt = proj.fromLatLngToDivPixel(new g.maps.LatLng(this.pin.lat, this.pin.lng));
            if (pt) { this.el.style.left = `${pt.x}px`; this.el.style.top = `${pt.y}px`; }
          }
          onRemove() { if (this.el) { this.el.remove(); this.el = null; } }
        }
        for (const p of pins) {
          if (p.lat == null || p.lng == null) continue;
          new PhotoMarker(p, () => (onOpenPin ? onOpenPin(p.id) : router.push(`/memories/${p.id}`)));
        }
      }

      if (mode === "pick") {
        const place = (lat: number, lng: number, name?: string) => {
          if (markerRef.current) markerRef.current.setPosition({ lat, lng });
          else markerRef.current = new g.maps.Marker({ position: { lat, lng }, map, draggable: true });
          markerRef.current.addListener?.("dragend", () => { const pos = markerRef.current!.getPosition(); if (pos) onPick?.(pos.lat(), pos.lng()); });
          onPick?.(lat, lng, name);
        };
        if (value) place(value.lat, value.lng);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.addListener("click", (e: any) => { if (e.latLng) place(e.latLng.lat(), e.latLng.lng()); });
        if (inputEl.current) {
          const ac = new g.maps.places.Autocomplete(inputEl.current, { fields: ["geometry", "name", "formatted_address"] });
          ac.bindTo("bounds", map);
          ac.addListener("place_changed", () => {
            const pl = ac.getPlace();
            if (pl.geometry?.location) { const loc = pl.geometry.location; map.panTo(loc); map.setZoom(14); place(loc.lat(), loc.lng(), pl.name || pl.formatted_address); }
          });
        }
      }
    }).catch((e) => { if (alive) setState(e?.message === "missing-key" ? "nokey" : "error"); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No key → fallback (manual entry for pick mode so create still works)
  if (state === "nokey" || state === "error") {
    return (
      <div className="rounded-card border border-dashed border-line bg-paper/60 p-5 text-center" style={{ minHeight: height }}>
        <p className="font-display font-bold text-ink">{state === "nokey" ? "Map needs a Google key" : "Map couldn't load"}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
          {state === "nokey" ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local to enable the interactive map and place search." : "Check your connection and key."}
        </p>
        {mode === "pick" && (
          <div className="mx-auto mt-4 max-w-sm space-y-2 text-left">
            <input placeholder="Place name (e.g. Hillswick pier)" className="auth-input" onChange={(e) => onPick?.(value?.lat ?? SHETLAND_CENTER.lat, value?.lng ?? SHETLAND_CENTER.lng, e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="any" placeholder="Latitude" className="auth-input" onChange={(e) => onPick?.(Number(e.target.value), value?.lng ?? SHETLAND_CENTER.lng)} />
              <input type="number" step="any" placeholder="Longitude" className="auth-input" onChange={(e) => onPick?.(value?.lat ?? SHETLAND_CENTER.lat, Number(e.target.value))} />
            </div>
            <p className="text-xs text-ink-faint">Tip: Shetland is around 60.3°N, −1.25°W.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {mode === "pick" && GOOGLE_MAPS_KEY && (
        <input ref={inputEl} placeholder="Search for a place in Shetland…" className="auth-input mb-2" />
      )}
      {/* The map container must have NO React-managed children — Google Maps
          mutates it directly, so any React child triggers removeChild errors.
          The loading hint is a sibling overlay React fully controls. */}
      <div className="relative w-full overflow-hidden rounded-card border border-line" style={{ height }}>
        <div ref={mapEl} className="absolute inset-0" />
        {state === "loading" && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-muted">Loading map…</div>}
      </div>
      {mode === "pick" && <p className="mt-1 text-xs text-ink-faint">Search, or click the map to drop a pin. Drag it to fine-tune.</p>}
    </div>
  );
}
