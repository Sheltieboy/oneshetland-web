/**
 * lib/saved-for-you.ts — what a member's My Saved contributes to the homepage For you strip: only what is genuinely COMING UP.
 *   • events and activities (the saved date, or the next one) in the next 7 days;
 *   • jobs closing within 14 days.
 * Never a cancelled, closed, past or unavailable item; never a business (a saved business has no date). At most two, soonest first, so the strip
 * stays short. Pure: the loader passes the rows my_saved_list returned for this member (their own rights); the link is the same one My Saved uses.
 */
import { itemHref, type SavedItem } from "./saved.ts";
import type { ForYouItem } from "./for-you.server.ts";

const DAY = 86_400_000;
const TZ = "Europe/London";
const ymd = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(t);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
const OK = new Set(["upcoming", "ok", "changed"]);

export function whenLabel(iso: string, now: number): { text: string; cue?: string } {
  const t = Date.parse(iso);
  if (ymd(t) === ymd(now)) return { text: `Today, ${clock(iso)}`, cue: "Today" };
  if (ymd(t) === ymd(now + DAY)) return { text: `Tomorrow, ${clock(iso)}`, cue: "Tomorrow" };
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(t);
  return { text: `${day}, ${clock(iso)}` };
}

export function savedToForYou(items: readonly SavedItem[], now: number = Date.now(), max = 2): ForYouItem[] {
  const out: (ForYouItem & { at: number })[] = [];
  for (const i of items) {
    if (!OK.has(i.state) || !i.title || i.from_snapshot) continue;
    const href = itemHref(i);
    if (!href) continue;
    if (i.item_type === "event" || i.item_type === "activity") {
      const at = i.starts_at ? Date.parse(i.starts_at) : NaN;
      const end = i.ends_at ? Date.parse(i.ends_at) : at;
      if (!Number.isFinite(at) || end < now || at > now + 7 * DAY) continue;
      const w = whenLabel(i.starts_at as string, Math.max(now, 0));
      out.push({ at, id: `saved-${i.item_type}-${i.item_id}-${i.occurrence_key ?? ""}`, kind: "saved", priority: 5, icon: "saved", title: i.title, subtitle: `From your saved · ${w.text}`, href, cue: w.cue, accent: "#4f46e5", ts: at });
    } else if (i.item_type === "job") {
      const closes = i.ends_at ? Date.parse(i.ends_at) : NaN;
      if (!Number.isFinite(closes) || closes < now || closes > now + 14 * DAY) continue;
      const days = Math.max(0, Math.ceil((closes - now) / DAY));
      out.push({ at: closes, id: `saved-job-${i.item_id}`, kind: "saved", priority: 6, icon: "saved", title: i.title, subtitle: `From your saved · closes ${days <= 1 ? "soon" : `in ${days} days`}`, href, accent: "#2a8b5c", ts: closes });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, max).map((x) => { const { at, ...rest } = x; void at; return rest; });
}
