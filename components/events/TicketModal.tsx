"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { startTicketPurchase, confirmTicketPurchase, type LineItem } from "@/lib/events-client";
import { newCheckoutAttemptId } from "@/lib/checkout-attempt";
import { fetchWalletBalance } from "@/lib/local-commerce-client";
import { describeCheckoutError } from "@/lib/checkout-errors";
import { fetchSavedCardState, type SavedCardState } from "@/lib/saved-card-client";
import { formatCardLabel } from "@/lib/card-label";
import { maxPerOrder, ticketTypePurchasable } from "@/lib/events-data";

const EVENTS = "#d4921a";
// Buyer-facing booking fee — 95p per ticket plus 1.5% of face value.
// Must match the app (app/event-ticket-checkout.tsx) and the create-event-ticket-intent
// edge function, which is authoritative for the actual charge.
const BOOKING_FEE_PENCE = 95;   // per ticket
const BOOKING_FEE_BPS = 150;    // 1.5% of face value, in basis points

function gbp(pence: number) {
  return pence <= 0 ? "Free" : `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

type TicketType = {
  id: string;
  name: string;
  price_pence: number;
  description: string | null;
  quantity_available: number | null;
  quantity_sold: number;
  per_order_max: number;
};

type Step = "select" | "pay" | "done";
type Method = "saved" | "new";

export function TicketModal({
  open,
  onClose,
  eventId,
  eventTitle,
  ticketTypes,
  isLoggedIn,
  signInHref,
  payoutReady,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  ticketTypes: TicketType[];
  isLoggedIn: boolean;
  signInHref: string;
  /**
   * From event_payout_ready — the whole-event signal. A wholly free event is
   * always ready by that function's own all_free clause, so this only ever
   * matters here for a MIXED event: it gates each individual paid ticket
   * type (see ticketTypePurchasable below), while a free type is always
   * selectable regardless.
   */
  payoutReady: boolean;
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
  // What the buyer's saved card REALLY is, asked of the server (which asks
  // Stripe) — never inferred from a profile flag. null = not answered yet.
  const [cardState, setCardState] = useState<SavedCardState | null>(null);
  // The card is preselected when there is one, but choosing it charges nothing:
  // only the final Pay button does.
  const [method, setMethod] = useState<Method>("new");

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchWalletBalance().then((p) => { if (live) setWalletPence(p); }).catch(() => {});
    return () => { live = false; };
  }, [open, isLoggedIn]);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    let live = true;
    fetchSavedCardState().then((s) => {
      if (!live) return;
      setCardState(s);
      setMethod(s.state === "card" ? "saved" : "new");
    });
    return () => { live = false; };
  }, [open, isLoggedIn]);

  /** Ask again — used when the server says the card the buyer chose is gone. */
  async function refreshSavedCard() {
    const s = await fetchSavedCardState();
    setCardState(s);
    return s;
  }

  function reset() {
    setStep("select");
    setQty({});
    setBusy(false);
    setError(null);
    setClientSecret(null);
    setOrderId(null);
    setCardState(null);
    setMethod("new");
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Defensive, not just cosmetic: a paid type the UI never lets the buyer
  // increment (see the +/- buttons below) is filtered out here too, so
  // nothing built from stale quantity state could ever line-item a ticket
  // type this event isn't payout-ready to sell.
  const lineItems: LineItem[] = ticketTypes
    .filter((t) => (qty[t.id] ?? 0) > 0 && ticketTypePurchasable(t, payoutReady))
    .map((t) => ({ ticket_type_id: t.id, quantity: qty[t.id] }));

  const totalTickets = lineItems.reduce((s, li) => s + li.quantity, 0);
  const faceValuePence = ticketTypes.reduce(
    (s, t) => s + (qty[t.id] ?? 0) * t.price_pence,
    0,
  );
  const isPaid = faceValuePence > 0;
  const bookingFeePence = isPaid
    ? BOOKING_FEE_PENCE * totalTickets + Math.floor((faceValuePence * BOOKING_FEE_BPS) / 10_000)
    : 0;
  const totalPence = faceValuePence + bookingFeePence;
  const canWallet = walletPence != null && isPaid && walletPence >= totalPence;

  const savedCard = cardState?.state === "card" ? cardState.card : null;
  // The saved card is charged only when it exists AND the buyer has it selected.
  const usingSaved = isPaid && savedCard != null && method === "saved";
  // Until the server has answered, a paid checkout cannot say what it will charge.
  const cardLoading = isLoggedIn && isPaid && cardState === null;

  // ── Checkout attempt id ──────────────────────────────────────────────────
  // Minted once for the purchase the buyer is making, and reused if they click
  // through again after a failure — that is what stops a retry creating a
  // second order and holding the seats twice. Held in a ref rather than state
  // so re-rendering cannot mint a new one mid-checkout. Cleared when the basket
  // changes (a different basket is a different purchase, and reusing the id
  // would be rejected as a conflict) and once the purchase is done.
  const attemptRef = useRef<string | null>(null);
  const attemptId = () => (attemptRef.current ??= newCheckoutAttemptId());
  useEffect(() => { attemptRef.current = null; }, [qty]);

  async function proceed(viaWallet = false) {
    if (lineItems.length === 0) return;
    if (!isLoggedIn) { window.location.href = signInHref; return; }
    setBusy(true);
    setError(null);
    try {
      const result = await startTicketPurchase(eventId, lineItems, {
        ...(viaWallet ? { payWithWallet: true } : {}),
        // Explicit, every time: true only for a buyer who chose their saved card.
        useSavedCard: !viaWallet && usingSaved,
        clientRequestId: attemptId(),
      });
      if ("free" in result || "charged" in result) {
        setTicketCount(totalTickets);
        // Done — the next purchase is a genuinely new checkout and must mint a
        // fresh id, or it would be refused as a replay of this one.
        attemptRef.current = null;
        setStep("done");
      } else {
        setClientSecret(result.clientSecret);
        setOrderId(result.order_id);
        setStep("pay");
      }
    } catch (e) {
      if ((e as { code?: string }).code === "saved_card_unavailable") {
        // The card the buyer was shown is gone (or could not be checked). Say so,
        // re-read the truth, and offer another way to pay — never switch quietly.
        await refreshSavedCard();
        setMethod("new");
        setError((e as Error).message || "Your saved card isn\u2019t available. Please choose another way to pay.");
      } else {
        setError(describeCheckoutError(e));
      }
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
      setError(describeCheckoutError(e));
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
            {ticketTypes.map((t) => {
              // The lower of the seller's per-order limit and what is left.
              // The server enforces both; this only saves the buyer from
              // choosing a number it will refuse.
              const cap = maxPerOrder(t);
              // This is the per-ticket-type half of the mixed-event rule: a
              // free type never needs a payout route, a paid one does. Only
              // ever false here within a mixed event — a wholly-paid,
              // not-ready event never reaches this modal at all (see
              // app/whats-on/[id]/page.tsx).
              const purchasable = ticketTypePurchasable(t, payoutReady);
              return (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4 shadow-soft">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{t.name}</p>
                  {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
                  <p className="mt-0.5 font-display font-bold" style={{ color: EVENTS }}>
                    {gbp(t.price_pence)}
                  </p>
                  {!purchasable ? (
                    <p className="mt-0.5 text-xs font-medium text-ink-muted">Paid tickets coming soon</p>
                  ) : cap > 0 ? (
                    <p className="mt-0.5 text-xs text-ink-muted">Max {cap} per order</p>
                  ) : null}
                </div>
                {purchasable ? (
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
                      onClick={() => setQty((q) => ({ ...q, [t.id]: Math.min(cap, (q[t.id] ?? 0) + 1) }))}
                      disabled={(qty[t.id] ?? 0) >= cap}
                      className="grid h-8 w-8 place-items-center rounded-full font-bold text-paper transition hover:brightness-95 disabled:opacity-30 disabled:hover:brightness-100"
                      style={{ background: EVENTS }}
                      aria-label={`Add one ${t.name}`}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-pill bg-sand px-3 py-1.5 text-xs font-semibold text-ink-muted">
                    Unavailable
                  </span>
                )}
              </li>
              );
            })}
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

          {/* How to pay. Choosing charges nothing; the button below does. */}
          {isLoggedIn && isPaid && totalTickets > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Pay with</p>
              <div className="space-y-2">
                {savedCard && (
                  <MethodRow
                    selected={method === "saved"}
                    onSelect={() => setMethod("saved")}
                    accent={EVENTS}
                    title={formatCardLabel(savedCard.brand, savedCard.last4)}
                    sub="Your saved card"
                  />
                )}
                <MethodRow
                  selected={method === "new"}
                  onSelect={() => setMethod("new")}
                  accent={EVENTS}
                  title={savedCard ? "Use a different card" : "Pay by card"}
                  sub="Enter card details at the next step"
                />
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
                disabled={totalTickets === 0 || busy || cardLoading}
                className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
                style={{ background: EVENTS }}
              >
                {busy ? "Please wait…" : `Pay from wallet · ${gbp(totalPence)}`}
              </button>
              <button
                onClick={() => proceed(false)}
                disabled={totalTickets === 0 || busy || cardLoading}
                className="w-full rounded-pill border border-line-strong py-3 font-semibold text-ink transition hover:bg-sand disabled:opacity-40"
              >
                {busy ? "Please wait…" : usingSaved ? `Pay by saved card · ${gbp(totalPence)}` : `Pay by card · ${gbp(totalPence)}`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => proceed(false)}
              disabled={totalTickets === 0 || busy || cardLoading}
              className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
              style={{ background: EVENTS }}
            >
              {busy ? "Please wait…" : isLoggedIn ? (isPaid ? (usingSaved ? `Pay ${gbp(totalPence)}` : `Continue · ${gbp(totalPence)}`) : "Get free tickets") : "Sign in to continue"}
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
  payoutReady,
}: {
  eventId: string;
  eventTitle: string;
  ticketTypes: TicketType[];
  priceText: string | null;
  isLoggedIn: boolean;
  signInHref: string;
  payoutReady: boolean;
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
        payoutReady={payoutReady}
      />
    </>
  );
}

function MethodRow({
  selected, onSelect, accent, title, sub,
}: {
  selected: boolean; onSelect: () => void; accent: string;
  title: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition " +
        (selected ? "border-current" : "border-line hover:border-line-strong")
      }
      style={selected ? { color: accent, background: `${accent}0d` } : undefined}
    >
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2"
        style={{ borderColor: selected ? accent : "#cbd5e1" }}
      >
        {selected && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}
