/**
 * Time-of-day + weather aware homepage hero image for Lerwick.
 * Mirrors the app's pickHeroImage logic (app/(tabs)/index.tsx). Open-Meteo,
 * free + no key. Falls back to a calm daytime hero if anything fails.
 */

const LERWICK = { lat: 60.1551, lng: -1.1481 };

const HERO_IMAGES = {
  "day-sunny": "/context-background-images/60-hero-day-sunny.webp",
  "day-calm": "/context-background-images/60-hero-day-calm.webp",
  "day-rainy": "/context-background-images/60-hero-day-rainy.webp",
  "day-windy": "/context-background-images/60-hero-day-windy.webp",
  "night-clear": "/context-background-images/60-hero-night-clear.webp",
  "night-rain": "/context-background-images/60-hero-night-rain.webp",
  "night-windy": "/context-background-images/60-night-windy.webp",
} as const;

type HeroKey = keyof typeof HERO_IMAGES;

async function fetchWeather(): Promise<{ code: number; windKph: number } | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LERWICK.lat}&longitude=${LERWICK.lng}&current=weather_code,wind_speed_10m&timezone=auto`,
      { signal: AbortSignal.timeout(4000), next: { revalidate: 900 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return {
      code: json.current?.weather_code ?? 0,
      windKph: json.current?.wind_speed_10m ?? 0,
    };
  } catch {
    return null;
  }
}

/** Current hour in Shetland (Europe/London), 0–23. */
function shetlandHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const h = parseInt(parts, 10);
  return Number.isFinite(h) ? h % 24 : 12;
}

function pickHeroKey(weather: { code: number; windKph: number } | null): HeroKey {
  const h = shetlandHour();
  const isNight = h >= 21 || h < 6;
  const code = weather?.code ?? -1;
  const windy = (weather?.windKph ?? 0) > 35;
  // Rain/drizzle/showers/thunder — but not snow (71–77).
  const rainy =
    code >= 51 && code <= 99 &&
    !(code >= 71 && code <= 77) && code !== 70;

  if (isNight) {
    if (rainy) return "night-rain";
    if (windy) return "night-windy";
    return "night-clear";
  }
  if (rainy) return "day-rainy";
  if (windy) return "day-windy";
  if (code === 0) return "day-sunny";
  return "day-calm";
}

/** The hero image path to use right now, given live Shetland weather + time. */
export async function getHeroImage(): Promise<string> {
  const weather = await fetchWeather();
  return HERO_IMAGES[pickHeroKey(weather)];
}
