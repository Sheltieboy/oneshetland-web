import { getTodaySnapshot, LERWICK_COORDS } from "@/lib/shetland-today";

/**
 * GET /api/shetland-today?lat=..&lng=..&place=..
 *
 * Powers the "Near me" toggle on the home ShetlandTodayCard. Keeps the Admiralty
 * tide key server-side. Without params it returns the Lerwick snapshot.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const coords = hasCoords ? { lat, lng } : LERWICK_COORDS;
  const place = hasCoords ? (searchParams.get("place") || "Near you") : "Lerwick";

  const snapshot = await getTodaySnapshot(coords, place);
  return Response.json(snapshot);
}
