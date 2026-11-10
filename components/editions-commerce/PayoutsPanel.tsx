"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptTerms, connectPayouts, saveVatDetails } from "@/app/organise/commerce-actions";
import { blockerText, type PayoutStatus } from "@/lib/editions/commerce";
import { Field, Notice, Panel, Pill, btnPrimary, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const STEPS: { key: string; label: string }[] = [
  { key: "payments_off", label: "Payments switched on by OneShetland" }, { key: "organiser_not_verified", label: "Organiser verified" }, { key: "no_collect_entitlement", label: "Package includes taking payments" },
  { key: "terms_not_accepted", label: "Payment terms accepted" }, { key: "no_payout_account", label: "Payout account connected" }, { key: "payout_account_incomplete", label: "Payout account ready" }, { key: "collection_suspended", label: "Collection not paused" },
];

/** "Getting paid": every prerequisite for taking money, in order, each with what to do next. The database decides the blocker; this only explains it. */
export function PayoutsPanel({ slug, blocker, payout, termsAccepted, termsVersion, isOwner, simulated }: { slug: string; blocker: string | null; payout: PayoutStatus | null; termsAccepted: boolean; termsVersion: string; isOwner: boolean; simulated: boolean }) {
  const router = useRouter();
  const connect = useAction(), terms = useAction(), vat = useAction();
  const [registered, setRegistered] = useState(payout?.vat_registered ?? false);
  const [vatNo, setVatNo] = useState(payout?.vat_number ?? "");
  const [legal, setLegal] = useState(payout?.legal_name ?? "");
  const order = STEPS.map((s) => s.key); const at = blocker ? order.indexOf(blocker) : order.length;
  const info = blockerText(blocker);
  return (
    <div className="space-y-6">
      <Panel tone={blocker ? "warm" : "plain"} title={blocker ? info!.title : "You can take payments"} sub={blocker ? info!.fix : "Businesses can now pay you for memberships and Edition participation. Money goes straight to your Stripe account."}>
        <ol className="space-y-1.5 text-sm">
          {STEPS.map((s, i) => (<li key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className={i < at ? "text-emerald-700" : "text-ink-muted"}>{i < at ? "✓" : "○"}</span><span className={i < at ? "text-ink" : "text-ink-soft"}>{s.label}</span></li>))}
        </ol>
      </Panel>
      <Panel title="Payout account" sub="Your revenue is paid to a Stripe account in your organisation's name. OneShetland never holds it.">
        <p className="text-sm text-ink-soft">{payout?.charges_enabled && payout?.payouts_enabled ? "Connected and ready." : payout?.details_submitted ? "Stripe is still checking your details." : "Not connected yet."}
          {payout?.requirements_due?.length ? ` Stripe still needs: ${payout.requirements_due.map((r) => r.replace(/_/g, " ")).join(", ")}.` : ""}</p>
        {isOwner && !(payout?.charges_enabled && payout?.payouts_enabled) && (
          <div className="mt-3"><button type="button" className={btnPrimary} disabled={connect.pending} onClick={() => connect.run(() => connectPayouts(slug, window.location.href), { onOk: (r) => { const u = (r as unknown as { url: string | null }).url; if (u) window.location.assign(u); else router.refresh(); }, success: simulated ? "Connected (local test account)." : undefined })}>{connect.pending ? "Working…" : payout?.details_submitted ? "Continue setup" : "Connect with Stripe"}</button>{simulated && <p className="mt-2 text-xs text-ink-muted">Local testing mode: this creates a pretend connected account.</p>}</div>
        )}
        <Notice msg={connect.msg} />
        {payout?.collection_suspended && <p className="mt-3 text-sm font-semibold text-rose-700">Collection is paused by OneShetland: {payout.suspended_reason}</p>}
      </Panel>
      <Panel title="VAT and legal details" sub="Printed on receipts. If you are VAT registered, prices can show VAT. Confirm your VAT treatment with your accountant.">
        {isOwner ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); vat.run(() => saveVatDetails(slug, { registered, vat_number: vatNo, legal_name: legal }), { success: "Saved.", onOk: () => router.refresh() }); }}>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={registered} onChange={(e) => setRegistered(e.target.checked)} /> We are VAT registered</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="VAT number" htmlFor="vatno" hint="For example GB123456789"><input id="vatno" className={inputCls} value={vatNo} onChange={(e) => setVatNo(e.target.value)} maxLength={14} /></Field>
              <Field label="Legal name" htmlFor="legal" hint="As it should appear on receipts"><input id="legal" className={inputCls} value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={160} /></Field>
            </div>
            <button type="submit" className={btnSecondary} disabled={vat.pending}>Save details</button><Notice msg={vat.msg} />
          </form>
        ) : <p className="text-sm text-ink-soft">{payout?.vat_registered ? `VAT registered (${payout.vat_number}).` : "Not VAT registered."} Only an owner can change this.</p>}
      </Panel>
      <Panel title="Payment terms" sub={`Current version: ${termsVersion}`}>
        <p className="max-w-[60ch] text-sm text-ink-soft">By accepting you agree to the organiser payment terms: you are the seller of what businesses buy from you, you set and honour your refund policy, OneShetland's fee is taken from each payment as set by OneShetland, and chargebacks can be recovered from future payouts. (Draft terms: the final wording is confirmed before payments go live.)</p>
        {termsAccepted ? <p className="mt-3"><Pill label="Accepted" tone="green" /></p> : isOwner ? <div className="mt-3"><button type="button" className={btnPrimary} disabled={terms.pending} onClick={() => terms.run(() => acceptTerms(slug, termsVersion), { onOk: () => router.refresh() })}>Accept the payment terms</button></div> : <p className="mt-3 text-sm text-ink-soft">An owner needs to accept the terms.</p>}
        <Notice msg={terms.msg} />
      </Panel>
    </div>
  );
}
