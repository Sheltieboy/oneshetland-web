/**
 * preview-work.ts — the "Work" model for the Home V2 / Local V2 previews. PREVIEW ONLY; nothing here is wired into the
 * live `/` or `/local`, and nothing here writes anywhere.
 *
 * Work is ONE proposition: formal jobs (permanent, fixed-term, apprenticeship) and casual shifts (cover, one-off,
 * today / tonight / this week) sit together under "Work in Shetland". Home and Local curate a few of each; the full
 * inventory lives in the Work hub (`/jobs`, with its Shifts tab).
 *
 * Honesty rules:
 *  - live state reads real jobs and real shifts and NEVER invents a shift (no real shift → jobs only);
 *  - the seed / populated shifts are INVENTED PREVIEW DATA (a made-up "Sample …" employer), shown to judge the UI;
 *  - an urgency label (TODAY / TONIGHT / TOMORROW / THIS WEEK) is derived from the shift's real start time, never from
 *    a flag, and a shift further out than that gets no label — only its date.
 */

import type { PreviewState } from "@/lib/preview-v2";

export type WorkShift = {
  kind: "shift";
  id: string;
  title: string;
  employer: string;
  where: string;
  startAt: string;
  endAt: string;
  rate: string;
  href: string;
  sample?: boolean;
};

export type WorkJob = {
  kind: "job";
  id: string;
  title: string;
  employer: string | null;
  where: string | null;
  pay: string | null;
  contract: string | null;
  href: string;
  sample?: boolean;
};

export type WorkSet = { shifts: WorkShift[]; jobs: WorkJob[] };

/** `?work=` — a preview-only override to see the combinations. Ignored in the live state (live never fabricates). */
export type WorkMix = "both" | "jobs" | "shifts" | "none";
export const WORK_HUB = "/jobs";
export const WORK_HUB_SHIFTS = "/jobs?tab=shifts";

const TZ = "Europe/London";

/* ── London-time helpers (the server runs in UTC) ────────────────────────────── */

function londonParts(d: Date): { y: number; m: number; day: number; hour: number; minute: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}

/** The instant at which London's wall clock reads (today + offsetDays) hh:mm. */
export function londonInstant(now: Date, offsetDays: number, hh: number, mm = 0): Date {
  const t = londonParts(now);
  const guess = Date.UTC(t.y, t.m - 1, t.day + offsetDays, hh, mm);
  const g = londonParts(new Date(guess));
  const asUtc = Date.UTC(g.y, g.m - 1, g.day, g.hour, g.minute);
  return new Date(guess - (asUtc - guess));
}

function dayNumber(d: Date): number {
  const t = londonParts(d);
  return Math.round(Date.UTC(t.y, t.m - 1, t.day) / 86_400_000);
}

export type Urgency = "TODAY" | "TONIGHT" | "TOMORROW" | "THIS WEEK" | null;

/**
 * Derived from the real start time, in London time. A shift starting from 17:00 today is TONIGHT; one in progress or
 * starting earlier today is TODAY; tomorrow is TOMORROW; two to six days out is THIS WEEK; anything later (or already
 * over) gets no label.
 */
