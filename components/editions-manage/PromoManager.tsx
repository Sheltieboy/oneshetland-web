"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bookCampaign, bookPromotion, cancelPromotion, reschedulePromotion } from "@/app/organise/promo-actions";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { BuyFlow } from "@/components/editions-commerce/BuyFlow";
import { packageView, promoIncludesFor } from "@/lib/editions/journey";
import type { Pkg } from "@/lib/editions/commerce";
import {
  addDays, availabilityMap, bookingWindow, canChangeBooking, dayTextShort, endDay, groupRights, priceWithNote, rightLabel, runText, sharedPlacementText, STATUS_LABEL,
  type AvailRow, type PromoItem, type PromoKind, type PromoRight, type PromoSettings,
} from "@/lib/editions/promo";
import { EmptyState, Notice, Pill, btnPrimary, btnQuiet, btnSecondary } from "./kit";
import { useAction } from "./use-action";
import { PromoDatePicker } from "./PromoDatePicker";

export type PromoManagerProps = {
  organiserSlug: string; editionSlug: string; editionTitle: string;
  /** Owner or administrator. Editors can look but not schedule or buy. */
  canAct: boolean;
  /** null = promotion can be scheduled; otherwise the plain reason it cannot (shown, and every scheduling control is off). */
  scheduleBlock: string | null;
  /** null = promotion can be bought. */
  buyBlock: string | null;
  rights: PromoRight[]; settings: PromoSettings; today: string; publishedOn: string | null; entitlementEnd: string | null;
  availability: Record<PromoKind, AvailRow[]>; promotions: Pkg[]; commerceOn: boolean; hasBookings: boolean;
};

const TONE = { unused: "amber", booked: "blue", used: "gray", void: "gray" } as const;

/** Schedule a single run, or move one. */
function SingleScheduler({ right, p, ownRun, limits, onClose, bookingId }: { right: PromoRight; p: PromoManagerProps; ownRun: { start: string; end: string } | null; limits?: { from: string; to: string }; onClose: () => void; bookingId?: string }) {
  const router = useRouter();
  const { pending, msg, run } = useAction();
  const [start, setStart] = useState<string | null>(null);
  const win = bookingWindow({ today: p.today, leadDays: p.settings.leadDays, horizonDays: p.settings.horizonDays, publishedOn: p.publishedOn, entitlementEnd: p.entitlementEnd, days: right.days });
  const cap = right.kind === "homepage" ? p.settings.homepageCapacity : p.settings.discoveryCapacity;
  const avail = useMemo(() => availabilityMap(p.availability[right.kind], ownRun, cap), [p.availability, right.kind, ownRun, cap]);
  const noun = right.kind === "homepage" ? "homepage featuring" : "enhanced discovery";
  function go() {
    if (!start) return;
    run(() => (bookingId ? reschedulePromotion(p.organiserSlug, p.editionSlug, bookingId, start) : bookPromotion(p.organiserSlug, p.editionSlug, right.right_id, start)),
      { success: bookingId ? "Your promotion has been moved." : "Your promotion is scheduled.", onOk: () => { onClose(); router.refresh(); } });
  }
  return (
    <div className="mt-3 space-y-3">
      <PromoDatePicker label={bookingId ? "Choose the new first day" : "Choose the first day"} days={right.days} window={win} avail={avail} limits={limits} value={start} onChange={setStart} noun={noun} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={pending || !start} onClick={go}>{pending ? "Working…" : bookingId ? "Move to these days" : "Schedule these days"}</button>
        <button type="button" className={btnQuiet} onClick={onClose}>Not now</button>
      </div>
      <Notice msg={msg} />
    </div>
  );
}

/** Schedule a whole campaign: the discovery days first, then the homepage days inside them. */
function CampaignScheduler({ item, p, onClose }: { item: PromoItem; p: PromoManagerProps; onClose: () => void }) {
  const router = useRouter();
  const { pending, msg, run } = useAction();
  const d = item.discovery!, h = item.homepage!;
  const [dStart, setD] = useState<string | null>(null);
  const [hStart, setH] = useState<string | null>(null);
  const win = (days: number) => bookingWindow({ today: p.today, leadDays: p.settings.leadDays, horizonDays: p.settings.horizonDays, publishedOn: p.publishedOn, entitlementEnd: p.entitlementEnd, days });
  const dAvail = useMemo(() => availabilityMap(p.availability.discovery), [p.availability]);
  const hAvail = useMemo(() => availabilityMap(p.availability.homepage), [p.availability]);
  const limits = dStart ? { from: dStart, to: addDays(endDay(dStart, d.days), -(h.days - 1)) } : undefined;
  function pickD(s: string) { setD(s); setH(null); }
  function go() {
    if (!dStart || !hStart || !d.group_id) return;
    run(() => bookCampaign(p.organiserSlug, p.editionSlug, d.group_id!, dStart, hStart), { success: "Your campaign is scheduled.", onOk: () => { onClose(); router.refresh(); } });
  }
  return (
    <div className="mt-3 space-y-3">
      <PromoDatePicker label="1. Choose the first day of enhanced discovery" days={d.days} window={win(d.days)} avail={dAvail} value={dStart} onChange={pickD} noun="enhanced discovery" />
      {dStart && <PromoDatePicker key={dStart} label="2. Choose the first homepage day, inside those dates" days={h.days} window={win(h.days)} avail={hAvail} limits={limits} value={hStart} onChange={setH} noun="homepage featuring" />}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={pending || !dStart || !hStart} onClick={go}>{pending ? "Working…" : "Schedule this campaign"}</button>
        <button type="button" className={btnQuiet} onClick={onClose}>Not now</button>
      </div>
      <Notice msg={msg} />
    </div>
  );
}

