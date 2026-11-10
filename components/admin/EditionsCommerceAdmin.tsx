"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { grantOrgEntitlement, resolveException, setCollectionSuspended, setCommerceConfig, setFeeOverride, upsertPackage, voidOrgEntitlement } from "@/app/admin/editions/commerce/actions";
import { COMMERCE_KEYS, previewFee, type FeeConfig } from "@/app/admin/editions/commerce/config";
import { FEATURE_LABEL, pounds, toPence } from "@/lib/editions/commerce";
import { Field, Notice, Panel, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

type Pkg = { code: string; name: string; description: string | null; price_pence: number; duration_days: number; features: string[]; max_members: number | null; active: boolean; sort: number; audience?: "any" | "hub"; is_free?: boolean };
type Org = { id: string; name: string; status: string; collection_suspended?: boolean };
type Ent = { id: string; organiser_id: string; feature: string; max_value: number | null; ends_at: string; source: string; reason: string | null };
type Exc = { id: string; kind: string; provider_ref: string; detail: Record<string, unknown>; created_at: string; organiser_id: string | null };
type FeeRow = { organiser_name: string; payments: number; gross_pence: number; platform_fee_pence: number; refunded_pence: number };

/** The administrator's commercial control room: the model, the packages, who may take payments, fee exceptions, and what needs attention. Every change is audited by the database. */
export function EditionsCommerceAdmin({ config, packages, organisers, entitlements, exceptions, fees }: { config: Record<string, string>; packages: Pkg[]; organisers: Org[]; entitlements: Ent[]; exceptions: Exc[]; fees: FeeRow[] }) {
  const router = useRouter();
  const val = (k: string, def: string) => config[k] ?? def;
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(COMMERCE_KEYS.map((c) => [c.key, val(c.key, c.def)])));
  const cfg = useAction();
  const dirty = COMMERCE_KEYS.filter((c) => draft[c.key] !== val(c.key, c.def));
  const saveAll = () => cfg.run(async () => { for (const c of dirty) { const r = await setCommerceConfig(c.key, draft[c.key]); if (!r.ok) return { ok: false as const, error: `${c.label}: ${r.error}` }; } return { ok: true as const }; }, { success: "Saved.", onOk: () => router.refresh() });

  // fee calculator
  const [calcKind, setCalcKind] = useState<"participation" | "membership">("participation"); const [calcPrice, setCalcPrice] = useState("100"); const [calcVat, setCalcVat] = useState<"none" | "inclusive" | "exclusive">("none"); const [calcReg, setCalcReg] = useState(false); const [stripeFee, setStripeFee] = useState("");
  const num = (k: string) => Number(draft[`editions.commerce.${calcKind}.${k}`] || 0);
  const fc: FeeConfig = { percent: num("fee_percent"), fixed: num("fee_fixed_pence"), min: num("fee_min_pence"), cap: draft[`editions.commerce.${calcKind}.fee_cap_pence`] === "" ? null : num("fee_cap_pence"), payer: (draft["editions.commerce.fee_payer"] as "organiser" | "business") ?? "organiser", vatRate: Number(draft["editions.commerce.vat_rate_percent"] || 20) };
  const price = toPence(calcPrice); const sf = stripeFee.trim() ? toPence(stripeFee) : undefined;
  const calc = price !== null ? previewFee(price, fc, calcVat, calcReg, sf ?? undefined) : null;

  // packages
  const [pk, setPk] = useState({ code: "", name: "", description: "", price: "", days: "365", features: [] as string[], max_members: "", active: false, sort: "0", audience: "any" as "any" | "hub", is_free: false }); const pkA = useAction();
  const edit = (p: Pkg) => setPk({ code: p.code, name: p.name, description: p.description ?? "", price: (p.price_pence / 100).toFixed(2), days: String(p.duration_days), features: p.features, max_members: p.max_members ? String(p.max_members) : "", active: p.active, sort: String(p.sort), audience: p.audience === "hub" ? "hub" : "any", is_free: p.is_free === true });
  // entitlements, overrides, suspension
  const [g, setG] = useState({ organiserId: organisers[0]?.id ?? "", feature: "collect_payments", max: "", days: "90", reason: "" }); const gA = useAction();
  const [o, setO] = useState({ organiserId: organisers[0]?.id ?? "", kind: "participation", percent: "", fixed: "", waived: false, reason: "", days: "" }); const oA = useAction();
  const [s, setS] = useState({ organiserId: organisers[0]?.id ?? "", reason: "" }); const sA = useAction(); const rA = useAction();
  const orgName = (id: string | null) => organisers.find((x) => x.id === id)?.name ?? "";
  return (
    <div className="space-y-10">
      <Panel title="Commercial model" sub="Every change is recorded in the audit log. Payments stay off until you switch the master setting on, and nothing is real until Stripe functions are deployed.">
        <div className="space-y-4">{COMMERCE_KEYS.map((c) => (
          <div key={c.key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start sm:gap-4"><div><label htmlFor={c.key} className="text-sm font-semibold text-ink">{c.label}</label><p className="text-xs text-ink-muted">{c.help}</p></div>
            {c.kind === "bool" ? <select id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}><option value="true">On</option><option value="false">Off</option></select>
              : c.kind === "choice" ? <select id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}>{c.choices!.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              : <input id={c.key} className={inputCls} value={draft[c.key]} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} />}</div>))}</div>
        <div className="mt-4 flex items-center gap-3"><button type="button" className={btnPrimary} disabled={cfg.pending || dirty.length === 0} onClick={saveAll}>{cfg.pending ? "Saving…" : dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "No changes"}</button></div><Notice msg={cfg.msg} />
      </Panel>

      <Panel title="Fee calculator" sub="Try a price against the settings above (unsaved edits included). Add the provider's cost to see OneShetland's margin.">
        <div className="grid gap-3 sm:grid-cols-5"><Field label="Type" htmlFor="c-k"><select id="c-k" className={inputCls} value={calcKind} onChange={(e) => setCalcKind(e.target.value as never)}><option value="participation">Participation</option><option value="membership">Membership</option></select></Field>
          <Field label="Price (£)" htmlFor="c-p"><input id="c-p" className={inputCls} value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)} /></Field>
          <Field label="VAT mode" htmlFor="c-v"><select id="c-v" className={inputCls} value={calcVat} onChange={(e) => setCalcVat(e.target.value as never)}><option value="none">None</option><option value="inclusive">Inclusive</option><option value="exclusive">Exclusive</option></select></Field>
          <Field label="Provider cost (£)" htmlFor="c-s" hint="Optional"><input id="c-s" className={inputCls} value={stripeFee} onChange={(e) => setStripeFee(e.target.value)} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={calcReg} onChange={(e) => setCalcReg(e.target.checked)} /> Organiser VAT registered</label></div>
        {calc ? <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2"><div className="flex justify-between"><dt>Price</dt><dd>{pounds(calc.price)}</dd></div><div className="flex justify-between"><dt>VAT</dt><dd>{pounds(calc.vatPence)}</dd></div><div className="flex justify-between"><dt>Platform fee</dt><dd className="font-semibold">{pounds(calc.fee)}</dd></div><div className="flex justify-between"><dt>Business pays</dt><dd className="font-semibold">{pounds(calc.charge)}</dd></div><div className="flex justify-between"><dt>Organiser receives</dt><dd className="font-semibold">{pounds(calc.net)}</dd></div>{calc.platformMargin !== null && <div className="flex justify-between"><dt>OneShetland margin</dt><dd className={calc.belowCost ? "font-bold text-rose-700" : "font-semibold"}>{pounds(calc.platformMargin)}{calc.belowCost ? " (below cost)" : ""}</dd></div>}</dl> : <p className="mt-3 text-sm text-rose-700">Enter a price like 100 or 100.00.</p>}
      </Panel>

      <Panel title="Organiser packages" sub="What organisers choose once an Edition is approved. A package at £0 can only be offered if you mark it as a free package on purpose. Changing a package never changes orders already paid.">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{packages.map((p) => (<li key={p.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-semibold text-ink">{p.name}{p.is_free ? <span className="ml-2 rounded-pill bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Free package</span> : null}{p.audience === "hub" ? <span className="ml-2 rounded-pill bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-900">Hub-run only</span> : null} <span className="font-normal text-ink-muted">({p.code})</span></p><p className="text-ink-soft">{p.is_free ? "Free" : pounds(p.price_pence)} · {p.duration_days} days · {p.features.map((f) => FEATURE_LABEL[f] ?? f).join(", ") || "publish only"}</p></div><div className="flex items-center gap-3"><Pill label={p.active ? "On sale" : "Off"} tone={p.active ? "green" : "gray"} /><button type="button" className={btnQuiet} onClick={() => edit(p)}>Edit</button></div></li>))}</ul>
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); pkA.run(() => upsertPackage(pk), { success: "Package saved.", onOk: () => router.refresh() }); }}>
          <Field label="Code" htmlFor="k-code"><input id="k-code" className={inputCls} value={pk.code} onChange={(e) => setPk({ ...pk, code: e.target.value })} /></Field><Field label="Name" htmlFor="k-name"><input id="k-name" className={inputCls} value={pk.name} onChange={(e) => setPk({ ...pk, name: e.target.value })} /></Field><Field label="Price (£)" htmlFor="k-price" hint={pk.is_free ? "A free package costs nothing." : "Set the price yourself; nothing here is priced for you."}><input id="k-price" className={inputCls} value={pk.is_free ? "0" : pk.price} disabled={pk.is_free} onChange={(e) => setPk({ ...pk, price: e.target.value })} /></Field>
          <Field label="Days" htmlFor="k-days"><input id="k-days" className={inputCls} value={pk.days} onChange={(e) => setPk({ ...pk, days: e.target.value })} /></Field><Field label="Member limit" htmlFor="k-max"><input id="k-max" className={inputCls} value={pk.max_members} onChange={(e) => setPk({ ...pk, max_members: e.target.value })} /></Field><label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={pk.active} onChange={(e) => setPk({ ...pk, active: e.target.checked })} /> On sale</label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={pk.is_free} onChange={(e) => setPk({ ...pk, is_free: e.target.checked, price: e.target.checked ? "0" : pk.price })} /> Free package</label>
          <Field label="Who can buy it" htmlFor="k-aud" hint="Community packages are for Hub-run Editions only."><select id="k-aud" className={inputCls} value={pk.audience} onChange={(e) => setPk({ ...pk, audience: e.target.value as "any" | "hub" })}><option value="any">Any organiser</option><option value="hub">Hub-run Editions only</option></select></Field>
          <fieldset className="sm:col-span-3"><legend className="text-sm font-semibold text-ink">Includes</legend><div className="mt-1 flex flex-wrap gap-4">{Object.entries(FEATURE_LABEL).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={pk.features.includes(k)} onChange={(e) => setPk({ ...pk, features: e.target.checked ? [...pk.features, k] : pk.features.filter((x) => x !== k) })} /> {l}</label>)}</div></fieldset>
          <div className="sm:col-span-3"><button type="submit" className={btnPrimary} disabled={pkA.pending}>Save package</button></div></form><Notice msg={pkA.msg} />
      </Panel>

      <Panel title="Organiser abilities" sub="Grant or withdraw what an organiser may do (take payments, memberships and so on). Each grant has an end date and a reason.">
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{entitlements.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-muted">None granted.</li> : entitlements.map((e) => (<li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"><span><strong className="text-ink">{orgName(e.organiser_id)}</strong> · {FEATURE_LABEL[e.feature] ?? e.feature}{e.max_value ? ` (limit ${e.max_value})` : ""} · to {new Date(e.ends_at).toLocaleDateString("en-GB")} · {e.source === "payment" ? "bought" : "granted"}</span><button type="button" className={btnQuiet} onClick={() => { const r = window.prompt("Reason for withdrawing this?"); if (r) rA.run(() => voidOrgEntitlement(e.id, r), { onOk: () => router.refresh() }); }}>Withdraw</button></li>))}</ul>
        <form className="mt-4 grid gap-3 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); gA.run(() => grantOrgEntitlement(g), { success: "Granted.", onOk: () => router.refresh() }); }}>
          <Field label="Organiser" htmlFor="g-o"><select id="g-o" className={inputCls} value={g.organiserId} onChange={(e) => setG({ ...g, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Ability" htmlFor="g-f"><select id="g-f" className={inputCls} value={g.feature} onChange={(e) => setG({ ...g, feature: e.target.value })}>{Object.entries(FEATURE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Member limit" htmlFor="g-m"><input id="g-m" className={inputCls} value={g.max} onChange={(e) => setG({ ...g, max: e.target.value })} /></Field><Field label="Days" htmlFor="g-d"><input id="g-d" className={inputCls} value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} /></Field>
          <Field label="Reason" htmlFor="g-r"><input id="g-r" className={inputCls} value={g.reason} onChange={(e) => setG({ ...g, reason: e.target.value })} /></Field><div className="sm:col-span-5"><button type="submit" className={btnPrimary} disabled={gA.pending}>Grant</button></div></form><Notice msg={gA.msg} /><Notice msg={rA.msg} />
      </Panel>

      <Panel title="Fee exceptions" sub="A different fee, or no fee, for one organiser (for example a launch partner). The newest live exception wins.">
        <form className="grid gap-3 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); oA.run(() => setFeeOverride(o), { success: "Saved.", onOk: () => router.refresh() }); }}>
          <Field label="Organiser" htmlFor="o-o"><select id="o-o" className={inputCls} value={o.organiserId} onChange={(e) => setO({ ...o, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Applies to" htmlFor="o-k"><select id="o-k" className={inputCls} value={o.kind} onChange={(e) => setO({ ...o, kind: e.target.value })}><option value="participation">Participation</option><option value="membership">Membership</option></select></Field>
          <Field label="Percent" htmlFor="o-p"><input id="o-p" className={inputCls} value={o.percent} onChange={(e) => setO({ ...o, percent: e.target.value })} /></Field><Field label="Fixed (£)" htmlFor="o-f"><input id="o-f" className={inputCls} value={o.fixed} onChange={(e) => setO({ ...o, fixed: e.target.value })} /></Field>
          <Field label="Days (blank = no end)" htmlFor="o-d"><input id="o-d" className={inputCls} value={o.days} onChange={(e) => setO({ ...o, days: e.target.value })} /></Field><label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={o.waived} onChange={(e) => setO({ ...o, waived: e.target.checked })} /> No fee at all</label>
          <div className="sm:col-span-6"><Field label="Reason" htmlFor="o-r"><input id="o-r" className={inputCls} value={o.reason} onChange={(e) => setO({ ...o, reason: e.target.value })} /></Field></div><div className="sm:col-span-6"><button type="submit" className={btnPrimary} disabled={oA.pending}>Save exception</button></div></form><Notice msg={oA.msg} />
      </Panel>

      <Panel title="Pause or resume collection" sub="Stops new payments for one organiser. Existing members and partners are unaffected.">
        <div className="flex flex-wrap items-end gap-3"><Field label="Organiser" htmlFor="s-o"><select id="s-o" className={inputCls} value={s.organiserId} onChange={(e) => setS({ ...s, organiserId: e.target.value })}>{organisers.map((x) => <option key={x.id} value={x.id}>{x.name}{x.collection_suspended ? " (paused)" : ""}</option>)}</select></Field><Field label="Reason" htmlFor="s-r"><input id="s-r" className={inputCls} value={s.reason} onChange={(e) => setS({ ...s, reason: e.target.value })} /></Field>
          <button type="button" className={btnSecondary} disabled={sA.pending} onClick={() => sA.run(() => setCollectionSuspended(s.organiserId, true, s.reason), { success: "Paused.", onOk: () => router.refresh() })}>Pause</button><button type="button" className={btnSecondary} disabled={sA.pending} onClick={() => sA.run(() => setCollectionSuspended(s.organiserId, false, s.reason), { success: "Resumed.", onOk: () => router.refresh() })}>Resume</button></div><Notice msg={sA.msg} />
      </Panel>

      <Panel title={`Needs attention (${exceptions.length})`} sub="Payments that do not match, disputes, and anything the system refused. Nothing is changed automatically: look in Stripe, then resolve with a note.">
        {exceptions.length === 0 ? <p className="text-sm text-ink-muted">Nothing to look at.</p> : <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">{exceptions.map((x) => (<li key={x.id} className="px-4 py-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{x.kind.replace(/_/g, " ")} <span className="font-normal text-ink-muted">· {x.provider_ref} {orgName(x.organiser_id) && `· ${orgName(x.organiser_id)}`}</span></p><p className="break-all text-xs text-ink-soft">{JSON.stringify(x.detail)}</p></div><button type="button" className={btnQuiet} onClick={() => { const n = window.prompt("What did you find, and what did you do?"); if (n) rA.run(() => resolveException(x.id, n), { onOk: () => router.refresh() }); }}>Resolve</button></div></li>))}</ul>}
      </Panel>

      <Panel title="Fees earned (last 90 days)">
        {fees.length === 0 ? <p className="text-sm text-ink-muted">No card payments yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[30rem] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Organiser</th><th>Payments</th><th>Card total</th><th>Platform fee</th><th>Refunded</th></tr></thead><tbody>{fees.map((f) => (<tr key={f.organiser_name} className="border-t border-line"><td className="py-1.5 font-semibold">{f.organiser_name}</td><td>{f.payments}</td><td>{pounds(f.gross_pence)}</td><td>{pounds(f.platform_fee_pence)}</td><td>{pounds(f.refunded_pence)}</td></tr>))}</tbody></table></div>}
      </Panel>
    </div>
  );
}
