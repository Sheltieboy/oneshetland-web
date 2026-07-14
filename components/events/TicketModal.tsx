"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startTicketPurchase, confirmTicketPurchase, type LineItem } from "@/lib/events-client";
import { fetchWalletBalance } from "@/lib/local-commerce-client";

const EVENTS = "#d4921a";
// Must match the app (app/event-ticket-checkout.tsx) and the create-event-ticket-intent
// edge function, which is authoritative for the actual charge.
const BOOKING_FEE_PENCE = 95;

function gbp(pence: number) {
  return pence <= 0 ? "Free" : `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

type TicketType = {
  id: string;
  name: string;
  price_pence: number;
  description: string | null;
};

type Step = "select" | "pay" | "done";

export function TicketModal({
  open,
  onClose,
  eventId,
  eventTitle,
  ticketTypes,
  isLoggedIn,
  signInHref,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  ticketTypes: TicketType[];
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [walletPence, setWalletPence] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, isLoggedIn]);

  function reset() {
    setStep("select");
    setQty({});
    setBusy(false);
    setError(null);
    setClientSecret(null);
    setOrderId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const lineItems: LineItem[] = ticketTypes
    .filter((t) => (qty[t.id] ?? 0) > 0)
    .map((t) => ({ ticket_type_id: t.id, quantity: qty[t.id] }));

  const totalTickets = lineItems.reduce((s, li) => s + li.quantity, 0);
  const faceValuePence = ticketTypes.reduce(
    (s, t) => s + (qty[t.id] ?? 0) * t.price_pence,
    0,
  );
  const isPaid = faceValuePence > 0;
  const bookingFeePence = isPaid ? BOOKING_FEE_PENCE * totalTickets : 0;
  const totalPence = faceValuePence + bookingFeePence;
  const canWallet = walletPence != null && isPaid && walletPence >= totalPence;

  async function proceed(viaWallet = false) {
    if (lineItems.length === 0) return;
    if (!isLoggedIn) { window.location.href = signInHref; return; }
    setBusy(true);
    setError(null);
    try {
      const result = await startTicketPurchase(eventId, lineItems, viaWallet ? { payWithWallet: true } : {});
      if ("free" in result || "charged" in result) {
        setTicketCount(totalTickets);
        setStep("done");
      } else {
        setClientSecret(result.clientSecret);
        setOrderId(result.order_id);
        setStep("pay");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePaid() {
    if (!orderId || !clientSecret) return;
    // Extract payment intent ID from client secret
    const paymentIntentId = clientSecret.split("_secret_")[0];
    try {
      const res = await confirmTicketPurchase(orderId, paymentIntentId);
      setTicketCount(res.tickets_count ?? totalTickets);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm tickets.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={step === "done" ? handleClose : handleClose}
      title={step === "done" ? "You're going!" : "Get tickets"}
      accent={EVENTS}
    >
      {step === "select" && (
        <div className="space-y-5">
          {/* Ticket type rows */}
          <ul className="space-y-3">
            {ticketTypes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4 shadow-soft">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{t.name}</p>
                  {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
                  <p className="mt-0.5 font-display font-bold" style={{ color: EVENTS }}>
                    {gbp(t.price_pence)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => setQty((q) => ({ ...q, [t.id]: Math.max(0, (q[t.id] ?? 0) - 1) }))}
                    className="grid h-8 w-8 place-items-center rounded-full border border-line-strong font-bold text-ink transition hover:bg-sand disabled:opacity-30"
                    disabled={(qty[t.id] ?? 0) === 0}
                    aria-label={`Remove one ${t.name}`}
                  >
                    −
                  </button>
                  <span className="w-4 text-center font-semibold text-ink">{qty[t.id] ?? 0}</span>
                  <button
                    onClick={() => setQty((q) => ({ ...q, [t.id]: (q[t.id] ?? 0) + 1 }))}
                    className="grid h-8 w-8 place-items-center rounded-full font-bold text-paper transition hover:brightness-95"
                    style={{ background: EVENTS }}
                    aria-label={`Add one ${t.name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Order summary */}
          {totalTickets > 0 && (
            <div className="rounded-xl bg-sand/60 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between text-ink-soft">
                <span>
                  {totalTickets} ticket{totalTickets !== 1 ? "s" : ""}
                </span>
                <span>{gbp(faceValuePence)}</span>
              </div>
              {bookingFeePence > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Booking fee</span>
                  <span>{gbp(bookingFeePence)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-1 font-semibold text-ink">
                <span>Total</span>
                <span>{gbp(totalPence)}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          )}

          {canWallet ? (
            <div className="space-y-3">
              <button
                onClick={() => proceed(true)}
                disabled={totalTickets === 0 || busy}
                className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
                style={{ background: EVENTS }}
              >
                {busy ? "Please wait…" : `Pay from wallet · ${gbp(totalPence)}`}
              </button>
              <button
                onClick={() => proceed(false)}
                disabled={totalTickets === 0 || busy}
                className="w-full rounded-pill border border-line-strong py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-40"
              >
                {busy ? "Please wait…" : `Pay by card · ${gbp(totalPence)}`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => proceed(false)}
              disabled={totalTickets === 0 || busy}
              className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
              style={{ background: EVENTS }}
            >
              {busy ? "Please wait…" : isLoggedIn ? (isPaid ? `Continue · ${gbp(totalPence)}` : "Get free tickets") : "Sign in to continue"}
            </button>
          )}
        </div>
      )}

      {step === "pay" && clientSecret && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            {totalTickets} ticket{totalTickets !== 1 ? "s" : ""} for <span className="font-semibold text-ink">{eventTitle}</span>
          </p>
          <PaymentCheckout
            clientSecret={clientSecret}
            amountPence={totalPence}
            accent={EVENTS}
            payLabel={`Pay ${gbp(totalPence)}`}
            onPaid={handlePaid}
            onCancel={() => setStep("select")}
          />
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          )}
        </div>
      )}

      {step === "done" && (
        <div className="space-y-5 py-2 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: `${EVENTS}20` }}>
            🎟️
          </div>
          <div>
            <p className="font-display text-xl font-bold text-ink">Tickets confirmed!</p>
            <p className="mt-2 text-ink-soft">
              {ticketCount} ticket{ticketCount !== 1 ? "s" : ""} for <span className="font-semibold text-ink">{eventTitle}</span>.
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Saved to your account — show the code at the door.
            </p>
          </div>
          <a
            href="/account/tickets"
            className="block w-full rounded-pill py-3 text-center font-semibold text-paper transition hover:brightness-95"
            style={{ background: EVENTS }}
          >
            View my tickets
          </a>
          <button
            onClick={handleClose}
            className="w-full rounded-pill border border-line-strong py-3 font-semibold text-ink-soft transition hover:bg-sand"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

export function TicketButton({
  eventId,
  eventTitle,
  ticketTypes,
  priceText,
  isLoggedIn,
  signInHref,
}: {
  eventId: string;
  eventTitle: string;
  ticketTypes: TicketType[];
  priceText: string | null;
  isLoggedIn: boolean;
  signInHref: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full rounded-pill py-3 text-center font-semibold text-paper transition hover:brightness-95"
        style={{ background: EVENTS }}
      >
        Get tickets{priceText ? ` · ${priceText}` : ""}
      </button>

      <TicketModal
        open={open}
        onClose={() => setOpen(false)}
        eventId={eventId}
        eventTitle={eventTitle}
        ticketTypes={ticketTypes}
        isLoggedIn={isLoggedIn}
        signInHref={signInHref}
      />
    </>
  );
}
