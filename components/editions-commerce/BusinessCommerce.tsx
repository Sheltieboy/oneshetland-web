"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelMembership, claimMemberBenefit, respondToMembershipInvite, withdrawFromEdition, withdrawMembershipApplication } from "@/app/account/editions/commerce-actions";
import { INTERVAL_LABEL, MEMBER_STATUS, PAY_STATUS_LABEL, SOURCE_LABEL, VAT_LABEL, benefitText, blockerText, pounds, type MyMembership, type MyParticipation, type MyPayment } from "@/lib/editions/commerce";
import { dateRangeLabel } from "@/lib/editions/rules";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { PayButton } from "@/components/editions-manage/PayButton";
import { EmptyState, Notice, Pill, btnPrimary, btnQuiet, btnSecondary } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const TONE = { good: "green", wait: "amber", ask: "blue", bad: "red", off: "gray" } as const;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : "");

/** A business owner's money screens: memberships (accept, pay, cancel), Edition participation (pay, claim, withdraw) and a payment history. Plain words; business control first. */
export function BusinessCommerce({ memberships, participations, payments }: { memberships: MyMembership[]; participations: MyParticipation[]; payments: MyPayment[] }) {
  const router = useRouter(); const confirm = useConfirm(); const act = useAction();
  const current = memberships.filter((m) => !["declined", "withdrawn", "cancelled", "expired"].includes(m.status));
  const past = memberships.filter((m) => ["declined", "withdrawn", "cancelled", "expired"].includes(m.status));
  const needsAttention = participations.filter((p) => p.required && ["not_started", "awaiting_payment", "refunded"].includes(p.status));
  const done = (fn: () => Promise<{ ok: boolean; error?: string }>) => act.run(fn as never, { onOk: () => router.refresh() });
  async function cancel(m: MyMembership) { if (await confirm({ title: `Cancel your ${m.tier_name} membership?`, body: m.current_period_end ? `You keep your benefits until ${day(m.current_period_end)}, then it ends. You will not be charged again.` : "It ends straight away.", confirmLabel: "Cancel membership", danger: true })) done(() => cancelMembership(m.membership_id)); }
  async function leave(p: MyParticipation) {
    const refund = p.status === "paid" ? (p.refund_policy === "full" ? "You are entitled to a refund." : p.refund_policy === "until_date" && p.refund_until ? `A refund is available if you withdraw by ${day(p.refund_until)}.` : "No refund is due under this organiser's policy.") : "";
    if (await confirm({ title: `Step back from ${p.edition_title}?`, body: `You disappear from the Edition straight away. ${refund}`.trim(), confirmLabel: "Step back", danger: true })) done(() => withdrawFromEdition(p.link_id));
  }
  return (
    <div className="space-y-10">
      <Notice msg={act.msg} />
      <section aria-labelledby="mm-h"><h2 id="mm-h" className="font-display text-2xl font-bold text-ink">Memberships</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">Join an organisation such as a festival body for its benefits. A membership never changes your listing, plan or offers.</p>
        {current.length === 0 ? <div className="mt-3"><EmptyState>You have no memberships. When an organiser invites you, or you apply from their page, it shows here.</EmptyState></div> : (
          <ul className="mt-4 space-y-4">{current.map((m) => { const st = MEMBER_STATUS[m.status]; const price = m.price_pence != null ? `${pounds(m.price_pence)} ${INTERVAL_LABEL[m.billing_interval ?? ""] ?? ""}` : "Free"; const blk = blockerText(m.pay_blocker); return (
            <li key={m.membership_id} className={"rounded-card border p-5 shadow-soft " + (m.status === "invited" ? "border-sky-200 bg-sky-50/50" : "border-line bg-paper")}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow text-ink-muted">{m.business_name}</p><h3 className="font-display text-xl font-bold text-ink">{m.tier_name} <span className="text-base font-normal text-ink-soft">· {m.organiser_name}</span></h3><p className="text-sm text-ink-soft">{price}{m.vat_mode !== "none" ? ` · ${VAT_LABEL[m.vat_mode]}` : ""}{m.current_period_end ? ` · ${m.status === "cancel_at_period_end" ? "ends" : "renews"} ${day(m.current_period_end)}` : ""}</p></div><Pill label={st.label} tone={TONE[st.tone]} /></div>
              {m.benefits.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-ink-soft">{m.benefits.map((b) => <li key={b}>{b}</li>)}</ul>}
              {benefitText({ edition_benefit: m.edition_benefit, discount_percent: m.discount_percent }) && <p className="mt-2 text-sm font-semibold text-ink">{benefitText({ edition_benefit: m.edition_benefit, discount_percent: m.discount_percent })}</p>}
              {m.message && m.status === "invited" && <blockquote className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink">&ldquo;{m.message}&rdquo;</blockquote>}
              {m.decision_note && <p className="mt-2 text-sm text-ink-soft">From the organiser: {m.decision_note}</p>}
              {m.status === "past_due" && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">Your last payment did not go through. Update your payment to keep your benefits.</p>}
              {m.status === "invited" && m.source === "offline_record" && <div role="note" className="mt-3 rounded-xl border border-sky-200 bg-paper px-4 py-3 text-sm text-ink"><p className="font-semibold">{m.organiser_name} has recorded this membership for you.</p><p className="mt-1 text-ink-soft">{m.billing_interval === "offline" && (m.price_pence ?? 0) > 0 ? `They report ${pounds(m.price_pence)} received outside OneShetland` : "It is recorded as complimentary, with nothing to pay"}{m.current_period_end ? `, covering you until ${new Date(m.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. It only counts once you accept. If you decline, nothing is recorded against your business.</p></div>}
              {m.status === "invited" && m.source !== "offline_record" && <ul className="mt-3 space-y-1 text-sm text-ink-soft"><li><span aria-hidden="true">✓ </span>You decide whether to join. Nothing is charged until you pay.</li><li><span aria-hidden="true">✓ </span>You can cancel at any time and keep benefits to the end of what you paid for.</li><li><span aria-hidden="true">✓ </span>Joining never changes your listing, plan or offers.</li></ul>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {m.status === "invited" && <><button type="button" className={btnPrimary} disabled={act.pending} onClick={() => done(() => respondToMembershipInvite(m.membership_id, true))}>{m.source === "offline_record" ? "Accept membership" : "Yes, join"}</button><button type="button" className={btnSecondary} disabled={act.pending} onClick={() => done(() => respondToMembershipInvite(m.membership_id, false))}>{m.source === "offline_record" ? "Decline" : "No thanks"}</button></>}
                {(m.status === "pending_payment" || m.status === "past_due") && (m.can_pay ? <PayButton kind="membership" id={m.membership_id} label={m.status === "past_due" ? `Pay ${pounds(m.price_pence)} now` : `Pay ${pounds(m.price_pence)} and join`} amountPence={m.price_pence} /> : blk ? <p className="text-sm text-ink-soft"><strong className="font-semibold text-ink">{blk.title}.</strong> {blk.fix}</p> : null)}
                {["applied", "invited", "pending_payment"].includes(m.status) && m.status !== "invited" && <button type="button" className={btnQuiet} disabled={act.pending} onClick={() => done(() => withdrawMembershipApplication(m.membership_id))}>Withdraw</button>}
                {(m.status === "active" || m.status === "past_due") && <button type="button" className={btnQuiet} disabled={act.pending} onClick={() => cancel(m)}>Cancel membership</button>}
                {m.organiser_slug && <Link href={`/organisers/${m.organiser_slug}`} className={btnQuiet}>About {m.organiser_name}</Link>}
              </div></li>); })}</ul>)}
        {past.length > 0 && <details className="mt-4 rounded-card border border-line bg-paper px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-ink">Earlier ({past.length})</summary><ul className="mt-3 space-y-1 text-sm">{past.map((m) => <li key={m.membership_id} className="flex justify-between gap-2"><span>{m.tier_name} · {m.organiser_name}</span><Pill label={MEMBER_STATUS[m.status].label} tone="gray" /></li>)}</ul></details>}
      </section>

      <section aria-labelledby="pp-h"><h2 id="pp-h" className="font-display text-2xl font-bold text-ink">Taking part in Editions</h2>
        {needsAttention.length > 0 && <p role="note" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{needsAttention.length === 1 ? "One Edition is waiting for you to complete your place." : `${needsAttention.length} Editions are waiting for you to complete your place.`} You are only shown publicly once it is done.</p>}
        {participations.length === 0 ? <div className="mt-3"><EmptyState>When you accept an invitation to an Edition, its details and any fee show here.</EmptyState></div> : (
          <ul className="mt-4 space-y-4">{participations.map((p) => { const blk = blockerText(p.pay_blocker); return (
            <li key={p.link_id} className="rounded-card border border-line bg-paper p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="eyebrow text-ink-muted">{p.business_name}</p><h3 className="font-display text-xl font-bold text-ink">{p.edition_title}</h3><p className="text-sm text-ink-soft">from {p.organiser_name}</p></div>
              <Pill label={p.shown ? "Shown on the Edition" : p.required ? "Not shown yet" : "Shown on the Edition"} tone={p.shown ? "green" : "amber"} /></div>
              {p.required ? (<div className="mt-3 text-sm text-ink-soft">
                {p.status === "paid" ? <p>You have paid. {p.refund_policy === "full" ? "You can withdraw for a full refund." : p.refund_policy === "until_date" && p.refund_until ? `Refund available if you withdraw by ${day(p.refund_until)}.` : "This organiser does not refund on withdrawal."}</p>
                  : p.status === "waived" ? <p>The organiser has waived your fee.</p> : p.status === "member_benefit" ? <p>Your membership covers this Edition at no charge.</p>
                  : (<div><p>Fee to take part: <strong className="text-ink">{pounds(p.base_pence)}</strong>{p.discount_pence ? <> · member discount {pounds(p.discount_pence)} ({p.tier_name}) · <strong className="text-ink">you pay {pounds(p.charge_pence)}</strong></> : null}{p.vat_pence ? ` (includes ${pounds(p.vat_pence)} VAT)` : ""}</p>
                    <p className="mt-1">{p.refund_policy === "full" ? "Refunded in full if you withdraw." : p.refund_policy === "until_date" && p.refund_until ? `Refunded if you withdraw by ${day(p.refund_until)}.` : "No refund if you withdraw."} Your listing and offers stay yours and are never changed.</p></div>)}
              </div>) : <p className="mt-3 text-sm text-ink-soft">There is no fee for this Edition.</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {p.required && ["not_started", "awaiting_payment", "refunded"].includes(p.status) && p.price_pence === 0 && <button type="button" className={btnPrimary} disabled={act.pending} onClick={() => done(() => claimMemberBenefit(p.link_id))}>Use my membership benefit</button>}
                {p.required && ["not_started", "awaiting_payment", "refunded"].includes(p.status) && (p.price_pence ?? 0) > 0 && (p.can_pay ? <PayButton kind="participation" id={p.link_id} label={`Pay ${pounds(p.charge_pence)}`} amountPence={p.charge_pence} /> : blk ? <p className="text-sm text-ink-soft"><strong className="font-semibold text-ink">{blk.title}.</strong> {blk.fix}</p> : null)}
                <Link href={`/editions/${p.edition_slug}`} className={btnQuiet}>View Edition</Link>
                <button type="button" className={btnQuiet} disabled={act.pending} onClick={() => leave(p)}>Step back</button></div></li>); })}</ul>)}
      </section>

      <section aria-labelledby="ph-h"><h2 id="ph-h" className="font-display text-2xl font-bold text-ink">Payments and receipts</h2>
        {payments.length === 0 ? <div className="mt-3"><EmptyState>No payments yet.</EmptyState></div> : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{payments.map((p) => (
            <li key={p.payment_id} className="px-4 py-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{p.label ?? (p.kind === "membership" ? "Membership" : "Edition")} <span className="font-normal text-ink-muted">· {p.organiser_name}</span></p>
              <p className="text-ink-soft">{day(p.created_at)} · {SOURCE_LABEL[p.source] ?? p.source}{p.vat_pence ? ` · VAT ${pounds(p.vat_pence)}` : ""}{p.vat_number ? ` · supplier VAT no. ${p.vat_number}` : ""}{p.legal_name ? ` · ${p.legal_name}` : ""}</p></div><div className="text-right"><p className="font-bold tabular-nums text-ink">{pounds(p.charge_pence)}</p><p className="text-xs text-ink-muted">{PAY_STATUS_LABEL[p.status]}{p.refunded_pence ? ` · refunded ${pounds(p.refunded_pence)}` : ""}</p></div></div></li>))}</ul>)}
      </section>
    </div>
  );
}

void dateRangeLabel;
