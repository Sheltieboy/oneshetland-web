import Link from "next/link";
import { Suspense } from "react";
import { requireHubAdmin } from "@/lib/hubs-server";
import { PayoutButton } from "@/components/hubs/admin/PayoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

export default async function PayoutsPage(
  { params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ next?: string }>;
  },
) {
  const { id } = await params;
  const { next } = await searchParams;
  const { hub, accent } = await requireHubAdmin(id);
  // Arrived from membership tiers? Go back there rather than dropping the admin
  // at the management index to find their way again.
  const backToTiers = next === "tiers";
  const backHref = `/hubs/${hub.slug || hub.id}/manage${backToTiers ? "/tiers" : ""}`;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={backHref} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Back to {backToTiers ? "membership tiers" : "management"}</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Payouts</h1>
      <p className="mt-2 text-ink-soft">
        To take paid memberships or donations, connect a payout account with Stripe.
        Money is paid straight to your hub. Stripe opens in a small window — you can
        complete it without leaving this page.
      </p>
      <div className="mt-6 rounded-xl border border-line bg-paper p-6 shadow-soft">
        <Suspense fallback={null}>
          <PayoutButton hubId={hub.id} accent={accent} label="Set up payouts with Stripe" />
        </Suspense>
        <p className="mt-3 text-xs text-ink-muted">
          Powered by Stripe Connect. Your payout status updates automatically once Stripe confirms your account.
        </p>
      </div>
    </div>
  );
}
