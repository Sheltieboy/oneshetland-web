/**
 * shetland-today.ts — the data behind the "Shetland Today" home card.
 *
 * Mirrors the app (oneshetland-delivers/lib/shetland-today.ts + lib/tides.ts):
 *   • Weather + daylight  → Open-Meteo (free, no key)
 *   • Tides               → Admiralty UK Tidal API (needs ADMIRALTY_KEY)
 *
 * If no Admiralty key is configured the tide strip is simply omitted — we never
 * invent tide times (this is a maritime community). Everything is server-side so
 * the key (when present) is never shipped to the browser; the client island
 * reaches this via the /api/shetland-today route handler.
 */

export const LERWICK_COORDS = { lat: 60.1551, lng: -1.1481 };

export interface TideEvent {
  type: "flow" | "ebb"; // HighWater → flow, LowWater → ebb
  time: string; // "04:12" local
  fraction: number; // 0..1 across the day, for the timeline
}

export interface TodaySnapshot {
  place: string;
  tempC: number | null;
  weatherCode: number | null;
  sunrise: string; // "04:12"
  sunset: string; // "22:31"
  daylight: string; // "18h 19m"
  tideStation: string | null;
  tides: TideEvent[];
  tidesConfigured: boolean; // false when no Admiralty key — card shows "tides unavailable"
}

export interface WeatherLook {
  label: string;
  /** Lucide-style key our SVG icon switcher understands. */
  icon: "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "thunder";
}

/** Map a WMO weather code to a short label + icon key. */
export function describeWeather(code: number | null): WeatherLook {
  if (code == null) return { icon: "cloud", label: "—" };
  if (code === 0) return { icon: "sun", label: "Clear" };
  if (code <= 2) return { icon: "cloud-sun", label: "Partly cloudy" };
  if (code === 3) return { icon: "cloud", label: "Overcast" };
  if (code === 45 || code === 48) return { icon: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "drizzle", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "rain", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "snow", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "rain", label: "Showers" };
  if (code >= 85 && code <= 86) return { icon: "snow", label: "Snow showers" };
  if (code >= 95) return { icon: "thunder", label: "Thunder" };
  return { icon: "cloud", label: "Cloudy" };
}

function hhmm(iso: string): string {
  // Open-Meteo returns local ISO like "2026-06-11T04:12"
  const t = iso.split("T")[1] ?? "";
  return t.slice(0, 5);
}

function daylightBetween(sunriseIso: string, sunsetIso: string): string {
  const a = new Date(sunriseIso).getTime();
  const b = new Date(sunsetIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return "—";
  const mins = Math.round((b - a) / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

interface WeatherDaylight {
  tempC: number | null;
  weatherCode: number | null;
  sunrise: string;
  sunset: string;
  daylight: string;
}

async function fetchWeatherDaylight(coords: { lat: number; lng: number }): Promise<WeatherDaylight> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
    `&current=temperature_2m,weather_code&daily=sunrise,sunset&forecast_days=1&timezone=Europe%2FLondon`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const d = await res.json();
    const sunrise = d?.daily?.sunrise?.[0] ?? "";
    const sunset = d?.daily?.sunset?.[0] ?? "";
    return {
      tempC: typeof d?.current?.temperature_2m === "number" ? Math.round(d.current.temperature_2m) : null,
      weatherCode: typeof d?.current?.weather_code === "number" ? d.current.weather_code : null,
      sunrise: sunrise ? hhmm(sunrise) : "—",
      sunset: sunset ? hhmm(sunset) : "—",
      daylight: sunrise && sunset ? daylightBetween(sunrise, sunset) : "—",
    };
  } catch {
    return { tempC: null, weatherCode: null, sunrise: "—", sunset: "—", daylight: "—" };
  }
}

/* ── Conditions at showtime — for the What's On "Getting there" panel ── */

export interface EventConditions {
  /** Temperature at the event's hour, °C. null when beyond the forecast horizon. */
  tempC: number | null;
  /** WMO weather code at the event's hour. null when beyond forecast. */
  weatherCode: number | null;
  sunrise: string; // "04:12"
  sunset: string; // "22:31"
  daylight: string; // "18h 19m"
  /** Shetland midsummer near-24h twilight — drives the "light till late" line. */
  simmerDim: boolean;
  /** false when the event is too far out for Open-Meteo (weather cells hide). */
  withinForecast: boolean;
}

/** The event's local (Europe/London) calendar date + hour, for hourly lookup. */
function londonDateHour(iso: string): { date: string; hour: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number.isFinite(hour) ? hour : 0 };
}

/**
 * Weather at the event's hour + daylight for the event's day, from Open-Meteo
 * (free, no key). Returns honest nulls for weather when the event is beyond the
 * ~16-day forecast horizon — daylight is still returned when available.
 */
