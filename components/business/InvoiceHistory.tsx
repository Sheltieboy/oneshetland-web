"use client";

import { useCallback, useEffect, useState } from "react";
import { listSubscriptionInvoices, type SubscriptionInvoice, type SubscriptionCard } from "@/lib/business-client";
import { errorMessage } from "@/lib/errors";

const STATUS: Record<string, { label: string; className: string }> = {
  paid:          { label: "Paid",   className: "bg-emerald-50 text-emerald-700" },
  open:          { label: "Due",    className: "bg-amber-50 text-amber-800" },
  uncollectible: { label: "Unpaid", className: "bg-rose-50 text-rose-700" },
  void:          { label: "Void",   className: "bg-sand text-ink-muted" },
};

/**
 * Subscription invoices, read live from Stripe.
 *
 * Loaded on demand rather than with the page: most visits to the billing screen
 * are to change something, not to read receipts, and it costs a Stripe round
 * trip. The PDF opens Stripe's own hosted URL, so the document always matches
 * the card statement.
 */
export function InvoiceHistory({ businessId }: { businessId: string }) {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[] | null>(null);
  const [card, setCard] = useState<SubscriptionCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { const r = await listSubscriptionInvoices(businessId); setInvoices(r.invoices); setCard(r.card); }
    catch (e) { setError(errorMessage(e, "Could not load your invoices.")); }
    finally { setBusy(false); }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const gbp = (p: number, cur: string) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: (cur || "gbp").toUpperCase() }).format(p / 100);

  return (
    <section className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h2 className="font-display text-xl font-bold text-ink">Invoices</h2>
      <p className="mt-1 text-sm text-ink-muted">Every subscription payment, with a receipt you can hand to your accountant.</p>

      {/* Which card this actually comes off. Businesses often have several saved
          and no way to tell which one is paying — brand and last four is all
          Stripe will give us, and all anyone needs to recognise their own card. */}
      {card && (
        <p className="mt-3 rounded-lg bg-sand/60 px-3 py-2 text-sm text-ink-soft">
          Charged to <span className="font-semibold capitalize text-ink">{card.brand}</span>
          {" "}ending <span className="font-semibold tabular-nums text-ink">{card.last4}</span>
          {card.expMonth && card.expYear
            ? <> · expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</>
            : null}
        </p>
      )}

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {busy && invoices === null && (
        <p className="mt-4 text-sm text-ink-muted">Loading…</p>
      )}

      {invoices !== null && invoices.length === 0 && !error && (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
          No invoices yet. Your first one appears when your plan renews.
        </p>
      )}

      {invoices !== null && invoices.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {invoices.map((inv) => {
            const s = STATUS[inv.status] ?? { label: inv.status, className: "bg-sand text-ink-muted" };
            const when = inv.created
              ? new Date(inv.created).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            return (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{when}</p>
                  {inv.number && <p className="text-xs text-ink-muted">{inv.number}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-ink">{gbp(inv.amountPence, inv.currency)}</span>
                  <span className={"rounded-pill px-2 py-0.5 text-xs font-bold " + s.className}>{s.label}</span>
                  {(inv.pdfUrl || inv.hostedUrl) && (
                    <a
                      href={(inv.pdfUrl || inv.hostedUrl) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
