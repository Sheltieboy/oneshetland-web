"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { grantOrgEntitlement, resolveException, setCollectionSuspended, setCommerceConfig, setFeeOverride, upsertPackage, voidOrgEntitlement } from "@/app/admin/editions/commerce/actions";
import { COMMERCE_KEYS, previewFee, type FeeConfig } from "@/app/admin/editions/commerce/config";
import { ALL_FEATURES, KIND_WORD, NO_RESTRICTIONS_NOTE, canEditRow, describeGrants, describeIncludes, isRetired, kindOf, retiredCount, visibleCatalogue, type CatalogueRow } from "@/app/admin/editions/commerce/catalogue";
import { FEATURE_LABEL, pounds, toPence } from "@/lib/editions/commerce";
import { Field, Notice, Panel, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

type Pkg = CatalogueRow;
type Org = { id: string; name: string; status: string; collection_suspended?: boolean };
type Ent = { id: string; organiser_id: string; feature: string; max_value: number | null; ends_at: string; source: string; reason: string | null };
type Exc = { id: string; kind: string; provider_ref: string; detail: Record<string, unknown>; created_at: string; organiser_id: string | null };
type FeeRow = { organiser_name: string; payments: number; gross_pence: number; platform_fee_pence: number; refunded_pence: number; commission_earned_pence?: number; processing_fee_estimate_pence?: number };

/** The administrator's commercial control room: the model, the packages, who may take payments, fee exceptions, and what needs attention. Every change is audited by the database. */
export function EditionsCommerceAdmin({ config, packages, organisers, entitlements, exceptions, fees }: { config: Record<string, string>; packages: Pkg[]; organisers: Org[]; entitlements: Ent[]; exceptions: Exc[]; fees: FeeRow[] }) {
  const router = useRouter();
  const val = (k: string, def: string) => config[k] ?? def;
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(COMMERCE_KEYS.map((c) => [c.key, val(c.key, c.def)])));
  const cfg = useAction();
  const dirty = COMMERCE_KEYS.filter((c) => draft[c.key] !== val(c.key, c.def));
  const saveAll = () => cfg.run(async () => { for (const c of dirty) { const r = await setCommerceConfig(c.key, draft[c.key]); if (!r.ok) return { ok: false as const, error: `${c.label}: ${r.error}` }; } return { ok: true as const }; }, { success: "Saved.", onOk: () => router.refresh() });

  const field = (c: (typeof COMMERCE_KEYS)[number]) => {
    const set = (v: string) => setDraft({ ...draft, [c.key]: v });
    const hint = c.kind === "int" ? ` (${c.min} to ${c.max})` : "";
    const confirmWarn = c.key === "editions.commerce.stripe_cost_confirmed" && draft[c.key] !== "true";
    return (
      <div key={c.key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start sm:gap-4"><div><label htmlFor={c.key} className="text-sm font-semibold text-ink">{c.label}</label><p className="text-xs text-ink-muted">{c.help}</p>{confirmWarn && <p role="note" className="mt-1 rounded-card border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Not confirmed: the estimate rates are placeholders. Do not switch payments on yet.</p>}</div>
        {c.kind === "bool" ? <select id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => set(e.target.value)}><option value="true">On</option><option value="false">Off</option></select>
          : c.kind === "onoff" ? <select id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => set(e.target.value)}><option value="off">Off</option><option value="on">On</option></select>
          : c.kind === "info" ? <p id={c.key} className="rounded-card border border-line bg-sand/50 px-3 py-2 text-sm font-semibold text-ink">{draft[c.key] === "true" ? "Yes" : "No"} <span className="font-normal text-ink-muted">(read only)</span></p>
          : c.kind === "choice" ? <select id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => set(e.target.value)}>{c.choices!.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          : c.kind === "int" ? <input id={c.key} className={inputCls} inputMode="numeric" aria-label={`${c.label}${hint}`} value={draft[c.key]} onChange={(e) => set(e.target.value)} />
          : c.kind === "note" ? <input id={c.key} className={inputCls} maxLength={300} value={draft[c.key]} onChange={(e) => set(e.target.value)} />
          : <input id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => set(e.target.value)} />}</div>
    );
  };
  const saveRow = (<><div className="mt-4 flex items-center gap-3"><button type="button" className={btnPrimary} disabled={cfg.pending || dirty.length === 0} onClick={saveAll}>{cfg.pending ? "Saving…" : dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "No changes"}</button></div><Notice msg={cfg.msg} /></>);

  // fee calculator
  const [calcKind, setCalcKind] = useState<"participation" | "membership">("participation"); const [calcPrice, setCalcPrice] = useState("100"); const [calcVat, setCalcVat] = useState<"none" | "inclusive" | "exclusive">("none"); const [calcReg, setCalcReg] = useState(false); const [stripeFee, setStripeFee] = useState(""); const [recWaived, setRecWaived] = useState(false);
  const num = (k: string) => Number(draft[`editions.commerce.${calcKind}.${k}`] || 0);
  const fc: FeeConfig = { percent: num("fee_percent"), fixed: num("fee_fixed_pence"), min: num("fee_min_pence"), cap: draft[`editions.commerce.${calcKind}.fee_cap_pence`] === "" ? null : num("fee_cap_pence"), stripePercent: num("stripe_cost_percent"), stripeFixed: num("stripe_cost_fixed_pence"), vatRate: Number(draft["editions.commerce.vat_rate_percent"] || 20) };
  const price = toPence(calcPrice); const sf = stripeFee.trim() ? toPence(stripeFee) : undefined;
  const calc = price !== null ? previewFee(price, fc, calcVat, calcReg, sf ?? undefined, recWaived) : null;

  // packages and promotions: the rate card. Rows are edited in place (name, price, on sale); retired rows are hidden by default and can never be switched back on.
  const [showRetired, setShowRetired] = useState(false);
  const [pk, setPk] = useState<{ code: string; name: string; description: string; price: string; sort: string; active: boolean } | null>(null); const pkA = useAction();
  const edit = (p: Pkg) => setPk({ code: p.code, name: p.name, description: p.description ?? "", price: (p.price_pence / 100).toFixed(2), sort: String(p.sort), active: p.active });
  const shown = visibleCatalogue(packages, showRetired); const nRetired = retiredCount(packages);
  const editing = pk ? packages.find((p) => p.code === pk.code) : undefined;
  // entitlements, overrides, suspension
  const [g, setG] = useState({ organiserId: organisers[0]?.id ?? "", feature: "collect_payments", max: "", days: "90", reason: "" }); const gA = useAction();
  const [o, setO] = useState({ organiserId: organisers[0]?.id ?? "", kind: "participation", percent: "", fixed: "", waived: false, recoveryWaived: false, reason: "", days: "" }); const oA = useAction();
  const [s, setS] = useState({ organiserId: organisers[0]?.id ?? "", reason: "" }); const sA = useAction(); const rA = useAction();
  const orgName = (id: string | null) => organisers.find((x) => x.id === id)?.name ?? "";
  return (
    <div className="space-y-10">
      <Panel title="Commercial model" sub="Every change is recorded in the audit log. Payments stay off until you switch the master setting on, and nothing is real until Stripe functions are deployed.">
        <div className="space-y-4">{COMMERCE_KEYS.filter((c) => !c.group).map(field)}</div>
        {saveRow}
      </Panel>

      <Panel title="Card processing estimate and monitoring" sub="Customers always pay exactly the price. OneShetland's commission and an ESTIMATED card processing fee are taken from the organiser's payment, and the estimate is reconciled to Stripe's actual fee afterwards. Stripe Connect account and payout overheads are absorbed by OneShetland and are not recovered per payment. OneShetland charges no VAT while it is not VAT registered.">
        <div className="space-y-4">{COMMERCE_KEYS.filter((c) => c.group === "fees").map(field)}</div>
        {saveRow}
      </Panel>

      <Panel title="Promotion and app settings" sub="How many places there are, how far ahead they can be booked, and the app-to-website sign-in switches. Each box says what it accepts; the database checks the same limits.">
        <div className="space-y-4">{COMMERCE_KEYS.filter((c) => c.group === "promo" || c.group === "app").map(field)}</div>
        {saveRow}
      </Panel>

      <Panel title="Fee calculator" sub="Try a price against the settings above (unsaved edits included). The customer always pays the price shown; the commission and the ESTIMATED processing fee come out of the organiser's side. Add an assumed actual Stripe fee to see the variance.">
        <div className="grid gap-3 sm:grid-cols-5"><Field label="Type" htmlFor="c-k"><select id="c-k" className={inputCls} value={calcKind} onChange={(e) => setCalcKind(e.target.value as never)}><option value="participation">Participation</option><option value="membership">Membership</option></select></Field>
          <Field label="Price (£)" htmlFor="c-p"><input id="c-p" className={inputCls} value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)} /></Field>
          <Field label="VAT mode" htmlFor="c-v"><select id="c-v" className={inputCls} value={calcVat} onChange={(e) => setCalcVat(e.target.value as never)}><option value="none">None</option><option value="inclusive">Inclusive</option><option value="exclusive">Exclusive</option></select></Field>
          <Field label="Assumed actual Stripe fee (£)" htmlFor="c-s" hint="Optional"><input id="c-s" className={inputCls} value={stripeFee} onChange={(e) => setStripeFee(e.target.value)} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={recWaived} onChange={(e) => setRecWaived(e.target.checked)} /> Processing fee waived for this organiser</label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={calcReg} onChange={(e) => setCalcReg(e.target.checked)} /> Organiser VAT registered</label></div>
        {calc ? <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2"><div className="flex justify-between"><dt>Price</dt><dd>{pounds(calc.price)}</dd></div><div className="flex justify-between"><dt>VAT</dt><dd>{pounds(calc.vatPence)}</dd></div><div className="flex justify-between"><dt>OneShetland commission</dt><dd className="font-semibold">{pounds(calc.commission)}</dd></div><div className="flex justify-between"><dt>Estimated card processing fee</dt><dd className="font-semibold">{pounds(calc.recovery)}</dd></div><div className="flex justify-between"><dt>Customer pays</dt><dd className="font-semibold">{pounds(calc.charge)}</dd></div><div className="flex justify-between"><dt>Organiser receives</dt><dd className="font-semibold">{pounds(calc.net)}</dd></div>{calc.variance !== null && <div className="flex justify-between"><dt>Variance (estimate minus actual)</dt><dd className="font-semibold">{pounds(calc.variance)}</dd></div>}{calc.platformMargin !== null && <div className="flex justify-between"><dt>OneShetland keeps (commission plus variance)</dt><dd className={calc.belowCost ? "font-bold text-rose-700" : "font-semibold"}>{pounds(calc.platformMargin)}{calc.belowCost ? " (negative)" : ""}</dd></div>}</dl> : <p className="mt-3 text-sm text-rose-700">Enter a price like 100 or 100.00.</p>}
      </Panel>

      <Panel title="Packages and promotions" sub="The rate card organisers choose from once an Edition is approved. Same prices for Businesses and Hubs. Changing a row never changes orders already paid.">
        <p className="mb-3 rounded-card bg-sand/60 px-3 py-2 text-sm text-ink-soft">{NO_RESTRICTIONS_NOTE}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{shown.map((p) => (<li key={p.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-semibold text-ink">{p.name} <span className="ml-1 rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-soft">{KIND_WORD[kindOf(p)]}</span>{p.is_free ? <span className="ml-2 rounded-pill bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Free</span> : null}</p><p className="text-ink-soft">{p.is_free ? "Free" : pounds(p.price_pence)} · {describeIncludes(p, (f) => FEATURE_LABEL[f] ?? f)}</p>{(p.grants?.discovery_days || p.grants?.homepage_days) ? <p className="text-ink-soft">Includes: {describeGrants(p.grants)}</p> : null}</div><div className="flex items-center gap-3"><Pill label={isRetired(p) ? "Retired" : p.active ? "On sale" : "Off"} tone={isRetired(p) ? "red" : p.active ? "green" : "gray"} />{canEditRow(p) && <button type="button" className={btnQuiet} onClick={() => edit(p)}>Edit</button>}</div></li>))}</ul>
        {nRetired > 0 && <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> Show retired ({nRetired})</label>}
        {showRetired && nRetired > 0 && <p className="mt-1 text-xs text-ink-muted">Retired rows are kept for old orders. They cannot be edited or switched back on.</p>}
        {pk && editing ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); pkA.run(() => upsertPackage(pk), { success: "Saved.", onOk: () => { setPk(null); router.refresh(); } }); }}>
            <p className="text-sm font-semibold text-ink sm:col-span-3">Editing {editing.name}</p>
            <Field label="Name" htmlFor="k-name"><input id="k-name" className={inputCls} value={pk.name} maxLength={80} onChange={(e) => setPk({ ...pk, name: e.target.value })} /></Field>
            <Field label="Price (£)" htmlFor="k-price" hint="What the customer is charged. Any VAT wording comes from the note setting above; nothing is calculated."><input id="k-price" className={inputCls} inputMode="decimal" value={pk.price} onChange={(e) => setPk({ ...pk, price: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={pk.active} onChange={(e) => setPk({ ...pk, active: e.target.checked })} /> On sale</label>
            <div className="sm:col-span-3"><Field label="Description" htmlFor="k-desc" hint="Shown to organisers. Up to 600 characters."><textarea id="k-desc" className={inputCls} rows={3} maxLength={600} value={pk.description} onChange={(e) => setPk({ ...pk, description: e.target.value })} /></Field></div>
            <Field label="Order on the page" htmlFor="k-sort"><input id="k-sort" className={inputCls} inputMode="numeric" value={pk.sort} onChange={(e) => setPk({ ...pk, sort: e.target.value })} /></Field>
            <div className="text-xs text-ink-muted sm:col-span-2">{kindOf(editing) === "promotion" ? "A promotion grants its days only and never extends publishing. Its days and shape are fixed." : `Fixed for every package: ${ALL_FEATURES.length} features, no member cap, ${editing.duration_days} days of publishing${editing.grants?.discovery_days || editing.grants?.homepage_days ? `, and ${describeGrants(editing.grants)}` : ""}.`}</div>
            <div className="flex gap-3 sm:col-span-3"><button type="submit" className={btnPrimary} disabled={pkA.pending}>Save</button><button type="button" className={btnSecondary} onClick={() => setPk(null)}>Cancel</button></div>
          </form>
        ) : null}
        <Notice msg={pkA.msg} />
      </Panel>

      <Panel title="Organiser abilities" sub="Grant or withdraw what an organiser may do (take payments, memberships and so on). Each grant has an end date and a reason.">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{entitlements.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-muted">None granted.</li> : entitlements.map((e) => (<li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"><span><strong className="text-ink">{orgName(e.organiser_id)}</strong> · {FEATURE_LABEL[e.feature] ?? e.feature}{e.max_value ? ` (limit ${e.max_value})` : ""} · to {new Date(e.ends_at).toLocaleDateString("en-GB")} · {e.source === "payment" ? "bought" : "granted"}</span><button type="button" className={btnQuiet} onClick={() => { const r = window.prompt("Reason for withdrawing this?"); if (r) rA.run(() => voidOrgEntitlement(e.id, r), { onOk: () => router.refresh() }); }}>Withdraw</button></li>))}</ul>
        <form className="mt-4 grid gap-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); gA.run(() => grantOrgEntitlement(g), { success: "Granted.", onOk: () => router.refresh() }); }}>
          <Field label="Organiser" htmlFor="g-o"><select id="g-o" className={inputCls} value={g.organiserId} onChange={(e) => setG({ ...g, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Ability" htmlFor="g-f"><select id="g-f" className={inputCls} value={g.feature} onChange={(e) => setG({ ...g, feature: e.target.value })}>{Object.entries(FEATURE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Member limit" htmlFor="g-m"><input id="g-m" className={inputCls} value={g.max} onChange={(e) => setG({ ...g, max: e.target.value })} /></Field><Field label="Days" htmlFor="g-d"><input id="g-d" className={inputCls} value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} /></Field>
          <Field label="Reason" htmlFor="g-r"><input id="g-r" className={inputCls} value={g.reason} onChange={(e) => setG({ ...g, reason: e.target.value })} /></Field><div className="sm:col-span-5"><button type="submit" className={btnPrimary} disabled={gA.pending}>Grant</button></div></form><Notice msg={gA.msg} /><Notice msg={rA.msg} />
      </Panel>

      <Panel title="Fee exceptions" sub="A different commission, or no commission, for one organiser (for example a launch partner). The newest live exception applies to the commission only; the estimated card processing fee is still recovered unless you also tick the processing-fee waiver. The newest live exception wins.">
        <form className="grid gap-3 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); oA.run(() => setFeeOverride(o), { success: "Saved.", onOk: () => router.refresh() }); }}>
          <Field label="Organiser" htmlFor="o-o"><select id="o-o" className={inputCls} value={o.organiserId} onChange={(e) => setO({ ...o, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Applies to" htmlFor="o-k"><select id="o-k" className={inputCls} value={o.kind} onChange={(e) => setO({ ...o, kind: e.target.value })}><option value="participation">Participation</option><option value="membership">Membership</option></select></Field>
          <Field label="Percent" htmlFor="o-p"><input id="o-p" className={inputCls} value={o.percent} onChange={(e) => setO({ ...o, percent: e.target.value })} /></Field><Field label="Fixed (£)" htmlFor="o-f"><input id="o-f" className={inputCls} value={o.fixed} onChange={(e) => setO({ ...o, fixed: e.target.value })} /></Field>
          <Field label="Days (blank = no end)" htmlFor="o-d"><input id="o-d" className={inputCls} value={o.days} onChange={(e) => setO({ ...o, days: e.target.value })} /></Field><label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={o.waived} onChange={(e) => setO({ ...o, waived: e.target.checked })} /> No commission at all</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-6"><input type="checkbox" className="h-5 w-5" checked={o.recoveryWaived} onChange={(e) => setO({ ...o, recoveryWaived: e.target.checked })} /> Also waive the estimated card processing fee (OneShetland absorbs the card cost; audited)</label>
          <div className="sm:col-span-6"><Field label="Reason" htmlFor="o-r"><input id="o-r" className={inputCls} value={o.reason} onChange={(e) => setO({ ...o, reason: e.target.value })} /></Field></div><div className="sm:col-span-6"><button type="submit" className={btnPrimary} disabled={oA.pending}>Save exception</button></div></form><Notice msg={oA.msg} />
      </Panel>

      <Panel title="Pause or resume collection" sub="Stops new payments for one organiser. Existing members and partners are unaffected.">
        <div className="flex flex-wrap items-end gap-3"><Field label="Organiser" htmlFor="s-o"><select id="s-o" className={inputCls} value={s.organiserId} onChange={(e) => setS({ ...s, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.collection_suspended ? " (paused)" : ""}</option>)}</select></Field><Field label="Reason" htmlFor="s-r"><input id="s-r" className={inputCls} value={s.reason} onChange={(e) => setS({ ...s, reason: e.target.value })} /></Field>
          <button type="button" className={btnSecondary} disabled={sA.pending} onClick={() => sA.run(() => setCollectionSuspended(s.organiserId, true, s.reason), { success: "Paused.", onOk: () => router.refresh() })}>Pause</button><button type="button" className={btnSecondary} disabled={sA.pending} onClick={() => sA.run(() => setCollectionSuspended(s.organiserId, false, s.reason), { success: "Resumed.", onOk: () => router.refresh() })}>Resume</button></div><Notice msg={sA.msg} />
      </Panel>

      <Panel title={`Needs attention (${exceptions.length})`} sub="Payments that do not match, disputes, and anything the system refused. Nothing is changed automatically: look in Stripe, then resolve with a note.">
        {exceptions.length === 0 ? <p className="text-sm text-ink-muted">Nothing to look at.</p> : <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{exceptions.map((x) => (<li key={x.id} className="px-4 py-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{x.kind.replace(/_/g, " ")} <span className="font-normal text-ink-muted">· {x.provider_ref} {orgName(x.organiser_id) && `· ${orgName(x.organiser_id)}`}</span></p><p className="break-all text-xs text-ink-soft">{JSON.stringify(x.detail)}</p></div><button type="button" className={btnQuiet} onClick={() => { const n = window.prompt("What did you find, and what did you do?"); if (n) rA.run(() => resolveException(x.id, n), { onOk: () => router.refresh() }); }}>Resolve</button></div></li>))}</ul>}
      </Panel>

      <Panel title="Fees earned (last 90 days)" sub={<>Commission and the estimated card processing fee. <Link href="/admin/editions/commerce/reports" className="font-semibold text-navy underline">Full fee statement, variance report and disputes</Link></>}>
        {fees.length === 0 ? <p className="text-sm text-ink-muted">No card payments yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Organiser</th><th>Payments</th><th>Card total</th><th>Commission</th><th>Est. processing fee</th><th>Refunded</th></tr></thead><tbody>{fees.map((f) => (<tr key={f.organiser_name} className="border-t border-line"><td className="py-1.5 font-semibold">{f.organiser_name}</td><td>{f.payments}</td><td>{pounds(f.gross_pence)}</td><td>{pounds(f.commission_earned_pence ?? f.platform_fee_pence)}</td><td>{pounds(f.processing_fee_estimate_pence ?? 0)}</td><td>{pounds(f.refunded_pence)}</td></tr>))}</tbody></table></div>}
      </Panel>
    </div>
  );
}
