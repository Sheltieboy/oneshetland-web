import { isOpenAt, type OpeningHours } from "@/lib/opening-hours";

/**
 * The visitor day planner.
 *
 * Scheduling is deliberately plain code, not a model. A planner's job is to be
 * RIGHT about times — if it says "10:40, twelve minutes' walk", that has to
 * hold. So the itinerary is assembled deterministically and Peerie Bot only
 * ever writes the words around it. That also means the planner still works
 * when the AI key is missing or the API is down, which matters for the page
 * visitors land on first.
 *
 * Everything here is pure: no I/O, no clock reads except what's passed in.
 * Shared shape with the app's lib/planner.ts.
 */

export type Interest = "food" | "shops" | "history" | "outdoors" | "music" | "family";

export const INTERESTS: { key: Interest; label: string; emoji: string }[] = [
  { key: "food",     label: "Food & drink",      emoji: "🍽" },
  { key: "shops",    label: "Shops & makers",    emoji: "🧶" },
  { key: "history",  label: "History & culture", emoji: "🏛" },
  { key: "outdoors", label: "Outdoors",          emoji: "🥾" },
  { key: "music",    label: "Music & events",    emoji: "🎵" },
  { key: "family",   label: "Family",            emoji: "👨‍👩‍👧" },
];

export type Transport = "walking" | "driving";

/** Lerwick town centre — the default start, and where a cruise tender lands. */
export const LERWICK = { lat: 60.1546, lng: -1.1494 };

export type Candidate = {
  id: string;
  kind: "event" | "place";
  name: string;
  blurb: string | null;
  lat: number;
  lng: number;
  href: string;
  image: string | null;
  /** Events only — fixed wall-clock times. */
  startsAt?: string;
  endsAt?: string;
  /** Places only. */
  hours?: OpeningHours | null;
  category?: string | null;
  interests: Interest[];
  /** Premium/pro businesses sort ahead of free ones, as everywhere else. */
  tierRank?: number;
};

export type Leg = { minutes: number; km: number; mode: Transport };

export type Stop = {
  candidate: Candidate;
  arrive: Date;
  depart: Date;
  /** Travel from the previous stop (or the start point) to here. */
  travel: Leg;
  /** null = we hold no hours for this place, so we can't promise it's open. */
  openKnown: boolean | null;
  note?: string;
};

export type Plan = {
  stops: Stop[];
  startAt: Date;
  endAt: Date;
  unusedMinutes: number;
  /** Places we wanted but had to drop, and why — shown so the plan is honest. */
  skipped: { name: string; reason: string }[];
};

/* ── Geometry ─────────────────────────────────────────────────────────────── */

const R_EARTH_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line distance is optimistic on real roads. Shetland is mostly one
 * spine road with sea in the way, so 1.35 is a fair multiplier for the
 * Mainland; 55 km/h reflects single carriageway with 60 limits and sheep.
 * Walking is 4.5 km/h with the same detour factor for the street grid.
 *
 * This is an ESTIMATE and the UI says so. Real routing needs a Directions API
 * key and billing, which isn't worth it until the feature earns its keep.
 */
/**
 * Detour factors and speeds, checked against journeys with a known answer:
 * Lerwick → Brae is about 39 km and 35–40 minutes by road, and Lerwick town
 * centre → Mareel is a ten-minute walk. Driving lands at ~40 min and walking
 * at ~9 min, which is right, and errs a shade slow — arriving early is a much
 * cheaper mistake for a visitor than arriving late.
 *
 * Walking takes the larger factor: a street grid wanders more than the A970.
 */
const DETOUR: Record<Transport, number> = { walking: 1.45, driving: 1.35 };
const SPEED_KMH: Record<Transport, number> = { walking: 4.5, driving: 65 };
/** Parking, finding the door, getting the bairns out of the car. */
const OVERHEAD_MIN: Record<Transport, number> = { walking: 2, driving: 4 };

export function travelBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  mode: Transport,
): Leg {
  const km = haversineKm(a, b) * DETOUR[mode];
  const minutes = Math.round((km / SPEED_KMH[mode]) * 60 + OVERHEAD_MIN[mode]);
  return { km: Math.round(km * 10) / 10, minutes: Math.max(mode === "walking" ? 2 : 5, minutes), mode };
}

/* ── Dwell times ──────────────────────────────────────────────────────────── */

