"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBasket, setLineQty, clearBasket, basketItemsPence, subscribeBasket, type Basket } from "@/lib/basket";
import { gbp, shippingQuote, type BusinessShipping } from "@/lib/shop-data";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { settleSavedCardPayment, type PaymentStart as ScaStart } from "@/lib/stripe-sca";

/**
 * /basket — basket + checkout in one place. One shop per checkout.
 * Fulfilment picker shows honest promises; postage quoted live from the
 * business's rate card as the postcode is typed. Pays by card (Stripe
 * PaymentElement; the webhook finalises) or Local Wallet (instant).
 */

const SHOP = "#4f46e5";

export default function BasketPage() {
  const router = useRouter();
  const [basket, setBasket] = useState<Basket | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [ship, setShip] = useState<BusinessShipping | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [fulfilment, setFulfilment] = useState<"collect" | "post" | "fetch">("collect");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [regionSlug, setRegionSlug] = useState("");
  const [regions, setRegions] = useState<{ slug: string; name: string }[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null); // order id

  useEffect(() => {
    const load = () => setBasket(getBasket());
    load(); setHydrated(true);
    return subscribeBasket(load);
  }, []);

  useEffect(() => {
    if (!basket) return;
    const sb = createClient();
    sb.from("business_shipping").select("*").eq("business_id", basket.business_id).maybeSingle()
      .then(({ data }) => setShip((data ?? null) as BusinessShipping | null));
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    sb.from("regions").select("slug, name").order("display_order")
      .then(({ data }) => setRegions((data ?? []) as { slug: string; name: string }[]));
  }, [basket?.business_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return null;

  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Order placed!</h1>
        <p className="mt-2 text-ink-soft">The shop&rsquo;s been told and you&rsquo;ll get updates as it moves. Thanks for buying local.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/account/orders" className="rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: SHOP }}>Track your order</Link>
          <Link href="/directory" className="rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-sand">Keep browsing</Link>
        </div>
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Your basket&rsquo;s empty</h1>
        <p className="mt-2 text-ink-soft">Everything you add from a shop lands here.</p>
        <Link href="/directory" className="mt-6 inline-block rounded-pill px-5 py-2.5 text-sm font-bold text-white" style={{ background: SHOP }}>Browse the Directory</Link>
      </div>
    );
  }

  const itemsPence = basketItemsPence(basket);
  const totalQty = basket.lines.reduce((s, l) => s + l.qty, 0);
  const anyCollectOnly = basket.lines.some((l) => l.collect_only);
  const allFreeUk = basket.lines.every((l) => l.free_uk_post);
  const collectOk = ship?.collect_enabled ?? true;
  const postOk = !!ship?.post_enabled && !anyCollectOnly;
  const fetchOk = !!ship?.fetch_enabled; // local hand-to-hand — collect-only items are fine
  const effFulfilment = fulfilment === "post" && postOk ? "post" : fulfilment === "fetch" && fetchOk ? "fetch" : "collect";
  const quote = effFulfilment === "post" ? (shippingQuote(ship, itemsPence, totalQty, postcode || "XX", allFreeUk) ?? 0) : 0;
  const total = itemsPence + quote;

  async function pay(payWith: "card" | "wallet") {
    setErr(null);
    if (signedIn === false) { router.push("/sign-in?next=/basket"); return; }
    if (effFulfilment !== "collect" && (!name.trim() || !address.trim() || !postcode.trim())) {
      setErr("Fill in the delivery name, address and postcode first."); return;
    }
    if (effFulfilment === "fetch" && !regionSlug) {
      setErr("Choose the area you want it dropped off in — that's how drivers find it."); return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke("create-product-order-intent", {
        body: {
          business_id: basket!.business_id,
          items: basket!.lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, qty: l.qty })),
          fulfilment: effFulfilment,
          delivery: effFulfilment !== "collect"
            ? { name, address, postcode, phone, region_slug: effFulfilment === "fetch" ? regionSlug : undefined }
            : undefined,
          note: note || undefined,
          pay_with: payWith,
        },
      });
      if (error) {
        // supabase-js buries the fn's JSON error body; surface it.
        const ctx = (error as { context?: Response }).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message ?? "Checkout failed");
      }

      // A saved-card charge the issuer wants authenticated is PAUSED, not failed:
      // complete THAT PaymentIntent instead of starting a second order.
      const settled = await settleSavedCardPayment(data as ScaStart);
      if (settled.outcome === "cancelled") { setBusy(false); return; }
      if (settled.outcome === "failed") throw new Error(settled.message);
      const scaCharged = settled.outcome === "succeeded";
      if (data.charged || scaCharged) { clearBasket(); setPlaced(data.order_id); return; }
      if (data.clientSecret) { setClientSecret(data.clientSecret); setPlaced(null); return; }
      throw new Error(data.error ?? "Checkout failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold text-ink">Your basket</h1>
      <p className="mt-1 text-sm text-ink-soft">From <b className="text-ink">{basket.business_name}</b> — checkout is one shop at a time.</p>

      {/* Lines */}
      <ul className="mt-5 space-y-2">
        {basket.lines.map((l) => (
          <li key={`${l.product_id}:${l.variant_id ?? ""}`} className="flex items-center gap-3 rounded-card border border-line bg-white p-3 shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.photo_url ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded-xl border border-line object-cover" />
              : <span className="grid h-14 w-14 place-items-center rounded-xl bg-cream">🛍️</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{l.title}</p>
              <p className="text-xs text-ink-muted">{l.variant_name ? `${l.variant_name} · ` : ""}{gbp(l.unit_pence)} each</p>
            </div>
            <div className="flex items-center rounded-pill border border-line">
              <button onClick={() => setLineQty(l.product_id, l.variant_id, l.qty - 1)} aria-label="Fewer" className="px-2.5 py-1.5 font-bold text-ink-soft">−</button>
              <span className="min-w-5 text-center text-sm font-bold">{l.qty}</span>
              <button onClick={() => setLineQty(l.product_id, l.variant_id, Math.min(99, l.qty + 1))} aria-label="More" className="px-2.5 py-1.5 font-bold text-ink-soft">＋</button>
            </div>
            <span className="w-16 text-right font-bold text-ink">{gbp(l.unit_pence * l.qty)}</span>
          </li>
        ))}
      </ul>

      {/* Fulfilment */}
      <div className="mt-6 rounded-card border border-line bg-white p-4 shadow-soft">
        <p className="font-display font-bold text-navy">How would you like it?</p>
        <div className="mt-3 space-y-2">
          {collectOk && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${effFulfilment === "collect" ? "border-2" : "border-line"}`} style={effFulfilment === "collect" ? { borderColor: SHOP } : undefined}>
              <input type="radio" name="fulfilment" checked={effFulfilment === "collect"} onChange={() => setFulfilment("collect")} className="mt-1" />
              <span><b className="text-ink">Collect from {basket.business_name}</b> — free
                {ship?.collect_note && <span className="block text-sm text-ink-soft">{ship.collect_note}</span>}</span>
            </label>
          )}
          {postOk && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${effFulfilment === "post" ? "border-2" : "border-line"}`} style={effFulfilment === "post" ? { borderColor: SHOP } : undefined}>
              <input type="radio" name="fulfilment" checked={effFulfilment === "post"} onChange={() => setFulfilment("post")} className="mt-1" />
              <span className="flex-1"><b className="text-ink">Post it</b> — {quote === 0 && allFreeUk ? "free" : postcode ? gbp(quote) : "enter postcode for price"}
                {effFulfilment === "post" && (
                  <span className="mt-2 grid gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="auth-input" aria-label="Delivery name" />
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="auth-input" aria-label="Delivery address" />
                    <span className="grid grid-cols-2 gap-2">
                      <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" className="auth-input" aria-label="Postcode" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="auth-input" aria-label="Phone" />
                    </span>
                  </span>
                )}
              </span>
            </label>
          )}
          {fetchOk && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${effFulfilment === "fetch" ? "border-2" : "border-line"}`} style={effFulfilment === "fetch" ? { borderColor: SHOP } : undefined}>
              <input type="radio" name="fulfilment" checked={effFulfilment === "fetch"} onChange={() => setFulfilment("fetch")} className="mt-1" />
              <span className="flex-1"><b className="text-ink">Fetch it 🚗</b> — a community driver brings it over
                <span className="block text-sm text-ink-soft">Your order joins the Fetch board and a driver picks it up when they&rsquo;re next passing — usually within a day or two. The driver&rsquo;s fee is separate: your card is authorised when they accept, and only charged once it&rsquo;s delivered. You&rsquo;ll need a card saved for this.</span>
                {effFulfilment === "fetch" && (
                  <span className="mt-2 grid gap-2">
                    <select value={regionSlug} onChange={(e) => setRegionSlug(e.target.value)} className="auth-input" aria-label="Drop-off area">
                      <option value="">Which area are you in?</option>
                      {regions.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                    </select>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="auth-input" aria-label="Delivery name" />
                    <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="auth-input" aria-label="Delivery address" />
                    <span className="grid grid-cols-2 gap-2">
                      <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" className="auth-input" aria-label="Postcode" />
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="auth-input" aria-label="Phone" />
                    </span>
                  </span>
                )}
              </span>
            </label>
          )}
          {anyCollectOnly && <p className="text-xs text-ink-muted">An item in your basket is collect-only, so posting isn&rsquo;t available for this order.</p>}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="A note for the shop (optional)" className="auth-input mt-3" aria-label="Note for the shop" />
      </div>

      {/* Totals + pay */}
      <div className="mt-6 rounded-card border border-line bg-white p-4 shadow-soft">
        <div className="space-y-1 text-sm text-ink-soft">
          <p className="flex justify-between"><span>Items</span><span>{gbp(itemsPence)}</span></p>
          <p className="flex justify-between"><span>{effFulfilment === "post" ? "Postage" : effFulfilment === "fetch" ? "Fetch delivery" : "Collection"}</span><span>{effFulfilment === "fetch" ? "Driver fee paid separately" : quote === 0 ? "Free" : gbp(quote)}</span></p>
          <p className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink"><span>Total</span><span>{gbp(total)}</span></p>
        </div>

        {err && <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">{err}</p>}

        {clientSecret ? (
          <div className="mt-4">
            <PaymentCheckout
              clientSecret={clientSecret}
              amountPence={total}
              accent={SHOP}
              payLabel={`Pay ${gbp(total)}`}
              onPaid={() => { clearBasket(); setPlaced("paid"); }}
              onCancel={() => setClientSecret(null)}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => pay("card")} disabled={busy}
              className="flex-1 rounded-pill px-6 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: SHOP }}>
              {busy ? "One sec…" : signedIn === false ? "Sign in to pay" : `Pay by card · ${gbp(total)}`}
            </button>
            {signedIn && (
              <button onClick={() => pay("wallet")} disabled={busy}
                className="rounded-pill border-2 px-6 py-3 text-sm font-bold disabled:opacity-50" style={{ borderColor: SHOP, color: SHOP }}>
                Pay with wallet
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">Sold by {basket.business_name}. Payments are processed by Stripe; OneShetland takes a small platform fee from the shop, never from you.</p>
      </div>
    </div>
  );
}
