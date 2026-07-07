"use client";

import { createClient } from "@/lib/supabase/client";

/* ──────────────────────────────────────────────────────────────────────────────
   Business follows — web mirror of the app's lib/local-api.ts
   (oneshetland-delivers): followBusiness / unfollowBusiness / isFollowing /
   fetchFollowedBusinessIds.

   Table: local_business_follows (user_id, business_id) — composite PK.            */

export async function isFollowingBusiness(businessId: string): Promise<boolean> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { data } = await sb
    .from("local_business_follows")
    .select("business_id")
    .eq("user_id", auth.user.id)
    .eq("business_id", businessId)
    .maybeSingle();
  return !!data;
}

export async function followBusiness(businessId: string): Promise<void> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Sign in to follow this business.");
  const { error } = await sb
    .from("local_business_follows")
    .upsert(
      { user_id: auth.user.id, business_id: businessId },
      { onConflict: "user_id,business_id" },
    );
  if (error) throw error;
}

export async function unfollowBusiness(businessId: string): Promise<void> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Sign in to manage follows.");
  const { error } = await sb
    .from("local_business_follows")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("business_id", businessId);
  if (error) throw error;
}

export interface FollowedBusiness {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  address: string | null;
  slug: string | null;
  is_verified: boolean;
}

/** Businesses the signed-in user follows, with display fields joined. */
export async function fetchFollowedBusinesses(): Promise<FollowedBusiness[]> {
  const sb = createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data: rows, error } = await sb
    .from("local_business_follows")
    .select("business_id, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r: { business_id: string }) => r.business_id);
  const { data: biz } = await sb
    .from("local_businesses")
    .select("id, name, category, logo_url, cover_url, brand_color, address, slug, is_verified")
    .in("id", ids)
    .eq("is_active", true);

  const bizMap = Object.fromEntries(((biz ?? []) as FollowedBusiness[]).map((b) => [b.id, b]));
  // Preserve follow order (most-recent first), drop any inactive/missing.
  return ids
    .map((id: string) => bizMap[id])
    .filter((b): b is FollowedBusiness => !!b);
}
