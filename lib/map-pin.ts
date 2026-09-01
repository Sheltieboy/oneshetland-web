/**
 * map-pin.ts — where the pin goes, and whether there is one at all.
 *
 * Pulled out of MapPinPicker so the decisions can be tested without a browser
 * and a Google Maps key. The component applies these; it does not decide them.
 *
 * The distinction that matters: a business with no saved coordinates has NO
 * pin. The map still has to open somewhere, and Lerwick is the sensible
 * somewhere — but a marker sitting on that default reads as "your business is
 * here", which is a claim nobody made. Centre and marker are separate answers.
 */

import { hasValidPin } from "./be-found.ts";

export type LatLng = { lat: number; lng: number };

/** Lerwick. Somewhere to open the map, not somewhere to put a pin. */
export const SHETLAND: LatLng = { lat: 60.1546, lng: -1.1494 };

/** The marker's position, or null when the business genuinely has no pin. */
export function pinPosition(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  return hasValidPin(lat, lng) ? { lat: lat as number, lng: lng as number } : null;
}

/** Where the map opens. Always somewhere — this is never null. */
export function mapCentre(lat: number | null | undefined, lng: number | null | undefined): LatLng {
  return pinPosition(lat, lng) ?? SHETLAND;
}

/** Close in on a known location; stay wide when inviting somebody to choose one. */
export function mapZoom(lat: number | null | undefined, lng: number | null | undefined): number {
  return hasValidPin(lat, lng) ? 16 : 12;
}
