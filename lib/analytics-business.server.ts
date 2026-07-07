/**
 * analytics-business.server.ts — server read for the SELLER analytics dashboard.
 * SERVER-ONLY. Calls the ownership-gated business_analytics RPC as the logged-in
 * owner. `full` is null unless the business has the £10 analytics add-on (admins
 * always get full). Revenue comes from the ledgers.
 */
import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";

export interface BusinessAnalyticsBasic {
  profile_views: number; unique_viewers: number; followers: number; contacts: number;
}
export interface BusinessAnalyticsFull {
  views_by_day: { day: string; views: number }[];
  contacts_by_method: { method: string; count: number }[];
  saves: number;
  busiest_dow: { dow: number; views: number }[];
  bookings: number; booking_revenue_pence: number;
  unit_sales: number; unit_revenue_pence: number;
  tickets_sold: number; ticket_revenue_pence: number;
  loyalty_stamps: number; loyalty_rewards: number; offer_redemptions: number;
  job_applications: number; shift_applications: number;
}
export interface BusinessAnalytics {
  business_id: string; range_days: number; has_addon: boolean; is_admin_view: boolean;
  basic: BusinessAnalyticsBasic;
  full: BusinessAnalyticsFull | null;
}

export async function getBusinessAnalytics(businessId: string, days = 30): Promise<BusinessAnalytics | null> {
  try {
    const sb = await createServerClient();
    const { data, error } = await sb.rpc("business_analytics", { p_business_id: businessId, p_days: days });
    if (error) throw error;
    return data as BusinessAnalytics;
  } catch (err) {
    console.error("[analytics-business] getBusinessAnalytics failed:", err);
    return null;
  }
}
