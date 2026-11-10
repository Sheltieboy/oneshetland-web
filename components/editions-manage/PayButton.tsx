"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { afterPayment, startPayment } from "@/app/editions/pay-actions";
import { PaymentCheckout } from "@/components/payments/PaymentCheckout";
import { useAttemptId } from "@/lib/use-attempt-id";
import { pounds } from "@/lib/editions/commerce";
import { Notice, btnPrimary } from "./kit";

/**
 * One button that starts one payment. The amount shown is what the database said; the button sends only an id and an idempotency token.
 * Press twice = the same attempt. Local testing mode completes instantly and says so, in words, so it can never be mistaken for a real charge.
 */
export function PayButton({ kind, id, label, amountPence }: { kind: "order" | "participation" | "membership"; id: string; label: string; amountPence: number | null }) {
  const router = useRouter();
  const attempt = useAttemptId(`${kind}:${id}:${amountPence}`);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await startPayment(kind, id, attempt());
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      if (r.mode === "simulated") { setMsg({ ok: true, text: `Simulated payment of ${pounds(r.chargePence)} completed. This is local testing: no money moved.` }); router.refresh(); return; }
      setSecret(r.clientSecret);
    } catch { setMsg({ ok: false, text: "Something went wrong. Please try again." }); } finally { setBusy(false); }
  }
  if (secret) {
    return <PaymentCheckout clientSecret={secret} amountPence={amountPence ?? 0} payLabel={label} onCancel={() => setSecret(null)} onPaid={async () => { setSecret(null); await afterPayment(); setMsg({ ok: true, text: "Payment received. It can take a moment to show here." }); router.refresh(); }} />;
  }
  return (<span className="inline-flex flex-col items-start gap-2"><button type="button" className={btnPrimary} disabled={busy} onClick={go}>{busy ? "Working…" : label}</button><Notice msg={msg} /></span>);
}
