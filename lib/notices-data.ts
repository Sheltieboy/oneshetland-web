/**
 * notices-data.ts — server-side readers for the Notices & Alerts pages. Public reads use the anonymous client (the RPCs are the only door);
 * member reads use the signed-in user's own session. Each reader returns { ok, data | error } so a page can say plainly that something could not
 * be loaded - an outage must not look like "no notices".
 */
import { publicClient } from "./supabase/public";
import { createClient as createServerClient } from "./supabase/server";
import { callRpc, type RpcResult } from "./notices-rpc";
import {
  PAGE_SIZE, cleanAreaIds, planChunks, sliceForPage, toFuneralViews, toNoticeCards, toNoticePrefs,
  type FuneralView, type NoticeCardModel, type NoticePrefs,
} from "./notices-alerts";

export type AreaOption = { id: string; name: string; type: string; parent_id: string | null };

/** Active essential alerts (the reserved top slot). areaIds: null = all, [] = Shetland-wide only, [..] = those areas. */
export async function getEssentialAlerts(areaIds: string[] | null): Promise<RpcResult<NoticeCardModel[]>> {
  const r = await callRpc(publicClient(), "get_essential_alerts", { p_area_ids: areaIds });
  return r.ok ? { ok: true, data: toNoticeCards(r.data).map((c) => ({ ...c, isEssential: true, level: 1 as const })) } : r;
}

export async function getPublicNotices(opts: { level?: "all" | "essential" | "official" | "community"; areaIds?: string[] | null; category?: string | null; limit?: number; offset?: number }): Promise<RpcResult<NoticeCardModel[]>> {
  const r = await callRpc(publicClient(), "get_public_notices", {
    p_level: opts.level ?? "all", p_area_ids: opts.areaIds ?? null, p_category: opts.category ?? null, p_limit: opts.limit ?? 20, p_offset: opts.offset ?? 0,
  });
  return r.ok ? { ok: true, data: toNoticeCards(r.data) } : r;
}

/** "Show more": the first `page` pages, fetched in the chunks the RPC allows, with a flag for whether there is more. */
export async function getNoticesPage(opts: { level: "all" | "essential" | "official" | "community"; areaIds: string[] | null; category: string | null; page: number }): Promise<RpcResult<{ rows: NoticeCardModel[]; hasMore: boolean }>> {
  const chunks = await Promise.all(planChunks(opts.page).map((c) => getPublicNotices({ ...opts, limit: c.limit, offset: c.offset })));
  const bad = chunks.find((c) => !c.ok);
  if (bad && !bad.ok) return bad;
  const all = chunks.flatMap((c) => (c.ok ? c.data : []));
  return { ok: true, data: sliceForPage(all, opts.page, PAGE_SIZE) };
}

/** A single PUBLIC notice by id (get_public_notice). null = not public or unknown (404). */
export async function getPublicNotice(id: string): Promise<RpcResult<NoticeCardModel | null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  const r = await callRpc(publicClient(), "get_public_notice", { p_id: id });
  return r.ok ? { ok: true, data: toNoticeCards(r.data)[0] ?? null } : r;
}

export async function getFuneralNotices(opts: { areaIds?: string[] | null; page?: number }): Promise<RpcResult<{ rows: FuneralView[]; hasMore: boolean }>> {
  const page = opts.page ?? 1;
  const chunks = await Promise.all(planChunks(page).map((c) => callRpc(publicClient(), "get_funeral_notices", { p_area_ids: opts.areaIds ?? null, p_limit: c.limit, p_offset: c.offset })));
  const bad = chunks.find((c) => !c.ok);
  if (bad && !bad.ok) return bad;
  const all = chunks.flatMap((c) => (c.ok ? toFuneralViews(c.data) : []));
  return { ok: true, data: sliceForPage(all, page, PAGE_SIZE) };
}

export async function getFuneralNotice(id: string): Promise<RpcResult<FuneralView | null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: true, data: null };
  const r = await callRpc(publicClient(), "get_funeral_notice", { p_id: id });
  if (!r.ok) return r;
  return { ok: true, data: toFuneralViews(r.data)[0] ?? null };
}

/**
 * The physical areas people can filter by. Source: the `areas` table (public read). If that returns nothing (a backend without it) the options are
 * DERIVED from the areas named by the notices currently public, so the filter still works.
 */
export async function getAreaOptions(fallbackFrom: NoticeCardModel[] = []): Promise<AreaOption[]> {
  try {
    const { data, error } = await publicClient().from("areas").select("id, name_display, type, parent_id, sort_order, is_physical").eq("is_active", true).eq("is_physical", true).order("sort_order", { ascending: true });
    if (!error && Array.isArray(data)) {
      return (data as { id: string; name_display: string; type: string; parent_id: string | null }[]).map((a) => ({ id: a.id, name: a.name_display, type: a.type, parent_id: a.parent_id }));
    }
  } catch { /* fall through to derived */ }
  return deriveAreaOptions(fallbackFrom);
}

export function deriveAreaOptions(cards: NoticeCardModel[]): AreaOption[] {
  const m = new Map<string, string>();
  for (const c of cards) c.areaIds.forEach((id, i) => { if (id !== "shetland_wide" && !m.has(id) && c.areaNames[i]) m.set(id, c.areaNames[i]); });
  return [...m].map(([id, name]) => ({ id, name, type: "area", parent_id: null })).sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

/** The signed-in member's chosen areas; null when signed out or the read failed (never confused with "none chosen" = []). */
export async function getMyAreas(): Promise<string[] | null> {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const r = await callRpc<unknown>(sb, "my_notice_areas");
    return r.ok && Array.isArray(r.data) ? cleanAreaIds(r.data) : null;
  } catch { return null; }
}

export async function getMyNoticePrefs(): Promise<RpcResult<NoticePrefs>> {
  const sb = await createServerClient();
  const r = await callRpc(sb, "my_notice_prefs");
  return r.ok ? { ok: true, data: toNoticePrefs(r.data) } : r;
}
