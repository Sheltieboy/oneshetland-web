/**
 * google-maps.ts — lazy loader for the Google Maps JS API (with the Places
 * library), so we depend on no npm package. Reads NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 * Client-only.
 */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/* The Google Maps JS API has no bundled types here; we treat `google` loosely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { google?: any; __osMapsPromise?: Promise<void> } }

let promise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("missing-key"));
  if (promise) return promise;
  promise = new Promise<void>((resolve, reject) => {
    const done = () => (window.google?.maps ? resolve() : fail());
    const fail = () => { promise = null; reject(new Error("load-failed")); };
    const existing = document.getElementById("os-google-maps") as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps) return resolve();
      existing.addEventListener("load", done);
      existing.addEventListener("error", fail);
      return;
    }
    const s = document.createElement("script");
    s.id = "os-google-maps";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = done;
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return promise;
}

/** Shetland default centre + zoom. */
export const SHETLAND_CENTER = { lat: 60.3, lng: -1.25 };
export const SHETLAND_ZOOM = 9;
