"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  FETCH, DELIVERY_CATEGORIES, estimateFee, extractPostcode, penceToGBP, SERVICE_FEE_PENCE,
  type SavedAddress,
} from "@/lib/fetch-data";
import { PlaceAutocomplete, type PickedPlace } from "@/components/fetch/PlaceAutocomplete";

const empty: PickedPlace = { name: "", address: "", lat: null, lng: null, postcode: null };

export function RequestComposer({ isLoggedIn, hasCard }: { isLoggedIn: boolean; hasCard: boolean }) {
  const router = useRouter();

  const [categorySlug, setCategorySlug] = useState<string>("");
  const [pickup, setPickup] = useState<PickedPlace>(empty);
  const [pickupText, setPickupText] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [readyForCollection, setReadyForCollection] = useState(false);
  const [dest, setDest] = useState<PickedPlace>(empty);
  const [destText, setDestText] = useState("");
  const [destArea, setDestArea] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [liability, setLiability] = useState(false);

  const [feePence, setFeePence] = useState<number | null>(null);
  const [miles, setMiles] = useState<number | null>(null);
  const [feeMsg, setFeeMsg] = useState<string | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved addresses (mirrors the app's request step-3 picker).
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");

  const needsLiability = categorySlug === "pharmacy" || categorySlug === "takeaway";

  // Load the customer's saved addresses once, if signed in.
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data } = await sb
          .from("saved_addresses")
          .select("id, label, address, postcode, delivery_instructions")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (alive) setSavedAddresses((data as SavedAddress[] | null) ?? []);
      } catch { /* non-fatal — picker simply won't show */ }
    })();
    return () => { alive = false; };
  }, [isLoggedIn]);

  function applySavedAddress(addr: SavedAddress) {
    const full = addr.postcode ? `${addr.address} ${addr.postcode}` : addr.address;
    setDest({ name: addr.address, address: full, lat: null, lng: null, postcode: addr.postcode });
    setDestText(full);
    if (addr.delivery_instructions) setDeliveryNotes(addr.delivery_instructions);
    setShowSavedPicker(false);
  }

  // Recalculate the fee whenever both endpoints are known.
  useEffect(() => {
    let alive = true;
    async function calc() {
      setFeeMsg(null);
      if (pickup.lat != null && pickup.lng != null && dest.lat != null && dest.lng != null) {
        const { feePence: f, miles: m } = estimateFee(pickup.lat, pickup.lng, dest.lat, dest.lng);
        setFeePence(f); setMiles(m);
        return;
      }
      const pc1 = pickup.postcode || extractPostcode(pickupText);
      const pc2 = dest.postcode || extractPostcode(destText);
      if (!pc1 || !pc2) { setFeePence(null); setMiles(null); return; }
      setFeeLoading(true);
      try {
        const sb = createClient();
        const { data, error: fnErr } = await sb.functions.invoke("calculate-fee", {
          body: { pickup_postcode: pc1, destination_postcode: pc2 },
        });
        if (!alive) return;
        if (fnErr || data?.error) throw new Error(data?.error ?? "unavailable");
        setFeePence(data.fee_pence ?? null);
        setMiles(data.distance_miles ?? null);
      } catch {
        if (alive) { setFeePence(null); setFeeMsg("Pick both addresses from the suggestions to get a fee estimate."); }
      } finally {
        if (alive) setFeeLoading(false);
      }
    }
    void calc();
    return () => { alive = false; };
  }, [pickup, dest, pickupText, destText]);

  const canSubmit = useMemo(
    () => !!categorySlug && !!pickup.name.trim() && !!(dest.address || destText).trim() && !busy,
    [categorySlug, pickup, dest, destText, busy],
  );

  async function submit() {
    setError(null);
    if (!isLoggedIn) { router.push("/sign-in?next=/fetch/new"); return; }
    if (!hasCard) { router.push("/account/payments?next=/fetch/new"); return; }
    if (!categorySlug) { setError("Choose what you'd like delivered."); return; }
    if (needsLiability && !liability) { setError("Please acknowledge the liability notice."); return; }
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { data: inserted, error: insErr } = await sb.from("delivery_requests").insert({
        customer_id: user.id,
        category_slug: categorySlug,
        pickup_name: pickup.name || pickupText,
        pickup_location: pickup.address || pickupText,
        pickup_notes: pickupNotes.trim() || null,
        already_paid: alreadyPaid,
        ready_for_collection: readyForCollection,
        destination_region_id: null,
        destination_area: destArea.trim() || null,
        destination_address: dest.address || destText,
        contact_phone: contactPhone.trim() || null,
        delivery_notes: deliveryNotes.trim() || null,
        liability_acknowledged: liability,
        base_fee_pence: feePence ?? null,
        status: "pending",
      }).select("id").single();
      if (insErr) throw insErr;
      const id = inserted.id as string;
      // Optionally save this delivery address for next time (non-fatal).
      if (saveThisAddress && (dest.address || destText).trim()) {
        try {
          await sb.from("saved_addresses").insert({
            user_id: user.id,
            label: saveLabel.trim() || (destArea.trim() || "Saved address"),
            address: dest.address || destText,
            postcode: dest.postcode || extractPostcode(dest.address || destText),
            delivery_instructions: deliveryNotes.trim() || null,
          });
        } catch { /* non-fatal — request already created */ }
      }
      // Notify approved drivers (non-fatal).
      try { await sb.functions.invoke("notify-drivers", { body: { request_id: id } }); } catch { /* non-fatal */ }
      router.push(`/fetch/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your request.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Category */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold text-ink">What needs delivering?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {DELIVERY_CATEGORIES.map((c) => {
            const active = categorySlug === c.slug;
            return (
              <button key={c.slug} type="button" onClick={() => setCategorySlug(c.slug)}
                className="flex items-start gap-3 rounded-card border p-3 text-left transition"
                style={active ? { borderColor: FETCH, background: `${FETCH}0d` } : { borderColor: "var(--color-line)", background: "var(--color-paper)" }}>
                <span className="text-2xl">{c.icon}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-muted">{c.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Collection */}
      <section className="rounded-card border border-line bg-paper p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Collection</h2>
        <label className="mb-1 block text-sm font-semibold text-ink-soft">Where from?</label>
        <PlaceAutocomplete value={pickupText} placeholder="Search a shop or place — e.g. Lerwick Co-op"
          onChange={(t) => { setPickupText(t); setPickup((p) => ({ ...p, name: t, address: t })); }}
          onPick={(p) => { setPickup(p); setPickupText(p.address); }} />
        <textarea value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} placeholder="Collection notes (optional) — order name, counter, etc."
          className="mt-2 min-h-[64px] w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle label="Already paid" sub="Paid at the shop" checked={alreadyPaid} onChange={setAlreadyPaid} />
          <Toggle label="Ready for collection" sub="Item is ready now" checked={readyForCollection} onChange={setReadyForCollection} />
        </div>
      </section>

      {/* Delivery */}
      <section className="rounded-card border border-line bg-paper p-4 shadow-soft">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Delivery</h2>

        {/* Saved-address picker — mirrors the app's request step-3 */}
        {savedAddresses.length > 0 && (
          <div className="mb-3">
            <button type="button" onClick={() => setShowSavedPicker((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl border border-line bg-cream/40 px-3 py-2.5 text-left transition hover:bg-cream/70">
              <span className="text-lg">🏠</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Use a saved address</span>
                <span className="block text-xs text-ink-muted">Pick from your saved locations</span>
              </span>
              <span className="text-ink-faint">{showSavedPicker ? "▴" : "▾"}</span>
            </button>
            {showSavedPicker && (
              <ul className="mt-2 space-y-2">
                {savedAddresses.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => applySavedAddress(a)}
                      className="flex w-full items-start gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-left shadow-soft transition hover:border-line-strong">
                      <span className="text-lg">📍</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink">{a.label}</span>
                        <span className="block text-sm text-ink-soft">{a.address}</span>
                        {a.postcode && <span className="block text-sm text-ink-muted">{a.postcode}</span>}
                        {a.delivery_instructions && <span className="mt-0.5 block text-xs text-ink-muted">💬 {a.delivery_instructions}</span>}
                      </span>
                      <span className="text-ink-faint">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="mb-1 block text-sm font-semibold text-ink-soft">Deliver to</label>
        <PlaceAutocomplete value={destText} placeholder="Your address"
          onChange={(t) => { setDestText(t); setDest((p) => ({ ...p, address: t })); }}
          onPick={(p) => { setDest(p); setDestText(p.address); }} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={destArea} onChange={(e) => setDestArea(e.target.value)} placeholder="Area / village (optional)"
            className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint" />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone (optional)" inputMode="tel"
            className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint" />
        </div>
        <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Delivery notes (optional) — buzzer, where to leave it, etc."
          className="mt-2 min-h-[64px] w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint" />

        {/* Optionally save this address for next time */}
        {isLoggedIn && (
          <div className="mt-3">
            <Toggle label="Save this address" sub="Reuse it on your next delivery" checked={saveThisAddress} onChange={setSaveThisAddress} />
            {saveThisAddress && (
              <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} placeholder="Label (e.g. Home, Mum's)"
                className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint" />
            )}
          </div>
        )}
      </section>

      {/* Fee estimate */}
      <section className="rounded-card border-2 p-4" style={{ borderColor: `${FETCH}55`, background: `${FETCH}0a` }}>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Estimated delivery fee</p>
        {feeLoading ? (
          <p className="mt-1 text-sm text-ink-muted">Calculating based on distance…</p>
        ) : feePence != null ? (
          <>
            <p className="mt-1 font-display text-3xl font-extrabold text-ink">{penceToGBP(feePence + SERVICE_FEE_PENCE)}</p>
            {miles != null && <p className="text-sm text-ink-muted">~{miles} miles (road estimate)</p>}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>Delivery fee (your driver gets this)</span>
                <span>{penceToGBP(feePence)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-ink-muted">
                <span>OneShetland service fee</span>
                <span>{penceToGBP(SERVICE_FEE_PENCE)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Priced at 95p/mile with a £4.00 minimum. Your driver receives the full delivery fee; the service fee is OneShetland&apos;s share, added on top. Your card is pre-authorised when a driver accepts and only charged on delivery.</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">{feeMsg ?? "Choose both addresses to see your fee."}</p>
        )}
      </section>

      {/* Liability */}
      {needsLiability && (
        <section className="rounded-card border border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">⚠️ Liability notice</p>
          <p className="mt-1 text-sm text-amber-900/80">Chilled, frozen or high-value items are carried at your own risk. OneShetland Fetch is a community platform — drivers are volunteers, not professional couriers.</p>
          <Toggle label="I understand and accept these conditions" checked={liability} onChange={setLiability} amber />
        </section>
      )}

      {isLoggedIn && !hasCard && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          💳 <span className="font-semibold">Add a payment card first.</span> Your card is only charged when your item is delivered.{" "}
          <Link href="/account/payments?next=/fetch/new" className="font-semibold underline">Add a card in your profile →</Link>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button onClick={submit} disabled={!canSubmit}
        className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40" style={{ background: FETCH }}>
        {busy ? "Submitting…" : "Submit delivery request"}
      </button>
      <p className="text-center text-xs text-ink-faint">By submitting you agree to the Fetch community guidelines. No alcohol, tobacco, vapes, cash or passengers.</p>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange, amber }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; amber?: boolean;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-left">
      <span className="min-w-0">
        <span className={"block text-sm font-semibold " + (amber ? "text-amber-900" : "text-ink")}>{label}</span>
        {sub && <span className="block text-xs text-ink-muted">{sub}</span>}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition" style={{ background: checked ? FETCH : "var(--color-line-strong)" }}>
        <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (checked ? "translate-x-5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}
