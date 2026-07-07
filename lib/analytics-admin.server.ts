/**
 * analytics-admin.server.ts — server reads for the admin Analytics dashboard.
 * SERVER-ONLY. Calls the admin-gated SECURITY DEFINER RPCs as the logged-in
 * admin. Revenue comes from the ledgers (source of truth), not events.
 */
import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";

const safe = async <T>(p: Promise<T>, fallback: T, label: string): Promise<T> => {
  try { return await p; }
  catch (err) { console.error(`[analytics-admin] ${label} failed:`, err); return fallback; }
};

export interface AnalyticsOverview {
  range_days: number;
  generated_at: string;
  totals: { events: number; conversions: number; signups: number; unique_users: number; unique_visitors: number };
  by_category: { category: string; events: number; conversions: number }[];
  by_day: { day: string; events: number; conversions: number }[];
  top_events: { event_name: string; count: number; is_conversion: boolean }[];
  top_content: { object_type: string; count: number; distinct_items: number }[];
}

export interface RevenueStream { stream: string; orders: number; gross_pence: number; fees_pence: number }
export interface AnalyticsRevenue { range_days: number; streams: RevenueStream[] }
export interface SearchRow { query: string; section: string | null; searches: number; zero_result: number }

async function rpc<T>(fn: string, args: Record<string, unknown>, fallback: T, label: string): Promise<T> {
  return safe(
    (async () => {
      const sb = await createServerClient();
      const { data, error } = await sb.rpc(fn, args);
      if (error) throw error;
      return (data as T) ?? fallback;
    })(),
    fallback,
    label,
  );
}

export const getAnalyticsOverview = (days = 30) =>
  rpc<AnalyticsOverview | null>("analytics_overview", { p_days: days }, null, "overview");

export const getAnalyticsRevenue = (days = 30) =>
  rpc<AnalyticsRevenue | null>("analytics_revenue", { p_days: days }, null, "revenue");

export const getAnalyticsTopSearches = (days = 30, limit = 25) =>
  rpc<SearchRow[]>("analytics_top_searches", { p_days: days, p_limit: limit }, [], "top_searches");
