import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CardSetup } from "@/components/payments/CardSetup";
import { ConnectPayoutsButton } from "@/components/payments/ConnectPayoutsButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments & banking" };

const NAVY = "#032f4c";

export default async function PaymentsPage() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/account/payments");

  const sb = await createClient();
  // Payout state can live on profiles (the webhook's source of truth) OR on
  // driver_profiles (where the Fetch driver onboarding historically wrote the
  // Connect account). Read both and coalesce, so a driver who connected in the
  // app isn't shown "Not connected" — and stuck — on the web.
  const [{ data }, { data: dp }] = await Promise.all([
    sb.from("profiles")
      .select("has_payment_method, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", account.id).maybeSingle(),
    sb.from("driver_profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("id", account.id).maybeSingle(),
  ]);
  const hasCard = !!data?.has_payment_method;
  const payoutAccountId = data?.stripe_account_id || dp?.stripe_account_id;
  const onboardingComplete = !!(data?.stripe_onboarding_complete || dp?.stripe_onboarding_complete);
  const payoutsConnected = !!(data?.stripe_payouts_enabled || dp?.stripe_payouts_enabled);
  const payoutsPending = !!payoutAccountId && !onboardingComplete;

  // Businesses the user owns — for the optional per-business overrides note.
  const { data: businesses } = await sb.from("local_businesses")
    .select("id, name, slug").eq("owner_id", account.id).eq("is_active", true).order("name");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <Link href="/account" className="text-sm font-semibold text-ink-soft hover:text-ink">← Account</Link>
      <div className="mt-4 mb-8">
        <h1 className="font-display text-4xl font-bold">Payments &amp; banking</h1>
        <p className="mt-2 text-lg text-ink-soft">Set up once, use everywhere. Your card pays for anything across OneShetland; your connected bank receives any payouts.</p>
      </div>

      {/* Payment card */}
      <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Payment card</h2>
          <span className="rounded-pill px-3 py-1 text-sm font-semibold" style={hasCard ? { background: "#DCFCE7", color: "#065F46" } : { background: "#FEF3C7", color: "#92400E" }}>{hasCard ? "On file ✓" : "Not set up"}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Used for Fetch deliveries, event tickets, hub donations and memberships. Stored securely by Stripe and only charged when you pay for something.</p>
        <div className="mt-4"><CardSetup accent={NAVY} hasCard={hasCard} /></div>
      </section>

      {/* Payouts / bank */}
      <section className="mt-5 rounded-card border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Payouts (bank account)</h2>
          <span className="rounded-pill px-3 py-1 text-sm font-semibold" style={payoutsConnected ? { background: "#DCFCE7", color: "#065F46" } : { background: "#FEF3C7", color: "#92400E" }}>{payoutsConnected ? "Connected ✓" : payoutsPending ? "Verifying…" : "Not connected"}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Connect a bank account to receive money you&apos;re owed — for example Fetch driving earnings. One connection covers everything you get paid for personally.</p>
        <div className="mt-4"><ConnectPayoutsButton accent={NAVY} connected={payoutsConnected} pending={payoutsPending} /></div>
      </section>

      {/* Business overrides */}
      {businesses && businesses.length > 0 && (
        <section className="mt-5 rounded-card border border-line bg-paper p-5 shadow-soft">
          <h2 className="font-display text-xl font-bold text-ink">Business payments &amp; payouts</h2>
          <p className="mt-1 text-sm text-ink-muted">By default your businesses use the central card and bank above. You can give a business its own card or payout account in its settings.</p>
          <div className="mt-3 space-y-2">
            {businesses.map((b) => (
              <Link key={b.id} href={`/directory/${b.slug ?? b.id}`} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink hover:bg-sand">
                {b.name}<span className="text-ink-faint">Manage →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-ink-faint">Payments and payouts are handled securely by Stripe. OneShetland never sees your full card or bank details.</p>
    </div>
  );
}
