"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveTier, decideMembership, endMembership, findMemberBusinesses, inviteMember, recordOfflineMembership, renewOfflineMembership, saveTier, setMemberNote } from "@/app/organise/commerce-actions";
import { INTERVAL_LABEL, MEMBER_STATUS, METHOD_LABEL, benefitText, pounds, tierPriceText, type OrgMember, type Tier } from "@/lib/editions/commerce";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Field, Notice, Pill, btnPrimary, btnQuiet, btnSecondary, inputCls } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";

const TONE = { good: "green", wait: "amber", ask: "blue", bad: "red", off: "gray" } as const;
type Draft = { id: string | null; name: string; description: string; benefits: string; free: boolean; monthly: string; annual: string; vat_mode: string; join_mode: string; edition_benefit: string; discount: string; max_members: string };
const blank = (): Draft => ({ id: null, name: "", description: "", benefits: "", free: false, monthly: "", annual: "", vat_mode: "none", join_mode: "application", edition_benefit: "none", discount: "", max_members: "" });
const fromTier = (t: Tier): Draft => ({ id: t.id, name: t.name, description: t.description ?? "", benefits: t.benefits.join("\n"), free: t.is_free, monthly: t.price_monthly_pence != null ? (t.price_monthly_pence / 100).toFixed(2) : "", annual: t.price_annual_pence != null ? (t.price_annual_pence / 100).toFixed(2) : "", vat_mode: t.vat_mode, join_mode: t.join_mode, edition_benefit: t.edition_benefit, discount: t.edition_discount_percent ? String(t.edition_discount_percent) : "", max_members: t.max_members ? String(t.max_members) : "" });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "");

