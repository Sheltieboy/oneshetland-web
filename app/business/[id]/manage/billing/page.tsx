import Link from "next/link";
import { requireBusinessOwner } from "@/lib/business-server";
import { commercialTermsGate } from "@/lib/commercial-terms.server";
import { getBookingMeter } from "@/lib/business-data.server";
import { BillingManager } from "@/components/business/BillingManager";
import { createClient } from "@/lib/supabase/server";
import { liveLaunchGrant, type LaunchGrantRow } from "@/lib/launch-grant";
import { HelpTip } from "@/components/help/HelpTip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan, payments & payouts" };

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { id } = await params;
  const { plan } = await searchParams;
  const intentTier = plan === "pro" || plan === "premium" ? plan : undefined;
  const { business } = await requireBusinessOwner(id);
  // One acceptance per business covers every commercial screen. Directory
  // management is deliberately not gated — see lib/commercial-terms.server.
  const gate = await commercialTermsGate(business, "Payments and payouts");
  if (gate) return gate;
  const meter = business.subscription_tier === "pro" ? await getBookingMeter(business.id) : null;
  // A manually granted launch plan is Pro/Premium with an end date and no subscription. The owner may read their
  // own grant, so the card can say so instead of showing a price and a renewal that do not exist.
  const sb = await createClient();
  const { data: grantRows } = await sb
    .from("launch_plan_grants")
    .select("tier, expires_at, revoked_at, superseded_at")
    .eq("business_id", business.id)
    .is("revoked_at", null)
    .is("superseded_at", null);
  const launchGrant = liveLaunchGrant(grantRows as LaunchGrantRow[] | null, business.subscription_connected);
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/business/${business.id}/manage`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {business.name}</Link>
      <h1 className="mt-3 mb-6 font-display text-3xl font-bold sm:text-4xl flex items-center gap-2.5">
          Plan, payments &amp; payouts
          <HelpTip topic="plans-tier" />
        </h1>
      <BillingManager business={business} intentTier={intentTier} meter={meter} launchGrant={launchGrant} />
    </div>
  );
}