/** How long people actually spend, by what the place is. */
function dwellMinutes(c: Candidate): number {
  if (c.kind === "event") {
    if (c.startsAt && c.endsAt) {
      const mins = (new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60000;
      // Cap a day-long show at three hours — nobody stays for all of it.
      return Math.max(30, Math.min(180, Math.round(mins)));
    }
    return 90;
  }
  switch (c.category) {
    case "food_drink": return 60;
    case "retail":     return 30;
    case "tourism":    return 75;
    default:           return 40;
  }
}

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

/* ── The scheduler ────────────────────────────────────────────────────────── */

/**
 * Greedy nearest-and-most-wanted, with fixed-time events pinned first.
 *
 * Greedy rather than optimal on purpose: a visitor wants a sensible day in
 * under a second, not the mathematically shortest route. The scoring prefers
 * places that match a stated interest, then paying businesses (same ladder as
 * the rest of the site), then whatever is closest.
 */
export function buildPlan(opts: {
  candidates: Candidate[];
  start: Date;
  end: Date;
  transport: Transport;
  interests: Interest[];
  startPoint?: { lat: number; lng: number };
  maxStops?: number;
}): Plan {
  const { candidates, start, end, transport, interests } = opts;
  const startPoint = opts.startPoint ?? LERWICK;
  const maxStops = opts.maxStops ?? 6;

  const skipped: { name: string; reason: string }[] = [];
  const wanted = (c: Candidate) =>
    interests.length === 0 || c.interests.some((i) => interests.includes(i));

  // Events are fixed points: they happen when they happen. Anything inside the
  // window and wanted gets pinned, and the rest of the day is built around it.
  const pinned = candidates
    .filter((c) => c.kind === "event" && c.startsAt)
    .filter((c) => {
      const s = new Date(c.startsAt!);
      return s >= start && s < end;
    })
    .filter(wanted)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
    .slice(0, 2); // more than two fixed points and the day is somebody else's

  const places = candidates.filter((c) => c.kind === "place" && wanted(c));

  const stops: Stop[] = [];
  let cursor = new Date(start);
  let at = startPoint;
  const used = new Set<string>();

  const pushStop = (c: Candidate, arriveAt: Date, travel: Leg, note?: string) => {
    const dwell = dwellMinutes(c);
    const depart = addMinutes(arriveAt, dwell);
    stops.push({ candidate: c, arrive: arriveAt, depart, travel, openKnown: c.kind === "event" ? true : isOpenAt(c.hours, arriveAt), note });
    used.add(c.id);
    cursor = depart;
    at = { lat: c.lat, lng: c.lng };
  };

  for (const event of pinned) {
    const eventStart = new Date(event.startsAt!);

    // Fill the gap before the event with places we can get in and out of.
    let guard = 0;
    while (stops.length < maxStops && guard++ < 20) {
      const best = pickNext({ places, used, at, cursor, transport, interests, mustFinishBy: eventStart, event });
      if (!best) break;
      pushStop(best.c, best.arrive, best.travel);
    }

    const leg = travelBetween(at, event, transport);
    const arrive = new Date(Math.max(addMinutes(cursor, leg.minutes).getTime(), eventStart.getTime()));
    if (arrive > end) { skipped.push({ name: event.name, reason: "finishes after you leave" }); continue; }
    pushStop(event, arrive, leg, arrive > eventStart ? "You'll be a wee bit late — it starts before you can get there." : undefined);
  }

  // Then fill whatever is left of the day.
  let guard = 0;
  while (stops.length < maxStops && guard++ < 30) {
    const best = pickNext({ places, used, at, cursor, transport, interests, mustFinishBy: end });
    if (!best) break;
    pushStop(best.c, best.arrive, best.travel);
  }

  // Say what we couldn't fit, so the plan doesn't quietly pretend.
  for (const p of places) {
    if (used.has(p.id) || skipped.length >= 4) continue;
    const closed = isOpenAt(p.hours, cursor) === false;
    if (closed) skipped.push({ name: p.name, reason: "closed while you're here" });
  }

  const last = stops[stops.length - 1];
  const endAt = last ? last.depart : start;
  return {
    stops,
    startAt: start,
    endAt,
    unusedMinutes: Math.max(0, Math.round((end.getTime() - endAt.getTime()) / 60000)),
    skipped: skipped.slice(0, 4),
  };
}

function pickNext(args: {
  places: Candidate[];
  used: Set<string>;
  at: { lat: number; lng: number };
  cursor: Date;
  transport: Transport;
  interests: Interest[];
  mustFinishBy: Date;
  event?: Candidate;
}): { c: Candidate; arrive: Date; travel: Leg } | null {
  const { places, used, at, cursor, transport, mustFinishBy } = args;

  let best: { c: Candidate; arrive: Date; travel: Leg; score: number } | null = null;

  for (const c of places) {
    if (used.has(c.id)) continue;
    const travel = travelBetween(at, c, transport);
    const arrive = addMinutes(cursor, travel.minutes);
    const depart = addMinutes(arrive, dwellMinutes(c));
    if (depart > mustFinishBy) continue;

    // Never send someone to a place we KNOW is shut. Unknown is allowed
    // through — most businesses haven't filled their hours in yet — but it
    // scores lower, and the stop is labelled "check times".
    const open = isOpenAt(c.hours, arrive);
    if (open === false) continue;

    const interestHit = args.interests.length > 0 && c.interests.some((i) => args.interests.includes(i));
    const score =
      (interestHit ? 60 : 0) +
      (open === true ? 25 : 0) +
      (c.tierRank ?? 0) * 8 +
      Math.max(0, 40 - travel.minutes);

    if (!best || score > best.score) best = { c, arrive, travel, score };
  }

  return best ? { c: best.c, arrive: best.arrive, travel: best.travel } : null;
}

/* ── Presentation helpers (shared by page and API) ────────────────────────── */

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function describeLeg(leg: Leg): string {
  const how = leg.mode === "walking" ? "walk" : "drive";
  return `${leg.minutes} min ${how} · ${leg.km} km`;
}
