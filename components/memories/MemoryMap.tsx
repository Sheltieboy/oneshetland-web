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
            wrap.setAttribute("role", "button");
            wrap.setAttribute("aria-label", this.pin.title ?? "Memory");
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

        // A count bubble standing in for several pins gathered into one grid
        // cell. Clicking zooms the map in on the cluster's bounds so it breaks
        // apart — same "expand on tap" behaviour as the app. Kept as a plain
        // OverlayView so we don't pull in a clustering library.
        class ClusterMarker extends g.maps.OverlayView {
          lat: number; lng: number; members: Pin[]; el: HTMLDivElement | null = null;
          constructor(lat: number, lng: number, members: Pin[]) {
            super(); this.lat = lat; this.lng = lng; this.members = members; this.setMap(map);
          }
          onAdd() {
            const n = this.members.length;
            const size = n >= 25 ? 50 : n >= 10 ? 44 : 38;
            const wrap = document.createElement("div");
            wrap.style.cssText = "position:absolute;transform:translate(-50%,-50%);cursor:pointer;will-change:transform;";
            wrap.setAttribute("role", "button");
            wrap.setAttribute("aria-label", `${n} stories here — click to zoom in`);
            wrap.title = `${n} stories`;
            const bubble = document.createElement("div");
            bubble.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);background:${MEMORIES};color:#fff;font-weight:800;font-size:15px;display:grid;place-items:center;`;
            bubble.textContent = n > 99 ? "99+" : String(n);
            wrap.appendChild(bubble);
            wrap.addEventListener("click", (e) => {
              e.stopPropagation();
              const bounds = new g.maps.LatLngBounds();
              for (const m of this.members) {
                if (m.lat != null && m.lng != null) bounds.extend(new g.maps.LatLng(m.lat, m.lng));
              }
              map.fitBounds(bounds, 64);
              // fitBounds on a tight cluster can over-zoom past the pins'
              // breaking point; cap it so they actually separate.
              const z = map.getZoom();
              if (typeof z === "number" && z > 17) map.setZoom(17);
            });
            this.el = wrap;
            this.getPanes()!.overlayMouseTarget.appendChild(wrap);
          }
          draw() {
            const proj = this.getProjection();
            if (!proj || !this.el) return;
            const pt = proj.fromLatLngToDivPixel(new g.maps.LatLng(this.lat, this.lng));
            if (pt) { this.el.style.left = `${pt.x}px`; this.el.style.top = `${pt.y}px`; }
          }
          onRemove() { if (this.el) { this.el.remove(); this.el = null; } }
        }

        const valid = pins.filter((p) => p.lat != null && p.lng != null);
        const open = (id: string) => (onOpenPin ? onOpenPin(id) : router.push(`/memories/${id}`));

        // Grid clustering: divide the world into cells whose size scales with
        // the current zoom, collapse each cell's pins into one bubble. Below
        // a close-in zoom we stop clustering so individual pins always show.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let overlays: any[] = [];
        const CLUSTER_DISABLE_ZOOM = 14;  // zoomed in past this → real pins only
        const GRID_PX = 64;               // ~cell size on screen, in pixels

        const clear = () => { for (const o of overlays) o.setMap(null); overlays = []; };

        const render = () => {
          clear();
          const zoom = map.getZoom() ?? SHETLAND_ZOOM;
          if (zoom >= CLUSTER_DISABLE_ZOOM) {
            for (const p of valid) overlays.push(new PhotoMarker(p, () => open(p.id)));
            return;
          }
          // Cell size in degrees ≈ pixels / pixels-per-degree at this zoom.
          // 256 * 2^zoom px spans 360° of longitude in the Web Mercator base.
          const degPerPx = 360 / (256 * Math.pow(2, zoom));
          const cell = Math.max(GRID_PX * degPerPx, 1e-4);
          const buckets = new Map<string, Pin[]>();
          for (const p of valid) {
            const gx = Math.floor(p.lng! / cell);
            const gy = Math.floor(p.lat! / cell);
            const k = `${gx}:${gy}`;
            const arr = buckets.get(k);
            if (arr) arr.push(p); else buckets.set(k, [p]);
          }
          for (const group of buckets.values()) {
            if (group.length === 1) {
              const p = group[0];
              overlays.push(new PhotoMarker(p, () => open(p.id)));
            } else {
              let sLat = 0, sLng = 0;
              for (const p of group) { sLat += p.lat!; sLng += p.lng!; }
              overlays.push(new ClusterMarker(sLat / group.length, sLng / group.length, group));
            }
          }
        };

        render();
        // Re-cluster after every zoom change (idle fires once the map settles).
        map.addListener("idle", render);
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
