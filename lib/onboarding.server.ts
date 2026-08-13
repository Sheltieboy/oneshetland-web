import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import type { OnboardingState } from "@/lib/onboarding";

/**
 * One read for the whole wizard. Mirrors the payout coalescing in
 * app/account/payments/page.tsx — payout state can live on `profiles` (the
 * webhook's source of truth) OR on `driver_profiles` (where Fetch driver
 * onboarding historically wrote the Connect account), so a driver who
 * connected in the app must not be told "not connected" and sent round again.
 */
export async function getOnboardingState(): Promise<OnboardingState | null> {
  const account = await getAccount();
  if (!account) return null;

  const sb = await createClient();
  const [{ data: p }, { data: dp }, { data: businesses }] = await Promise.all([
    sb
      .from("profiles")
      .select(
        "full_name, display_name, location_area, avatar_url, games_handle, has_payment_method, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled",
      )
      .eq("id", account.id)
      .maybeSingle(),
    sb
      .from("driver_profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", account.id)
      .maybeSingle(),
    sb
      .from("local_businesses")
      .select("id, name, slug")
      .eq("owner_id", account.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  const payoutAccountId = p?.stripe_account_id || dp?.stripe_account_id;
  const onboardingComplete = Boolean(
    p?.stripe_onboarding_complete || dp?.stripe_onboarding_complete,
  );

  return {
    userId: account.id,
    email: account.email,
    fullName: p?.full_name ?? "",
    displayName: p?.display_name ?? "",
    locationArea: p?.location_area ?? "",
    avatarUrl: p?.avatar_url ?? "",
    gamesHandle: p?.games_handle ?? "",
    hasCard: Boolean(p?.has_payment_method),
    payoutsConnected: Boolean(p?.stripe_payouts_enabled || dp?.stripe_payouts_enabled),
    payoutsPending: Boolean(payoutAccountId) && !onboardingComplete,
    ownedBusinesses: (businesses ?? []) as OnboardingState["ownedBusinesses"],
  };
}
