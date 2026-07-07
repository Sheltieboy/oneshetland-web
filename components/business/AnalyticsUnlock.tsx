"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAnalyticsAddonIntent } from "@/lib/business-client";
import { fetchWalletBalance, walletCheckout } from "@/lib/local-commerce-client";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";

// The analytics add-on is a flat £10/month — there's no price prop, so gate the wallet
// button on the known price (matches the app, which charges 1000p).
const PRICE_PENCE = 1000;

/**
 * Web purchase for the £10/mo analytics add-on (card only — wallet/Payment Sheet
 * are app-only). Starts the Stripe subscription via analytics-addon-intent:
 *   • saved card  → charged silently (activated) → refresh
 *   • no card     → render PaymentCheckout (Stripe Elements) to collect one
 * Stripe then auto-renews; the webhook flips the add-on on.
 */
export function AnalyticsUnlock({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const canWallet = walletPence != null && walletPence >= PRICE_PENCE;

  async function payFromWallet() {
    setBusy(true);
    setError(null);
    try {
      await walletCheckout({ type: "analytics_addon", business_id: businessId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay from your wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await createAnalyticsAddonIntent(businessId);
      if (res?.activated) {
        router.refresh();
        return;
      }
      if (res?.paymentIntent) {
        setClientSecret(res.paymentIntent);
        return;
      }
      throw new Error("Could not start payment.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (clientSecret) {
    return (
      <div className="mx-auto mt-5 max-w-md text-left">
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={1000}
          payLabel="Pay £10 & turn on analytics"
          onPaid={() => { setClientSecret(null); setTimeout(() => router.refresh(), 1500); }}
          onCancel={() => setClientSecret(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mt-5 flex flex-wrap gap-3">
        {canWallet && (
          <button
            onClick={payFromWallet}
            disabled={busy}
            className="inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Pay from wallet — £10/month"}
          </button>
        )}
        <button
          onClick={start}
          disabled={busy}
          className={canWallet
            ? "inline-block rounded-pill border border-line-strong px-6 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-60"
            : "inline-block rounded-pill bg-navy px-6 py-3 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-60"}
        >
          {busy ? "Starting…" : canWallet ? "Pay by card — £10/month" : "Add analytics — £10/month"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <p className="mt-3 text-xs text-ink-soft">Charged to your saved card (we&apos;ll collect one if needed). Auto-renews monthly · cancel anytime.</p>
    </div>
  );
}
