"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps, GOOGLE_MAPS_KEY } from "@/lib/google-maps";

export type PickedPlace = { name: string; address: string; lat: number | null; lng: number | null; postcode: string | null };

/**
 * A Google Places autocomplete text input. Falls back to a plain text input
 * (no coords) when no Maps key is configured — the fee then uses the postcode
 * edge-function path, exactly like the app.
 */
export function PlaceAutocomplete({
  value, onChange, onPick, placeholder, id,
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (place: PickedPlace) => void;
  placeholder?: string;
  id?: string;
}) {
  const inputEl = useRef<HTMLInputElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !inputEl.current) return;
    let alive = true;
    loadGoogleMaps().then(() => {
      if (!alive || !inputEl.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      const ac = new g.maps.places.Autocomplete(inputEl.current, {
        fields: ["geometry", "name", "formatted_address", "address_components"],
        componentRestrictions: { country: "gb" },
      });
      ac.addListener("place_changed", () => {
        const pl = ac.getPlace();
        const loc = pl.geometry?.location;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pc = (pl.address_components ?? []).find((c: any) => c.types?.includes("postal_code"));
        const address = pl.formatted_address || pl.name || "";
        onChange(address);
        onPickRef.current({
          name: pl.name || address,
          address,
          lat: loc ? loc.lat() : null,
          lng: loc ? loc.lng() : null,
          postcode: pc?.long_name ?? null,
        });
      });
    }).catch(() => { /* fall back to plain input */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      id={id}
      ref={inputEl}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint focus:border-line-strong"
      autoComplete="off"
    />
  );
}