/** Everything an organiser does with memberships: tiers, applications, invitations, members, offline records, renewals. Plain words; the database enforces every rule. */
export function MembersManager({ slug, tiers, members, renewals, canManage, hasMemberships, hasOffline, vatRegistered }: {
  slug: string; tiers: Tier[]; members: OrgMember[]; renewals: { membership_id: string; business_name: string; tier_name: string; billing_interval: string; current_period_end: string; status: string }[];
  canManage: boolean; hasMemberships: boolean; hasOffline: boolean; vatRegistered: boolean;
}) {
  const router = useRouter(); const confirm = useConfirm();
  const live = tiers.filter((t) => !t.archived_at);
  const applied = members.filter((m) => m.status === "applied");
  const [draft, setDraft] = useState<Draft | null>(null); const save = useAction(); const act = useAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const [mode, setMode] = useState<null | "invite" | "offline">(null);
  const [q, setQ] = useState(""); const [found, setFound] = useState<{ id: string; name: string; address: string | null; claimed: boolean; membership_status: string | null }[]>([]);
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ tier: "", interval: "monthly", message: "", kind: "offline", amount: "", method: "cheque", note: "", start: "", end: "" });
  const f = (k: string, v: string) => setForm((x) => ({ ...x, [k]: v })); const send = useAction(); const search = useAction(); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null); const [noteText, setNoteText] = useState(""); const [renew, setRenew] = useState<string | null>(null);
  function onQ(v: string) { setQ(v); if (timer.current) clearTimeout(timer.current); if (v.trim().length < 2) { setFound([]); return; } timer.current = setTimeout(() => search.run(() => findMemberBusinesses(slug, v), { onOk: (r) => setFound((r as unknown as { rows: typeof found }).rows) }), 250); }
  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  async function archive(t: Tier) { if (await confirm({ title: `Archive ${t.name}?`, body: "People can no longer join this tier. Existing members keep it until they leave.", confirmLabel: "Archive", danger: true })) act.run(() => archiveTier(slug, t.id), { onOk: () => router.refresh() }); }
  async function end(m: OrgMember, when: "now" | "period_end") {
    const note = window.prompt(`Why is ${m.business_name} leaving? They will see this.`); if (!note || note.trim().length < 3) return;
    if (await confirm({ title: `End ${m.business_name}'s membership ${when === "now" ? "now" : "at the end of the period"}?`, body: when === "now" ? "Their benefits stop straight away. Any refund is a separate step on the Payments page." : "They keep their benefits until the period ends.", confirmLabel: "End membership", danger: true })) act.run(() => endMembership(slug, m.membership_id, when, note), { onOk: () => router.refresh() });
  }
  return (
    <div className="space-y-10">
      {!hasMemberships && <section className="rounded-card border border-amber-200 bg-amber-50/60 p-5"><h2 className="font-display text-xl font-bold text-ink">Memberships are not part of your package yet</h2><p className="mt-1 text-sm text-ink-soft">You can look around, but you cannot create tiers or take members until a package that includes memberships is active. Ask OneShetland, or choose a package.</p></section>}

      {applied.length > 0 && (
        <section aria-labelledby="app-h" className="rounded-card border border-sky-200 bg-sky-50/60 p-5"><h2 id="app-h" className="font-display text-xl font-bold text-ink">Applications ({applied.length})</h2>
          <ul className="mt-3 space-y-3">{applied.map((m) => (
            <li key={m.membership_id} className="rounded-xl border border-line bg-paper p-4"><p className="font-semibold text-ink">{m.business_name} <span className="font-normal text-ink-muted">· {m.tier_name}</span></p>{m.message && <p className="mt-1 text-sm text-ink-soft">&ldquo;{m.message}&rdquo;</p>}
              {canManage && <div className="mt-3 flex gap-2"><button type="button" className={btnPrimary} disabled={act.pending} onClick={() => act.run(() => decideMembership(slug, m.membership_id, "approve"), { onOk: () => router.refresh() })}>Approve</button><button type="button" className={btnSecondary} disabled={act.pending} onClick={() => { const n = window.prompt("A short note for them (optional)") ?? ""; act.run(() => decideMembership(slug, m.membership_id, "decline", n), { onOk: () => router.refresh() }); }}>Decline</button></div>}</li>))}</ul></section>
      )}

      <section aria-labelledby="tier-h"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="tier-h" className="font-display text-2xl font-bold text-ink">Membership tiers</h2><p className="text-sm text-ink-soft">What people can join, what it costs and what they get.</p></div>
        {canManage && hasMemberships && <button type="button" className={btnPrimary} onClick={() => { setDraft(blank()); save.setMsg(null); }}>New tier</button>}</div>
        {draft && (
          <form className={`${card} mt-4 space-y-4`} noValidate onSubmit={(e) => { e.preventDefault(); save.run(() => saveTier(slug, draft.id, { ...draft, free: draft.free }), { success: "Tier saved.", onOk: () => { setDraft(null); router.refresh(); } }); }}>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Name" htmlFor="t-name"><input id="t-name" className={inputCls} value={draft.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="How people join" htmlFor="t-join"><select id="t-join" className={inputCls} value={draft.join_mode} onChange={(e) => set("join_mode", e.target.value)}><option value="application">Apply, you approve</option><option value="open">Open: join and pay straight away</option><option value="invite_only">Invitation only</option></select></Field></div>
            <Field label="Short description" htmlFor="t-desc"><textarea id="t-desc" className={`${inputCls} min-h-20`} maxLength={600} value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Benefits (one per line)" htmlFor="t-ben" hint="For example: Listed on the members page. Early programme access."><textarea id="t-ben" className={`${inputCls} min-h-24`} value={draft.benefits} onChange={(e) => set("benefits", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" className="h-5 w-5" checked={draft.free} onChange={(e) => set("free", e.target.checked)} /> This tier is free</label>
            {!draft.free && <div className="grid gap-4 sm:grid-cols-3"><Field label="Monthly price (£)" htmlFor="t-m" hint="Members pay exactly this; nothing is added. OneShetland's commission and an estimated card processing fee come out of what you receive."><input id="t-m" className={inputCls} inputMode="decimal" value={draft.monthly} onChange={(e) => set("monthly", e.target.value)} /></Field><Field label="Yearly price (£)" htmlFor="t-a"><input id="t-a" className={inputCls} inputMode="decimal" value={draft.annual} onChange={(e) => set("annual", e.target.value)} /></Field>
              <Field label="VAT" htmlFor="t-v" hint={vatRegistered ? undefined : "Only applies once you are VAT registered."}><select id="t-v" className={inputCls} value={draft.vat_mode} onChange={(e) => set("vat_mode", e.target.value)}><option value="none">No VAT</option><option value="inclusive">Price includes VAT</option><option value="exclusive">VAT added on top</option></select></Field></div>}
            <div className="grid gap-4 sm:grid-cols-3"><Field label="Edition benefit" htmlFor="t-eb"><select id="t-eb" className={inputCls} value={draft.edition_benefit} onChange={(e) => set("edition_benefit", e.target.value)}><option value="none">None</option><option value="free">Free participation</option><option value="percent_off">Discount on participation</option></select></Field>
              {draft.edition_benefit === "percent_off" && <Field label="Discount (%)" htmlFor="t-d"><input id="t-d" className={inputCls} inputMode="numeric" value={draft.discount} onChange={(e) => set("discount", e.target.value)} /></Field>}
              <Field label="Member limit" htmlFor="t-max" hint="Leave blank for no limit"><input id="t-max" className={inputCls} inputMode="numeric" value={draft.max_members} onChange={(e) => set("max_members", e.target.value)} /></Field></div>
            {draft.id && <p className="text-xs text-ink-muted">If you change the price or benefit and this tier already has members, they keep what they signed up to and the tier is saved as a new version.</p>}
            <Notice msg={save.msg} /><div className="flex gap-2.5"><button type="submit" className={btnPrimary} disabled={save.pending}>{save.pending ? "Saving…" : "Save tier"}</button><button type="button" className={btnSecondary} onClick={() => setDraft(null)}>Cancel</button></div></form>)}
        {live.length === 0 ? <div className="mt-4"><EmptyState>No tiers yet.</EmptyState></div> : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">{live.map((t) => (<li key={t.id} className={card}><div className="flex items-start justify-between gap-2"><h3 className="font-display text-lg font-bold text-ink">{t.name}</h3><Pill label={t.join_mode === "open" ? "Open" : t.join_mode === "invite_only" ? "Invite only" : "Apply"} tone="blue" /></div>
            <p className="mt-1 font-semibold text-ink">{tierPriceText(t)}</p>{t.description && <p className="mt-1 text-sm text-ink-soft">{t.description}</p>}
            {t.benefits.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">{t.benefits.map((b) => <li key={b}>{b}</li>)}</ul>}{benefitText(t) && <p className="mt-2 text-sm font-semibold text-ink">{benefitText(t)}</p>}
            {canManage && hasMemberships && <div className="mt-3 flex gap-3"><button type="button" className={btnQuiet} onClick={() => { setDraft(fromTier(t)); save.setMsg(null); }}>Edit</button><button type="button" className={btnQuiet} onClick={() => archive(t)}>Archive</button></div>}</li>))}</ul>)}
      </section>

      <section aria-labelledby="mem-h"><div className="flex flex-wrap items-end justify-between gap-3"><h2 id="mem-h" className="font-display text-2xl font-bold text-ink">Members ({members.filter((m) => !["declined", "withdrawn", "applied"].includes(m.status)).length})</h2>
        {canManage && live.length > 0 && <div className="flex gap-2"><button type="button" className={btnSecondary} onClick={() => { setMode(mode === "invite" ? null : "invite"); setPick(null); setQ(""); setFound([]); send.setMsg(null); setForm((x) => ({ ...x, tier: live[0].id })); }}>Invite a business</button>
          {hasOffline && <button type="button" className={btnSecondary} onClick={() => { setMode(mode === "offline" ? null : "offline"); setPick(null); setQ(""); setFound([]); send.setMsg(null); setForm((x) => ({ ...x, tier: live[0].id, kind: "offline" })); }}>Record an existing member</button>}</div>}</div>
        {mode && (
          <div className={`${card} mt-4 space-y-4`}>
            <h3 className="font-display text-lg font-bold text-ink">{mode === "invite" ? "Invite a business" : "Record a member who paid outside OneShetland"}</h3>
            {mode !== "invite" && <p className="text-sm text-ink-soft">The business owner confirms this before it counts. Until they accept, it is not shown as a member and no payment is recorded.</p>}
            {!pick ? (<div><Field label="Find a business in the directory" htmlFor="m-q" hint="Type at least two letters."><input id="m-q" className={inputCls} value={q} onChange={(e) => onQ(e.target.value)} autoComplete="off" /></Field>
              <ul className="mt-2 space-y-2">{found.map((b) => (<li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"><span className="min-w-0 text-sm"><span className="font-semibold text-ink">{b.name}</span> <span className="text-ink-muted">{b.address}</span>{mode === "invite" && !b.claimed && <span className="block text-amber-800">Not claimed yet, so nobody can answer.</span>}</span>
                {b.membership_status ? <Pill label={MEMBER_STATUS[b.membership_status as keyof typeof MEMBER_STATUS]?.label ?? b.membership_status} tone="gray" /> : <button type="button" className={btnSecondary} disabled={mode === "invite" && !b.claimed} onClick={() => setPick({ id: b.id, name: b.name })}>Choose</button>}</li>))}</ul></div>
            ) : (
              <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); send.run(() => (mode === "invite" ? inviteMember(slug, { tier: form.tier, business: pick.id, interval: form.interval, message: form.message }) : recordOfflineMembership(slug, { tier: form.tier, business: pick.id, kind: form.kind, amount: form.amount, method: form.method, note: form.note, start: form.start, end: form.end })), { success: mode === "invite" ? "Invitation sent." : "Member recorded.", onOk: () => { setMode(null); setPick(null); router.refresh(); } }); }}>
                <p className="text-ink"><strong>{pick.name}</strong></p>
                <Field label="Tier" htmlFor="m-tier"><select id="m-tier" className={inputCls} value={form.tier} onChange={(e) => f("tier", e.target.value)}>{live.map((t) => <option key={t.id} value={t.id}>{t.name}: {tierPriceText(t)}</option>)}</select></Field>
                {mode === "invite" ? (<><Field label="Billing" htmlFor="m-int"><select id="m-int" className={inputCls} value={form.interval} onChange={(e) => f("interval", e.target.value)}><option value="monthly">Monthly</option><option value="annual">Yearly</option></select></Field><Field label="Message" htmlFor="m-msg"><textarea id="m-msg" className={`${inputCls} min-h-24`} maxLength={500} value={form.message} onChange={(e) => f("message", e.target.value)} /></Field></>) : (
                  <><div className="grid gap-4 sm:grid-cols-2"><Field label="Type" htmlFor="m-kind"><select id="m-kind" className={inputCls} value={form.kind} onChange={(e) => f("kind", e.target.value)}><option value="offline">Paid outside OneShetland</option><option value="complimentary">Free (complimentary)</option></select></Field>
                    {form.kind === "offline" && <Field label="Amount received (£)" htmlFor="m-amt"><input id="m-amt" className={inputCls} inputMode="decimal" value={form.amount} onChange={(e) => f("amount", e.target.value)} /></Field>}
                    {form.kind === "offline" && <Field label="How it was paid" htmlFor="m-meth"><select id="m-meth" className={inputCls} value={form.method} onChange={(e) => f("method", e.target.value)}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
                    <Field label="Starts (optional)" htmlFor="m-s"><input id="m-s" type="date" className={inputCls} value={form.start} onChange={(e) => f("start", e.target.value)} /></Field><Field label="Ends" htmlFor="m-e" hint="Up to a year"><input id="m-e" type="date" className={inputCls} value={form.end} onChange={(e) => f("end", e.target.value)} /></Field></div>
                    <Field label={form.kind === "offline" ? "Note (cheque number, reference)" : "Why is this free?"} htmlFor="m-note"><input id="m-note" className={inputCls} maxLength={500} value={form.note} onChange={(e) => f("note", e.target.value)} /></Field></>)}
                <Notice msg={send.msg} /><div className="flex gap-2.5"><button type="submit" className={btnPrimary} disabled={send.pending}>{mode === "invite" ? "Send invitation" : "Send for the business to confirm"}</button><button type="button" className={btnSecondary} onClick={() => setPick(null)}>Choose someone else</button></div></form>)}
          </div>)}
        {members.length === 0 ? <div className="mt-4"><EmptyState>No members yet.</EmptyState></div> : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{members.filter((m) => m.status !== "applied").map((m) => { const st = MEMBER_STATUS[m.status]; return (
            <li key={m.membership_id} className="px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-ink">{m.business_name} <span className="font-normal text-ink-muted">· {m.tier_name}</span></p>
              <p className="text-sm text-ink-soft">{INTERVAL_LABEL[m.billing_interval ?? ""] ?? ""}{m.current_period_end ? ` · until ${day(m.current_period_end)}` : ""}{m.last_payment_at ? ` · last payment ${pounds(m.last_payment_pence)} on ${day(m.last_payment_at)}` : ""}</p>{m.organiser_note && <p className="mt-0.5 text-sm text-ink-muted">Note: {m.organiser_note}</p>}</div><Pill label={m.status === "invited" && m.source === "offline_record" ? "Offered, waiting for the business to accept" : st.label} tone={TONE[st.tone]} /></div>
              {canManage && ["active", "past_due", "cancel_at_period_end", "expired", "cancelled"].includes(m.status) && (<div className="mt-2 flex flex-wrap gap-3 text-sm">
                <button type="button" className={btnQuiet} onClick={() => { setNoteFor(noteFor === m.membership_id ? null : m.membership_id); setNoteText(m.organiser_note ?? ""); }}>Note</button>
                {["offline", "complimentary"].includes(m.billing_interval ?? "") && hasOffline && <button type="button" className={btnQuiet} onClick={() => setRenew(renew === m.membership_id ? null : m.membership_id)}>Renew</button>}
                {["active", "past_due", "cancel_at_period_end"].includes(m.status) && <><button type="button" className={btnQuiet} onClick={() => end(m, "period_end")}>End at period end</button><button type="button" className={btnQuiet} onClick={() => end(m, "now")}>End now</button></>}</div>)}
              {noteFor === m.membership_id && <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); act.run(() => setMemberNote(slug, m.membership_id, noteText), { success: "Saved.", onOk: () => { setNoteFor(null); router.refresh(); } }); }}><input className={inputCls} aria-label={`Private note about ${m.business_name}`} value={noteText} maxLength={1000} onChange={(e) => setNoteText(e.target.value)} placeholder="Private note, only your team sees this" /><button type="submit" className={btnSecondary}>Save</button></form>}
              {renew === m.membership_id && <RenewForm onSubmit={(v) => act.run(() => renewOfflineMembership(slug, m.membership_id, { ...v, kind: m.billing_interval }), { success: "Renewed.", onOk: () => { setRenew(null); router.refresh(); } })} complimentary={m.billing_interval === "complimentary"} />}</li>); })}</ul>)}
        <Notice msg={act.msg} />
      </section>

      {renewals.length > 0 && (<section aria-labelledby="ren-h"><h2 id="ren-h" className="font-display text-2xl font-bold text-ink">Renewals in the next 30 days</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper">{renewals.map((r) => (<li key={r.membership_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-semibold text-ink">{r.business_name} <span className="font-normal text-ink-muted">· {r.tier_name}</span></span><span className="text-ink-soft">{day(r.current_period_end)} · {["offline", "complimentary"].includes(r.billing_interval) ? "renew by hand" : "renews automatically"}</span></li>))}</ul></section>)}
    </div>
  );
}

function RenewForm({ onSubmit, complimentary }: { onSubmit: (v: Record<string, string>) => void; complimentary: boolean }) {
  const [v, setV] = useState<Record<string, string>>({ amount: "", method: "cheque", note: "", end: "" });
  return (<form className="mt-2 grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
    {!complimentary && <Field label="Amount (£)" htmlFor="rn-a"><input id="rn-a" className={inputCls} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>}
    {!complimentary && <Field label="Paid by" htmlFor="rn-m"><select id="rn-m" className={inputCls} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>{Object.entries(METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
    <Field label="New end date" htmlFor="rn-e"><input id="rn-e" type="date" className={inputCls} value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></Field>
    <Field label="Note" htmlFor="rn-n"><input id="rn-n" className={inputCls} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
    <div className="sm:col-span-4"><button type="submit" className={btnPrimary}>Record renewal</button></div></form>);
}