function RightRow({ right, item, p, open, setOpen }: { right: PromoRight; item: PromoItem; p: PromoManagerProps; open: string | null; setOpen: (k: string | null) => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  const key = `${right.right_id}`;
  const editable = p.canAct && !p.scheduleBlock;
  const grouped = item.kind === "campaign";
  const disc = item.discovery;
  // Homepage days of a campaign sit inside the discovery days: unusable until those are booked, and then limited to them.
  const needsDiscovery = grouped && right.kind === "homepage" && disc && disc.status === "unused";
  const limits = grouped && right.kind === "homepage" && disc && disc.starts_on && disc.ends_on ? { from: disc.starts_on, to: addDays(disc.ends_on, -(right.days - 1)) } : undefined;
  const changeable = right.starts_on ? canChangeBooking(right.starts_on, p.today, p.settings.rescheduleNoticeDays) : false;

  async function cancel() {
    const cascade = right.kind === "discovery" && grouped && item.homepage?.status === "booked";
    if (!(await confirm({ title: "Cancel these promotion days?", body: `${rightLabel(right)}, ${right.starts_on && right.ends_on ? runText(right.starts_on, right.ends_on) : ""}. They go back to your unused promotion and you can choose new dates.${cascade ? " The homepage days of this campaign are cancelled with them." : ""}`, confirmLabel: "Cancel these days", cancelLabel: "Keep them", danger: true }))) return;
    if (right.booking_id) run(() => cancelPromotion(p.organiserSlug, p.editionSlug, right.booking_id!), { success: "Cancelled. You can choose new dates.", onOk: () => router.refresh() });
  }
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{rightLabel(right)}</p>
          {right.starts_on && right.ends_on && <p className="text-sm text-ink-soft">{runText(right.starts_on, right.ends_on)}</p>}
        </div>
        <Pill label={STATUS_LABEL[right.status]} tone={TONE[right.status]} />
      </div>
      {right.status === "unused" && (
        needsDiscovery ? <p className="mt-2 text-sm text-ink-muted">Schedule the discovery days first. The homepage days sit inside them.</p>
        : open === key ? <SingleScheduler right={right} p={p} ownRun={null} limits={limits} onClose={() => setOpen(null)} />
        : <div className="mt-2"><button type="button" className={btnSecondary} disabled={!editable} onClick={() => setOpen(key)}>Choose dates</button></div>
      )}
      {right.status === "booked" && right.booking_id && (
        open === key ? <SingleScheduler right={right} p={p} ownRun={right.starts_on && right.ends_on ? { start: right.starts_on, end: right.ends_on } : null} limits={limits} bookingId={right.booking_id} onClose={() => setOpen(null)} />
        : changeable && editable ? (
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => setOpen(key)}>Move</button>
            <button type="button" className={btnSecondary} disabled={pending} onClick={cancel}>Cancel</button>
          </div>
        ) : <p className="mt-2 text-sm text-ink-muted">{p.canAct ? `Dates can be changed up to ${p.settings.rescheduleNoticeDays} days before they start. To change them now, contact OneShetland.` : "Only an owner or administrator can change these dates."}</p>
      )}
      <Notice msg={msg} />
    </li>
  );
}