export function shiftUrgency(startAt: string, endAt: string, now: Date): Urgency {
  const start = new Date(startAt);
  if (new Date(endAt) <= now) return null;
  const diff = dayNumber(start) - dayNumber(now);
  if (diff <= 0) return londonParts(start).hour >= 17 ? "TONIGHT" : "TODAY";
  if (diff === 1) return "TOMORROW";
  if (diff <= 6) return "THIS WEEK";
  return null;
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(d);
export const clockRange = (startAt: string, endAt: string) =>
  `${fmt(new Date(startAt), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–${fmt(new Date(endAt), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
/** "Sat 10 Oct" — the date line when there is no urgency label to carry the "when". */
export const shortDate = (startAt: string) => fmt(new Date(startAt), { weekday: "short", day: "numeric", month: "short" });

/** The most timely first; shifts that have already ended are dropped. */
export function orderShifts(shifts: WorkShift[], now: Date): WorkShift[] {
  return shifts.filter((s) => new Date(s.endAt) > now).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

/* ── Invented preview data ───────────────────────────────────────────────────── */

function at(now: Date, offsetDays: number, from: [number, number], to: [number, number]): { startAt: string; endAt: string } {
  return { startAt: londonInstant(now, offsetDays, ...from).toISOString(), endAt: londonInstant(now, offsetDays, ...to).toISOString() };
}

/** Days from today to the next Saturday whose shift is still ahead (this Saturday until 17:00, then the next). */
function nextSaturdayOffset(now: Date): number {
  const dow = new Date(Date.UTC(londonParts(now).y, londonParts(now).m - 1, londonParts(now).day)).getUTCDay(); // 0 Sun … 6 Sat
  let off = (6 - dow + 7) % 7;
  if (off === 0 && londonInstant(now, 0, 17) <= now) off = 7;
  return off;
}

export const SEED_SHIFT_RATE = "£13.50/hr";

function seedShift(now: Date): WorkShift {
  return {
    kind: "shift", id: "sample-shift-cafe-cover", title: "Saturday café cover", employer: "Sample Café", where: "Lerwick",
    ...at(now, nextSaturdayOffset(now), [11, 0], [17, 0]), rate: SEED_SHIFT_RATE, href: WORK_HUB_SHIFTS, sample: true,
  };
}

function populatedShifts(now: Date): WorkShift[] {
  const mk = (id: string, title: string, employer: string, where: string, off: number, from: [number, number], to: [number, number], rate: string): WorkShift =>
    ({ kind: "shift", id, title, employer, where, ...at(now, off, from, to), rate, href: WORK_HUB_SHIFTS, sample: true });
  return orderShifts([
    mk("sample-shift-kp", "Kitchen porter, evening service", "Sample Bistro", "Lerwick", 0, [18, 0], [23, 0], "£12.80/hr"),
    mk("sample-shift-lunch", "Lunch service cover", "Sample Café", "Lerwick", 0, [11, 30], [15, 30], "£12.50/hr"),
    mk("sample-shift-steward", "Event steward, craft fair", "Sample Events Co.", "Brae", 1, [12, 0], [18, 0], "£12.00/hr"),
    mk("sample-shift-relief", "Weekend feed relief", "Sample Salmon Farm", "Scalloway", 3, [7, 0], [15, 0], "£14.00/hr"),
    mk("sample-shift-cover", "Saturday café cover", "Sample Café", "Lerwick", nextSaturdayOffset(now), [11, 0], [17, 0], SEED_SHIFT_RATE),
  ], now);
}

const J = (id: string, title: string, employer: string, where: string, pay: string, contract: string): WorkJob =>
  ({ kind: "job", id, title, employer, where, pay, contract, href: WORK_HUB, sample: true });

const SEED_JOBS: WorkJob[] = [
  J("sample-job-chef", "Chef de partie", "Sample Bistro", "Lerwick", "£14.20/hr", "permanent"),
  J("sample-job-apprentice", "Apprentice electrician", "Sample Electrical", "Scalloway", "Apprentice rates", "apprenticeship"),
  J("sample-job-host", "Seasonal visitor-centre host", "Sample Heritage Trust", "Sumburgh", "£11.90/hr", "fixed-term"),
];

const FULL_JOBS: WorkJob[] = [
  ...SEED_JOBS,
  J("sample-job-care", "Care assistant", "Sample Care Group", "Lerwick", "£12.60/hr", "permanent"),
  J("sample-job-joiner", "Apprentice joiner", "Sample Joinery", "Whiteness", "Apprentice rates", "apprenticeship"),
  J("sample-job-office", "Office administrator", "Sample Marine Services", "Lerwick", "£24,500 a year", "permanent"),
  J("sample-job-fish", "Processing operative", "Sample Seafoods", "Whalsay", "£12.10/hr", "fixed-term"),
  J("sample-job-driver", "HGV driver", "Sample Haulage", "Sullom Voe", "£15.80/hr", "permanent"),
];

/**
 * The Work content a preview state shows. `liveJobs` / `liveShifts` are real production rows (the live state);
 * the other states use invented preview data, with `mix` choosing which combination to demonstrate.
 */
export function buildWork(
  state: PreviewState, mix: WorkMix | undefined, live: { jobs: WorkJob[]; shifts: WorkShift[] }, now: Date = new Date(),
): WorkSet {
  if (state === "live") return { jobs: live.jobs, shifts: orderShifts(live.shifts, now) };
  const base: WorkSet =
    state === "empty" ? { jobs: [], shifts: [] }
      : state === "seed" ? { jobs: SEED_JOBS, shifts: orderShifts([seedShift(now)], now) }
        : { jobs: FULL_JOBS, shifts: populatedShifts(now) };
  if (!mix || state === "empty") return base;
  const demo = state === "seed" ? { jobs: SEED_JOBS, shifts: orderShifts([seedShift(now)], now) } : base;
  if (mix === "none") return { jobs: [], shifts: [] };
  if (mix === "jobs") return { jobs: demo.jobs, shifts: [] };
  if (mix === "shifts") return { jobs: [], shifts: demo.shifts };
  return demo;
}

export function parseMix(v: string | undefined): WorkMix | undefined {
  return (["both", "jobs", "shifts", "none"] as const).find((m) => m === v);
}

/** Where "See all jobs & shifts" goes: the Work hub; its Shifts tab when there is nothing but shifts to show. */
export function workHubHref(w: WorkSet): string {
  return w.jobs.length === 0 && w.shifts.length > 0 ? WORK_HUB_SHIFTS : WORK_HUB;
}

/** How Home curates: one timely shift + up to three jobs (two once a shift takes its place). */
export function curateHome(w: WorkSet): { shifts: WorkShift[]; jobs: WorkJob[]; moreShifts: number } {
  if (w.shifts.length === 0) return { shifts: [], jobs: w.jobs.slice(0, 4), moreShifts: 0 };
  if (w.jobs.length === 0) return { shifts: w.shifts.slice(0, 2), jobs: [], moreShifts: Math.max(0, w.shifts.length - 2) };
  return { shifts: w.shifts.slice(0, 1), jobs: w.jobs.slice(0, 3), moreShifts: w.shifts.length - 1 };
}

/** How Local curates: one or two shifts, then jobs, four items in all. */
export function curateLocal(w: WorkSet): { shifts: WorkShift[]; jobs: WorkJob[] } {
  const shifts = w.shifts.slice(0, 2);
  return { shifts, jobs: w.jobs.slice(0, 4 - shifts.length) };
}
