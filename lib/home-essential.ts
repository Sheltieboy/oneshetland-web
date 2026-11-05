import type { NoticeCardModel } from "./notices-alerts.ts";

/** Essential alerts have THREE states, never two: shown, confirmed none, or could not be checked (timeout / error). */
export type HomeEssential =
  | { state: "alerts"; alerts: NoticeCardModel[]; scopedToMyAreas: boolean }
  | { state: "none"; scopedToMyAreas: boolean }
  | { state: "unavailable" };

/** Pure: turns the raw read (null = timed out / threw) into one of the three states. */
export function essentialState(r: { ok: true; data: NoticeCardModel[] } | { ok: false; error: string } | null, scopedToMyAreas: boolean): HomeEssential {
  if (!r || !r.ok) return { state: "unavailable" };
  return r.data.length > 0 ? { state: "alerts", alerts: r.data, scopedToMyAreas } : { state: "none", scopedToMyAreas };
}
