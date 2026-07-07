"use client";

import { useCallback, useEffect, useState } from "react";
import { describeWeather, type TodaySnapshot } from "@/lib/shetland-today";

/**
 * ShetlandTodayCard — the home concierge "today at a glance" card.
 * Weather + daylight (Open-Meteo) and tides (Admiralty, when keyed). Mirrors the
 * app's ShetlandTodayCard: a weather-aware Shetland photo behind the conditions,
 * with a Lerwick / Near-me toggle. The tide strip hides when no key is set; if
 * the whole snapshot is unavailable we show a graceful fallback rather than crash.
 *
 * The initial Lerwick snapshot is fetched on the server and passed in; the
 * "Near me" toggle calls /api/shetland-today with the browser's coordinates so
 * the Admiralty key never reaches the client.
 */

const HERO = {
  daySunny: "/context-background-images/60-hero-day-sunny.webp",
  dayCalm: "/context-background-images/60-hero-day-calm.webp",
  dayRainy: "/context-background-images/60-hero-day-rainy.webp",
  nightClear: "/context-background-images/60-hero-night-clear.webp",
  nightRain: "/context-background-images/60-hero-night-rain.webp",
};

function pickImage(code: number | null): string {
  const h = new Date().getHours();
  const isDay = h >= 5 && h < 22;
  const wet = code != null && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95);
  if (!isDay) return wet ? HERO.nightRain : HERO.nightClear;
  if (wet) return HERO.dayRainy;
  if (code === 0 || (code != null && code <= 2)) return HERO.daySunny;
  return HERO.dayCalm;
}

const clampPct = (f: number) => Math.min(95, Math.max(5, f * 100));

function WeatherIcon({ icon, size = 30 }: { icon: ReturnType<typeof describeWeather>["icon"]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (icon) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      );
    case "cloud-sun":
      return (
        <svg {...common}>
          <path d="M7 7a4 4 0 0 1 7-2.5" />
          <path d="M3 8v.01M5 4v.01" />
          <path d="M17 18H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 18Z" />
        </svg>
      );
    case "fog":
      return (
        <svg {...common}>
          <path d="M17 14H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 14Z" />
          <path d="M5 18h14M7 21h10" />
        </svg>
      );
    case "drizzle":
    case "rain":
      return (
        <svg {...common}>
          <path d="M17 13H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 13Z" />
          <path d="M8 17v2M12 17v3M16 17v2" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path d="M17 13H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 13Z" />
          <path d="M8 18h.01M12 19h.01M16 18h.01M10 21h.01M14 21h.01" />
        </svg>
      );
    case "thunder":
      return (
        <svg {...common}>
          <path d="M17 13H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 13Z" />
          <path d="m12 15-2 4h3l-2 4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M17 18H7a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 18Z" />
        </svg>
      );
  }
}

function Sun({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-white/75">{label}</p>
      <p className="text-base font-extrabold text-white">{value}</p>
    </div>
  );
}

