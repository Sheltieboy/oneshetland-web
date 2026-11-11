"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordOfflineParticipation, saveParticipationTerms, waiveParticipation } from "@/app/organise/commerce-actions";
import { METHOD_LABEL, pounds, type ParticipationRow } from "@/lib/editions/commerce";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

type Terms = { mode: "free" | "fee_required"; fee_pence: number | null; vat_mode: string; refund_policy: "none" | "until_date" | "full"; refund_until: string | null; capacity: number | null; applications_close: string | null } | null;
const STATUS: Record<string, { label: string; tone: "green" | "amber" | "gray" | "blue" | "red" }> = {
  paid: { label: "Paid", tone: "green" }, waived: { label: "Fee waived", tone: "blue" }, member_benefit: { label: "Covered by membership", tone: "green" }, awaiting_payment: { label: "Started paying", tone: "amber" },
  not_started: { label: "Not paid yet", tone: "amber" }, not_required: { label: "No fee", tone: "gray" }, refund_pending: { label: "Refund on its way", tone: "amber" }, refunded: { label: "Refunded", tone: "gray" },
};

/** Set what taking part costs, then see and manage who has paid. Only partners who are covered (paid, waived or member benefit) appear on the public Edition. */
export function ParticipationManager({ slug, edSlug, terms, rows, canManage, hasFees, hasOffline }: { slug: string; edSlug: string; terms: Terms; rows: ParticipationRow[]; canManage: boolean; hasFees: boolean; hasOffline: boolean }) {
  const router = useRouter(); const save = useAction(); const act = useAction();
  const [f, setF] = useState({ mode: terms?.mode ?? "free", fee: terms?.fee_pence ? (terms.fee_pence / 100).toFixed(2) : "", vat_mode: terms?.vat_mode ?? "none", refund_policy: terms?.refund_policy ?? "none", refund_until: terms?.refund_until ?? "", capacity: terms?.capacity ? String(terms.capacity) : "", closes: terms?.applications_close ?? "" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [open, setOpen] = useState<{ id: string; kind: "waive" | "offline" } | null>(null); const [note, setNote] = useState(""); const [amount, setAmount] = useState(""); const [method, setMethod] = useState("cheque");
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-ink-soft">Choose whether businesses pay to take part in this Edition. Businesses that join are shown publicly once they are covered. Members of your organisation can get free or discounted participation, set on each membership tier.</p>
      <section className="rounded-card border border-line bg-paper p-5 shadow-soft" aria-labelledby="terms-h"><h2 id="terms-h" className="font-display text-xl font-bold text-ink">What it costs to take part</h2>
        {canManage ? (
          <form className="mt-3 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save.run(() => saveParticipationTerms(slug, edSlug, f), { success: "Saved.", onOk: () => router.refresh() }); }}>
            <fieldset className="space-y-2"><legend className="sr-only">Participation</legend>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="radio" name="mode" checked={f.mode === "free"} onChange={() => set("mode", "free")} /> Free for businesses</label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="radio" name="mode" checked={f.mode === "fee_required"} disabled={!hasFees && f.mode !== "fee_required"} onChange={() => set("mode", "fee_required")} /> Businesses pay a fee{!hasFees && <span className="font-normal text-ink-muted"> (not part of your package yet)</span>}</label></fieldset>
            {f.mode === "fee_required" && (<div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fee (£)" htmlFor="p-fee" hint="At least £1.00. Businesses pay exactly this; nothing is added at checkout. OneShetland's commission and an estimated card processing fee come out of what you receive."><input id="p-fee" className={inputCls} inputMode="decimal" value={f.fee} onChange={(e) => set("fee", e.target.value)} /></Field>
              <Field label="VAT" htmlFor="p-vat"><select id="p-vat" className={inputCls} value={f.vat_mode} onChange={(e) => set("vat_mode", e.target.value)}><option value="none">No VAT</option><option value="inclusive">Fee includes VAT</option><option value="exclusive">VAT added on top</option></select></Field>
              <Field label="Refunds" htmlFor="p-rp"><select id="p-rp" className={inputCls} value={f.refund_policy} onChange={(e) => set("refund_policy", e.target.value)}><option value="none">No refunds when a business withdraws</option><option value="until_date">Refund if they withdraw by a date</option><option value="full">Always refund if they withdraw</option></select></Field>
              {f.refund_policy === "until_date" && <Field label="Last day for a refund" htmlFor="p-ru"><input id="p-ru" type="date" className={inputCls} value={f.refund_until} onChange={(e) => set("refund_until", e.target.value)} /></Field>}
              <Field label="Place limit (optional)" htmlFor="p-cap"><input id="p-cap" className={inputCls} inputMode="numeric" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
              <Field label="Applications close (optional)" htmlFor="p-cl"><input id="p-cl" type="date" className={inputCls} value={f.closes} onChange={(e) => set("closes", e.target.value)} /></Field></div>)}
            <Notice msg={save.msg} /><button type="submit" className={btnPrimary} disabled={save.pending}>{save.pending ? "Saving…" : "Save"}</button></form>
        ) : <p className="mt-2 text-sm text-ink-soft">{terms?.mode === "fee_required" ? `Businesses pay ${pounds(terms.fee_pence)} to take part.` : "Free for businesses."}</p>}
      </section>
      <section aria-labelledby="who-h"><h2 id="who-h" className="font-display text-xl font-bold text-ink">Businesses ({rows.length})</h2>
        {rows.length === 0 ? <div className="mt-3"><EmptyState>No businesses have been invited or have asked to join yet. Use the Partners tab.</EmptyState></div> : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{rows.map((r) => { const s = STATUS[r.status] ?? { label: r.status, tone: "gray" as const }; return (
            <li key={r.link_id} className="px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{r.business_name}</p><p className="text-sm text-ink-soft">{r.link_state === "pending" ? "Invitation not answered yet" : r.shown ? "Shown on your Edition" : r.required ? "Not shown until covered" : "Shown on your Edition"}{r.quoted_charge_pence ? ` · quoted ${pounds(r.quoted_charge_pence)}` : ""}{r.paid_pence ? ` · paid ${pounds(r.paid_pence)}` : ""}{r.waiver_note ? ` · ${r.waiver_note}` : ""}</p></div><Pill label={s.label} tone={s.tone} /></div>
              {canManage && r.required && r.link_state === "approved" && ["not_started", "awaiting_payment", "refunded"].includes(r.status) && (<div className="mt-2 flex gap-3"><button type="button" className={btnQuiet} onClick={() => { setOpen({ id: r.link_id, kind: "waive" }); setNote(""); }}>Waive the fee</button>{hasOffline && <button type="button" className={btnQuiet} onClick={() => { setOpen({ id: r.link_id, kind: "offline" }); setNote(""); setAmount(""); }}>Record a payment received</button>}</div>)}
              {open?.id === r.link_id && (<form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => (open.kind === "waive" ? waiveParticipation(slug, r.link_id, note) : recordOfflineParticipation(slug, r.link_id, { amount, method, note })), { success: "Saved.", onOk: () => { setOpen(null); router.refresh(); } }); }}>
                {open.kind === "offline" && <><Field label="Amount (£)" htmlFor={`oa-${r.link_id}`}><input id={`oa-${r.link_id}`} className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Paid by" htmlFor={`om-${r.link_id}`}><select id={`om-${r.link_id}`} className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></>}
                <Field label={open.kind === "waive" ? "Why is the fee waived?" : "Note (cheque number)"} htmlFor={`on-${r.link_id}`}><input id={`on-${r.link_id}`} className={inputCls} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
                <button type="submit" className={btnPrimary} disabled={act.pending}>Save</button><button type="button" className={btnSecondary} onClick={() => setOpen(null)}>Cancel</button></form>)}</li>); })}</ul>)}
        <Notice msg={act.msg} /></section>
    </div>
  );
}
