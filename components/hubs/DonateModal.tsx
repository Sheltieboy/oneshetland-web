"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startDonation, confirmDonation, type GiftAid } from "@/lib/hubs-client";
import { fetchWalletBalance, walletCheckout } from "@/lib/local-commerce-client";
import { gbp } from "@/lib/stripe";

const PRESETS = [500, 1000, 2000, 5000];

export function DonateModal({
  open,
  onClose,
  campaignId,
  hubName,
  accent,
  isCharity,
  isLoggedIn,
  signInHref,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  hubName: string;
  accent: string;
  isCharity: boolean;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [coverFees, setCoverFees] = useState(false);
  const [giftAid, setGiftAid] = useState(false);
  const [ga, setGa] = useState<GiftAid>({ first_name: "", last_name: "", address: "", postcode: "" });
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [walletPence, setWalletPence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pence = custom ? Math.round(parseFloat(custom) * 100) : amount;
  const validAmount = pence >= 100;
  const coverPence = Math.round(pence * 0.015) + 20; // ~Stripe fee
  const chargePence = pence + (coverFees ? coverPence : 0);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, isLoggedIn]);

  const canWallet = walletPence != null && walletPence >= pence;

  async function toPayment() {
    if (!validAmount) return setError("Please enter at least £1.");
    if (giftAid && (!ga.first_name || !ga.last_name || !ga.address || !ga.postcode)) {
      return setError("Please complete your Gift Aid details.");
    }
    setError(null);
    setBusy(true);
    try {
      const res = await startDonation(campaignId, pence, true, coverFees);   // use the donor's saved card (server shows the card form if none)
      if (res.charged) {
        await confirmDonation(res.payment_intent_id, { message, anonymous, giftAid: giftAid ? ga : null });
        setStep("done");
        router.refresh();
        return;
      }
      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
        setPiId(res.payment_intent_id);
        setStep("pay");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the donation.");
    } finally {
      setBusy(false);
    }
  }

  async function payFromWallet() {
    if (!validAmount) return setError("Please enter at least £1.");
    if (giftAid && (!ga.first_name || !ga.last_name || !ga.address || !ga.postcode)) {
      return setError("Please complete your Gift Aid details.");
    }
    setError(null);
    setBusy(true);
    try {
      await walletCheckout({ type: "hub_donation", campaign_id: campaignId, amount_pence: pence, message, anonymous, gift_aid: giftAid ? ga : null });
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pay from your wallet.");
    } finally {
      setBusy(false);
    }
  }

  const giftAidValue = giftAid ? ga : null;

  return (
    <Modal open={open} onClose={onClose} title={`Donate to ${hubName}`} accent={accent}>
      {!isLoggedIn ? (
        <div>
          <p className="text-ink-soft">Please sign in to donate — it keeps your giving and Gift Aid in one place.</p>
          <Link href={signInHref} className="mt-4 inline-block rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>
            Sign in
          </Link>
        </div>
      ) : step === "done" ? (
        <div className="py-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl text-paper" style={{ background: accent }}>♥</span>
          <h3 className="mt-4 font-display text-2xl font-bold">Thank you!</h3>
          <p className="mt-2 text-ink-soft">Your donation of {gbp(pence)} to {hubName} is much appreciated.</p>
          <button onClick={onClose} className="mt-5 rounded-pill px-5 py-2.5 font-semibold text-paper" style={{ background: accent }}>Done</button>
        </div>
      ) : step === "pay" && clientSecret && piId ? (
        <PaymentCheckout
          clientSecret={clientSecret}
          amountPence={chargePence}
          accent={accent}
          payLabel={`Donate ${gbp(chargePence)}`}
          onPaid={async () => {
            await confirmDonation(piId, { message, anonymous, giftAid: giftAidValue });
            setStep("done");
            router.refresh();
          }}
          onCancel={() => setStep("form")}
        />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Amount</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { setAmount(p); setCustom(""); }}
                  className={"rounded-xl border px-2 py-2.5 text-sm font-bold transition " + (!custom && amount === p ? "text-paper" : "border-line bg-paper text-ink hover:border-current")}
                  style={!custom && amount === p ? { background: accent, borderColor: accent } : { color: accent }}>
                  {gbp(p)}
                </button>
              ))}
            </div>
            <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal"
              placeholder="Other amount (£)" className="auth-input mt-2" />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">Message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="auth-input" placeholder="A word of support…" />
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-current" style={{ accentColor: accent }} />
            <span className="text-sm text-ink-soft">Donate anonymously (hide my name from the supporters wall)</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
            <input type="checkbox" checked={coverFees} onChange={(e) => setCoverFees(e.target.checked)} className="mt-0.5 h-5 w-5" style={{ accentColor: accent }} />
            <span className="text-sm text-ink-soft">Add {gbp(coverPence)} to cover card fees, so {hubName} receives your full {gbp(pence)}.</span>
          </label>

          {isCharity && (
            <div className="rounded-xl border border-line bg-paper p-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={giftAid} onChange={(e) => setGiftAid(e.target.checked)} className="h-5 w-5" style={{ accentColor: accent }} />
                <span className="text-sm font-semibold text-ink">Add Gift Aid (+25% at no cost to you)</span>
              </label>
              {giftAid && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-ink-muted">I am a UK taxpayer and want {hubName} to claim Gift Aid on my donation.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={ga.first_name} onChange={(e) => setGa({ ...ga, first_name: e.target.value })} placeholder="First name" className="auth-input" />
                    <input value={ga.last_name} onChange={(e) => setGa({ ...ga, last_name: e.target.value })} placeholder="Last name" className="auth-input" />
                  </div>
                  <input value={ga.address} onChange={(e) => setGa({ ...ga, address: e.target.value })} placeholder="Home address" className="auth-input" />
                  <input value={ga.postcode} onChange={(e) => setGa({ ...ga, postcode: e.target.value })} placeholder="Postcode" className="auth-input" />
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

          {canWallet && (
            <button onClick={payFromWallet} disabled={busy || !validAmount}
              className="w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50" style={{ background: accent }}>
              {busy ? "Please wait…" : `Donate ${gbp(pence)} from wallet`}
            </button>
          )}
          <button onClick={toPayment} disabled={busy || !validAmount}
            className={canWallet
              ? "w-full rounded-pill border border-line-strong px-5 py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-50"
              : "w-full rounded-pill px-5 py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-50"}
            style={canWallet ? undefined : { background: accent }}>
            {busy ? "Please wait…" : `Continue · ${gbp(chargePence)}`}
          </button>
        </div>
      )}
    </Modal>
  );
}