export function ShetlandTodayCard({ initial, glass = false }: { initial: TodaySnapshot | null; glass?: boolean }) {
  const [snap, setSnap] = useState<TodaySnapshot | null>(initial);
  const [mode, setMode] = useState<"lerwick" | "mine">("lerwick");
  const [loading, setLoading] = useState(false);
  // `navigator` doesn't exist during SSR, so gating UI on it directly makes the
  // server and client render differently and trips a hydration mismatch. Defer
  // the geolocation-dependent toggle until after mount, when server and first
  // client render agree (both without it), then reveal it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hasGeo = mounted && typeof navigator !== "undefined" && !!navigator.geolocation;

  const load = useCallback(async (params: string, nextMode: "lerwick" | "mine") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shetland-today${params}`);
      if (res.ok) {
        setSnap(await res.json());
        setMode(nextMode);
      }
    } catch {
      /* keep current snapshot */
    } finally {
      setLoading(false);
    }
  }, []);

  const chooseLerwick = useCallback(() => {
    if (mode === "lerwick") return;
    void load("", "lerwick");
  }, [mode, load]);

  const chooseMine = useCallback(() => {
    if (!hasGeo) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        void load(`?lat=${latitude}&lng=${longitude}&place=${encodeURIComponent("Near you")}`, "mine");
      },
      () => {
        setLoading(false);
        // Permission denied / unavailable — quietly stay on Lerwick.
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
    );
  }, [hasGeo, load]);

  // Graceful "unavailable" state — never crash the home page.
  if (!snap) {
    return glass ? (
      <div className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-soft backdrop-blur-md">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/85">Shetland Today</p>
        <p className="mt-2 text-sm text-white/75">Weather and tides are unavailable just now.</p>
      </div>
    ) : (
      <div className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Shetland Today</p>
        <p className="mt-2 text-sm text-ink-soft">
          Weather and tides are unavailable just now. Try again in a moment.
        </p>
      </div>
    );
  }

  const w = describeWeather(snap.weatherCode);
  // The "now" marker depends on the viewer's local clock, which the server
  // (UTC) can't know — computing it during SSR guarantees a hydration mismatch.
  // Only position it after mount; null until then so it isn't server-rendered.
  const nowFraction = mounted ? (new Date().getHours() * 60 + new Date().getMinutes()) / 1440 : null;

  return (
    <div
      className={
        glass
          ? "relative isolate overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5 shadow-soft backdrop-blur-md"
          : "relative isolate overflow-hidden rounded-card p-5 shadow-soft"
      }
      style={glass ? undefined : { backgroundImage: `url(${pickImage(snap.weatherCode)})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {!glass && <div className="absolute inset-0 bg-[#08182a]/55" />}

      <div className="relative">
        {/* Header + Lerwick/Near-me toggle */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/85">Shetland Today</p>
          {hasGeo && (
            <div className="flex rounded-pill bg-white/15 p-0.5">
              <button
                type="button"
                onClick={chooseLerwick}
                className={`rounded-pill px-3 py-1 text-xs font-bold transition ${mode === "lerwick" ? "bg-white text-[#08182a]" : "text-white"}`}
              >
                Lerwick
              </button>
              <button
                type="button"
                onClick={chooseMine}
                className={`rounded-pill px-3 py-1 text-xs font-bold transition ${mode === "mine" ? "bg-white text-[#08182a]" : "text-white"}`}
              >
                Near me
              </button>
            </div>
          )}
        </div>

        {/* Weather */}
        <div className="mt-4 flex items-center gap-4 text-white">
          <WeatherIcon icon={w.icon} size={34} />
          <span className="text-4xl font-extrabold">{snap.tempC != null ? `${snap.tempC}°` : "—"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold">{snap.place}</p>
            <p className="truncate text-sm text-white/75">{w.label}</p>
          </div>
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          )}
        </div>

        <div className="my-4 h-px bg-white/20" />

        {/* Daylight */}
        <div className="flex justify-between">
          <Sun label="Sunrise" value={snap.sunrise} />
          <Sun label="Sunset" value={snap.sunset} />
          <Sun label="Daylight" value={snap.daylight} />
        </div>

        {/* Tides — only when configured + we actually have events */}
        {snap.tidesConfigured && snap.tides.length > 0 ? (
          <>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-white/70">
              Tides{snap.tideStation ? ` · ${snap.tideStation}` : ""}
            </p>
            <div className="relative mt-3 h-12 border-t border-white/25">
              {nowFraction != null && (
                <span
                  className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-white"
                  style={{ left: `${clampPct(nowFraction)}%` }}
                />
              )}
              {snap.tides.map((e, i) => (
                <div
                  key={i}
                  className="absolute top-0 w-10 -translate-x-1/2 text-center"
                  style={{ left: `${clampPct(e.fraction)}%` }}
                >
                  <span className="mx-auto block h-2.5 w-px bg-white/50" />
                  <span className={`mt-1 block text-[10px] font-bold ${e.type === "flow" ? "text-[#5dcaa5]" : "text-[#85b7eb]"}`}>
                    {e.type === "flow" ? "Flow" : "Ebb"}
                  </span>
                  <span className="block text-[11px] text-white">{e.time}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-tight text-white/60">
              Contains ADMIRALTY® tidal data: © Crown copyright and database right
            </p>
          </>
        ) : !snap.tidesConfigured ? (
          <p className="mt-4 text-[11px] text-white/55">Tide times unavailable</p>
        ) : null}
      </div>
    </div>
  );
}