export async function getEventConditions(
  coords: { lat: number; lng: number },
  startsAt: string | null | undefined,
): Promise<EventConditions> {
  const empty: EventConditions = {
    tempC: null, weatherCode: null, sunrise: "—", sunset: "—",
    daylight: "—", simmerDim: false, withinForecast: false,
  };
  const when = startsAt ? londonDateHour(startsAt) : null;
  if (!when) return empty;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
    `&hourly=temperature_2m,weather_code&daily=sunrise,sunset` +
    `&start_date=${when.date}&end_date=${when.date}&timezone=Europe%2FLondon`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const d = await res.json();
    const sunrise = d?.daily?.sunrise?.[0] ?? "";
    const sunset = d?.daily?.sunset?.[0] ?? "";
    const daylight = sunrise && sunset ? daylightBetween(sunrise, sunset) : "—";
    const daylightMins = sunrise && sunset ? (new Date(sunset).getTime() - new Date(sunrise).getTime()) / 60000 : 0;
    const times: string[] = Array.isArray(d?.hourly?.time) ? d.hourly.time : [];
    const prefix = `${when.date}T${String(when.hour).padStart(2, "0")}`;
    let idx = times.findIndex((t) => t.startsWith(prefix));
    if (idx < 0) idx = times.length ? Math.min(when.hour, times.length - 1) : -1;
    const temp = idx >= 0 ? d?.hourly?.temperature_2m?.[idx] : null;
    const code = idx >= 0 ? d?.hourly?.weather_code?.[idx] : null;
    return {
      tempC: typeof temp === "number" ? Math.round(temp) : null,
      weatherCode: typeof code === "number" ? code : null,
      sunrise: sunrise ? hhmm(sunrise) : "—",
      sunset: sunset ? hhmm(sunset) : "—",
      daylight,
      simmerDim: daylightMins >= 1080,
      withinForecast: idx >= 0,
    };
  } catch {
    return empty;
  }
}

/* ── Tides — Admiralty UK Tidal API (server-side; key never reaches the browser) ── */

// Accept either ADMIRALTY_KEY (server-only, preferred) or the app-style public name
// if someone copies it across. Both stay server-side here.
const ADMIRALTY_KEY = process.env.ADMIRALTY_KEY ?? process.env.EXPO_PUBLIC_ADMIRALTY_KEY ?? "";
const ADMIRALTY_BASE = "https://admiraltyapi.azure-api.net/uktidalapi/api/V1";

export function tidesConfigured(): boolean {
  return !!ADMIRALTY_KEY;
}

interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
let stationsMem: Station[] | null = null;

async function getStations(): Promise<Station[]> {
  if (stationsMem) return stationsMem;
  const res = await fetch(`${ADMIRALTY_BASE}/Stations`, {
    headers: { "Ocp-Apim-Subscription-Key": ADMIRALTY_KEY },
    // The station list is near-static — cache for a day.
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`stations ${res.status}`);
  const json = await res.json();
  const data: Station[] = (json?.features ?? [])
    .map((f: { properties?: { Id?: string; Name?: string }; geometry?: { coordinates?: number[] } }) => ({
      id: f?.properties?.Id,
      name: f?.properties?.Name,
      lat: f?.geometry?.coordinates?.[1],
      lng: f?.geometry?.coordinates?.[0],
    }))
    .filter((s: Station) => s.id && typeof s.lat === "number" && typeof s.lng === "number");
  stationsMem = data;
  return data;
}

function distSq(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = aLat - bLat;
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

function nearestStation(stations: Station[], lat: number, lng: number): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const s of stations) {
    const d = distSq(lat, lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Parse an Admiralty UTC DateTime ("2026-06-26T03:12:00") to a local Date. */
function toLocal(iso: string): Date {
  const hasTz = /[zZ]$|[+\-]\d\d:?\d\d$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

async function fetchTides(coords: { lat: number; lng: number }): Promise<{ stationName: string; events: TideEvent[] } | null> {
  if (!ADMIRALTY_KEY) return null;
  try {
    const stations = await getStations();
    const st = nearestStation(stations, coords.lat, coords.lng);
    if (!st) return null;
    const res = await fetch(`${ADMIRALTY_BASE}/Stations/${st.id}/TidalEvents?duration=1`, {
      headers: { "Ocp-Apim-Subscription-Key": ADMIRALTY_KEY },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr)) return null;
    const todayDate = new Date().getDate();
    const events: TideEvent[] = arr
      .map((e: { DateTime?: string; EventType?: string }): (TideEvent & { day: number }) | null => {
        if (!e?.DateTime) return null;
        const d = toLocal(e.DateTime);
        if (isNaN(d.getTime())) return null;
        const h = d.getHours();
        const m = d.getMinutes();
        return {
          type: e.EventType === "HighWater" ? "flow" : "ebb",
          time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          fraction: (h * 60 + m) / 1440,
          day: d.getDate(),
        };
      })
      .filter((e): e is TideEvent & { day: number } => !!e && e.day === todayDate)
      .map(({ day: _day, ...e }) => e);
    return { stationName: st.name, events };
  } catch {
    return null;
  }
}

/** The full snapshot for a location: weather + daylight + (optional) tides. */
export async function getTodaySnapshot(
  coords: { lat: number; lng: number } = LERWICK_COORDS,
  place = "Lerwick",
): Promise<TodaySnapshot> {
  const [wx, tide] = await Promise.all([fetchWeatherDaylight(coords), fetchTides(coords)]);
  return {
    place,
    tempC: wx.tempC,
    weatherCode: wx.weatherCode,
    sunrise: wx.sunrise,
    sunset: wx.sunset,
    daylight: wx.daylight,
    tideStation: tide?.stationName ?? null,
    tides: tide?.events ?? [],
    tidesConfigured: tidesConfigured(),
  };
}