function ItemCard({ item, p }: { item: PromoItem; p: PromoManagerProps }) {
  const [open, setOpen] = useState<string | null>(null);
  const rights = [item.discovery, item.homepage].filter((r): r is PromoRight => !!r);
  const allUnused = rights.every((r) => r.status === "unused");
  const title = item.kind === "campaign" ? "Campaign" : item.kind === "homepage" ? "Homepage days" : "Enhanced discovery";
  const editable = p.canAct && !p.scheduleBlock;
  return (
    <li className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {item.kind === "campaign" && <p className="text-sm text-ink-soft">Enhanced discovery, with homepage days inside it.</p>}
      {item.kind === "campaign" && allUnused && open !== "campaign" && (
        <div className="mt-3"><button type="button" className={btnPrimary} disabled={!editable} onClick={() => setOpen("campaign")}>Schedule this campaign</button></div>
      )}
      {item.kind === "campaign" && allUnused && open === "campaign" && <CampaignScheduler item={item} p={p} onClose={() => setOpen(null)} />}
      {!(item.kind === "campaign" && allUnused && open === "campaign") && (
        <ul className="mt-2 divide-y divide-line">{rights.map((r) => <RightRow key={r.right_id} right={r} item={item} p={p} open={open} setOpen={setOpen} />)}</ul>
      )}
    </li>
  );
}

function PromotionShop({ p }: { p: PromoManagerProps }) {
  const note = p.settings.vatNote;
  if (p.promotions.length === 0) return <EmptyState>No extra promotion is on offer right now.</EmptyState>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {p.promotions.map((pk) => {
        const v = packageView(pk, { commerceOn: p.commerceOn, vatNote: note });
        const price = priceWithNote(v.priceLabel, note);
        return (
          <li key={pk.id} className="flex flex-col rounded-card border border-line bg-paper p-4 shadow-soft">
            <h3 className="font-display text-lg font-bold text-ink">{pk.name}</h3>
            <p className="mt-1 text-xl font-bold text-ink">{price.amount}{price.note && <span className="ml-2 text-sm font-normal text-ink-muted">{price.note}</span>}</p>
            {pk.description && <p className="mt-1 text-sm text-ink-soft">{pk.description}</p>}
            <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">{promoIncludesFor(pk.grants).filter((x) => x !== "Campaign reporting").map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-3">
              {!p.canAct ? <p className="text-sm text-ink-muted">Only an owner or administrator can buy promotion.</p>
                : p.buyBlock ? <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{p.buyBlock}</p>
                : v.choice !== "pay" ? <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{v.unavailableText}</p>
                : <BuyFlow organiserSlug={p.organiserSlug} editionSlug={p.editionSlug} editionTitle={p.editionTitle} pkg={pk} priceText={price.text} label={`Buy and pay ${price.amount}`}
                    confirmTitle={`Buy ${pk.name}?`} confirmBody={`${pk.name} is ${price.text}. You will be asked to pay securely on the next step, then you choose the dates.`} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The promotion page: what you hold, when it runs, and how to add more. */
export function PromoManager(p: PromoManagerProps) {
  const items = useMemo(() => groupRights(p.rights).sort((a, b) => rank(a) - rank(b)), [p.rights]);
  const base = `/organise/${p.organiserSlug}/editions/${p.editionSlug}`;
  return (
    <div className="max-w-4xl space-y-6">
      <section aria-labelledby="pm-how" className="rounded-card border border-line bg-sand/40 p-4">
        <h2 id="pm-how" className="font-display text-lg font-bold text-ink">How promotion works</h2>
        <p className="mt-1 text-sm text-ink-soft">{sharedPlacementText(p.settings)}</p>
        <p className="mt-2 text-sm text-ink-soft">Promotion never lengthens the period your package covers: the days you choose must fall inside it, and never before your Edition is approved and published. Dates are subject to availability.</p>
        {p.scheduleBlock && <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{p.scheduleBlock}</p>}
        {!p.canAct && <p role="note" className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">Only an owner or administrator can schedule or buy promotion. You can see what is booked.</p>}
      </section>

      <section aria-labelledby="pm-mine">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pm-mine" className="font-display text-xl font-bold text-ink">Your promotion</h2>
          {p.hasBookings && <Link href={`${base}/promote/report`} className={btnSecondary}>See the campaign report</Link>}
        </div>
        {items.length === 0 ? <div className="mt-3"><EmptyState>You do not hold any promotion for this Edition yet. You can add some below.</EmptyState></div>
          : <ul className="mt-3 grid gap-4">{items.map((it) => <ItemCard key={it.key} item={it} p={p} />)}</ul>}
      </section>

      <section aria-labelledby="pm-buy">
        <h2 id="pm-buy" className="font-display text-xl font-bold text-ink">Add more promotion</h2>
        <p className="mt-1 text-sm text-ink-soft">Optional. Bought once, then you choose the dates.</p>
        <div className="mt-3"><PromotionShop p={p} /></div>
      </section>
      <p className="text-xs text-ink-muted">Today is {dayTextShort(p.today)} (UK time).</p>
    </div>
  );
}

/** Unused first, then scheduled (soonest first), then done. */
function rank(i: PromoItem): number {
  const rs = [i.discovery, i.homepage].filter((r): r is PromoRight => !!r);
  if (rs.some((r) => r.status === "unused")) return 0;
  if (rs.some((r) => r.status === "booked")) return 1;
  return 2;
}
