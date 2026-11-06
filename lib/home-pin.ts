/**
 * lib/home-pin.ts — the admin-managed "pinned" launch card at the head of the homepage For you strip.
 *
 * WHERE THE CONTENT LIVES. In the existing `home_content` row, which already has a public-read / admin-write policy and an editor at
 * /admin/homepage (components/admin/HomeContentForm.tsx). Six additive columns (migration 20261206000000_home_pin.sql): enabled, title, body,
 * button label, link, expiry. No new table. (Notices were considered and rejected: their public read function does not expose a pinned flag and
 * there is no admin screen for platform announcements, so reusing them would have meant a new function AND a new editor.)
 *
 * RULES. A card is shown only when it is switched on, has a title and a SAFE link (a site path, or https), and has not expired. The expiry is
 * an instant stored in the database, set from a date in the admin form as the end of that day in Shetland time.
 *
 * DISMISSAL. Per card and per device, remembered for good. The key is a hash of the card's wording and link — NOT its expiry — so extending the
 * end date does not bring a dismissed card back, while rewording it (a genuinely new message) does.
 */
import { publicClient } from "./supabase/public.ts";
import { resilient } from "./home-resilience.ts";

export const PIN_LIMITS = { title: 60, body: 140, cta: 24, href: 300 } as const;

export type PinRow = {
  pin_enabled?: boolean | null; pin_title?: string | null; pin_body?: string | null; pin_cta?: string | null;
  pin_href?: string | null; pin_expires_at?: string | null;
};
export type HomePin = { key: string; title: string; body: string; cta: string; href: string; expiresAt: string };

/** A site path ("/x", not "//x") or an https address. Anything else (javascript:, http:, protocol-relative, backslashes) is refused. */
export function safePinHref(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > PIN_LIMITS.href || /[\s\\<>"']/.test(s)) return null;
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^https:\/\/[^/]+/i.test(s)) return s;
  return null;
}

/** Small stable hash of the wording + link (djb2, base 36). */
export function pinKey(title: string, body: string, href: string): string {
  let h = 5381; const s = `${title.trim()}|${body.trim()}|${href.trim()}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "pin-" + (h >>> 0).toString(36);
}

export function pinFromRow(row: PinRow | null | undefined, now: number = Date.now()): HomePin | null {
  if (!row || row.pin_enabled !== true) return null;
  const title = String(row.pin_title ?? "").replace(/\s+/g, " ").trim().slice(0, PIN_LIMITS.title);
  const href = safePinHref(row.pin_href);
  const exp = row.pin_expires_at ? Date.parse(row.pin_expires_at) : NaN;
  if (!title || !href || !Number.isFinite(exp) || exp <= now) return null;
  const body = String(row.pin_body ?? "").replace(/\s+/g, " ").trim().slice(0, PIN_LIMITS.body);
  const cta = String(row.pin_cta ?? "").replace(/\s+/g, " ").trim().slice(0, PIN_LIMITS.cta) || "Take a look";
  return { key: pinKey(title, body, href), title, body, cta, href, expiresAt: row.pin_expires_at as string };
}

/**
 * The live pinned card, for a SIGNED-IN member only (the caller decides). One tiny read of the one-row table, kept for 60 s per server instance,
 * bounded at 1.2 s (the last good copy is used for up to 10 minutes if the database is slow); a failure (or the columns not existing yet) means "no pinned card" — never an error, never a slow page.
 */
export const PIN_READ_DEADLINE_MS = 1200;

const defaultLoad = async (): Promise<PinRow | null> => {
  const { data, error } = await publicClient().from("home_content").select("pin_enabled, pin_title, pin_body, pin_cta, pin_href, pin_expires_at").limit(1).maybeSingle();
  if (error) return null;
  return (data ?? null) as PinRow | null;
};

export async function getHomePin(load: () => Promise<PinRow | null> = defaultLoad, deadlineMs: number = PIN_READ_DEADLINE_MS): Promise<HomePin | null> {
  const row = await resilient<PinRow | null>("home:pin", { ttlMs: 60_000, staleMs: 10 * 60_000, deadlineMs, fallback: null, isEmpty: () => false }, load);
  return pinFromRow(row);
}

/* ── admin form helpers: a plain date <-> the end of that day in Shetland time ─────────────────────────────────────────────── */

function londonOffsetMs(utcMs: number): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs)).reduce<Record<string, number>>((a, x) => (x.type === "literal" ? a : { ...a, [x.type]: Number(x.value) }), {});
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-12-31" -> the instant the day AFTER begins in Shetland time (so the card is live all through the 31st). null if not a real date. */
export function expiryFromDate(d: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim()); if (!m) return null;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, da));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== da) return null;
  const midnightUtc = Date.UTC(y, mo - 1, da + 1);
  let t = midnightUtc - londonOffsetMs(midnightUtc);
  t = midnightUtc - londonOffsetMs(t);
  return new Date(t).toISOString();
}

/** The last day a stored expiry is live, as "YYYY-MM-DD" in Shetland time (for the admin date box). */
export function dateFromExpiry(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN; if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t - 1));
}

export function validatePinDraft(d: { enabled: boolean; title: string; body: string; cta: string; href: string; expiresAt: string | null }, now: number = Date.now()): string | null {
  if (!d.enabled) return null;
  if (!d.title.trim()) return "Add a title for the pinned card.";
  if (d.title.trim().length > PIN_LIMITS.title) return `Keep the title to ${PIN_LIMITS.title} characters.`;
  if (d.body.trim().length > PIN_LIMITS.body) return `Keep the line of text to ${PIN_LIMITS.body} characters.`;
  if (d.cta.trim().length > PIN_LIMITS.cta) return `Keep the button label to ${PIN_LIMITS.cta} characters.`;
  if (!safePinHref(d.href)) return "The link must be a page on this site (starting with /) or a full https:// address.";
  if (!d.expiresAt) return "Choose the last day the card should show.";
  if (Date.parse(d.expiresAt) <= now) return "The last day must be today or later.";
  return null;
}
