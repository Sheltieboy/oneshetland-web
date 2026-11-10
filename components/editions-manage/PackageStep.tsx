"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimFreePackage, createPackageOrder } from "@/app/organise/commerce-actions";
import { dayLabel, packageView, type PackageView } from "@/lib/editions/journey";
import type { Pkg } from "@/lib/editions/commerce";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, Notice, Pill, btnPrimary, btnSecondary } from "./kit";
import { useAction } from "./use-action";
import { PayButton } from "./PayButton";

/** What a package includes, in plain words. Shared by the choose step and the organiser-level overview. */
export function PackageCardBody({ v }: { v: PackageView }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl font-bold text-ink">{v.name}</h3>
        {v.community && <Pill label={v.communityLabel ?? "Community rate"} tone="purple" />}
      </div>
      <p className="mt-1 text-2xl font-bold text-ink">{v.priceLabel}</p>
      <p className="text-sm text-ink-muted">Covers your Edition for {v.durationLabel}</p>
      {v.description && <p className="mt-2 text-sm text-ink-soft">{v.description}</p>}
      <ul className="mt-3 list-disc pl-5 text-sm text-ink-soft">{v.includes.map((f) => <li key={f}>{f}</li>)}</ul>
    </>
  );
}

function ChoiceCard({ organiserSlug, editionSlug, editionTitle, pkg, commerceOn, canChoose }: { organiserSlug: string; editionSlug: string; editionTitle: string; pkg: Pkg; commerceOn: boolean; canChoose: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const v = packageView(pkg, { commerceOn });
  const { pending, msg, run } = useAction();
  const attempt = useAttemptId(`${editionSlug}:${pkg.id}`);
  const [order, setOrder] = useState<string | null>(null);

  async function claim() {
    if (!(await confirm({ title: `Choose the ${v.name} package?`, body: `It is free and covers ${editionTitle} for ${v.durationLabel}. You can publish straight afterwards.`, confirmLabel: "Choose this package" }))) return;
    run(() => claimFreePackage(organiserSlug, editionSlug, pkg.id, attempt()), { success: "Package chosen. You can publish now.", onOk: () => router.push(`/organise/${organiserSlug}/editions/${editionSlug}`) });
  }
  function pay() {
    run(() => createPackageOrder(organiserSlug, editionSlug, pkg.id, attempt()), { onOk: (r) => setOrder((r as unknown as { orderId: string }).orderId) });
  }

  return (
    <li className="flex flex-col rounded-card border border-line bg-paper p-5 shadow-soft">
      <PackageCardBody v={v} />
      <div className="mt-4 space-y-2">
        {canChoose && v.choice === "claim" && <button type="button" className={btnPrimary} disabled={pending} onClick={claim}>{pending ? "Working…" : "Choose this free package"}</button>}
        {canChoose && v.choice === "pay" && !order && <button type="button" className={btnPrimary} disabled={pending} onClick={pay}>{pending ? "Working…" : `Choose and pay ${v.priceLabel}`}</button>}
        {canChoose && v.choice === "unavailable" && <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{v.unavailableText} Free packages can still be chosen.</p>}
        {order && (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-sm text-ink-soft">{v.priceLabel} for {editionTitle}.</p>
            <PayButton kind="order" id={order} label={`Pay ${v.priceLabel}`} amountPence={pkg.price_pence} />
            <button type="button" className="ml-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-navy hover:underline" onClick={() => { setOrder(null); router.refresh(); }}>Done</button>
          </div>
        )}
        <Notice msg={msg} />
      </div>
    </li>
  );
}

/**
 * The package step of an Edition's journey. Before approval it only explains; after approval an owner or administrator chooses: a free package is claimed with no payment,
 * a paid one goes through the existing secure payment flow (only while online payment is switched on). Once a package is active it says until when.
 */
export function PackageStep({ organiserSlug, editionSlug, editionTitle, approved, packages, commerceOn, canChoose, activeUntilIso, published }: {
  organiserSlug: string; editionSlug: string; editionTitle: string; approved: boolean; packages: Pkg[]; commerceOn: boolean; canChoose: boolean; activeUntilIso: string | null; published: boolean;
}) {
  const root = `/organise/${organiserSlug}/editions/${editionSlug}`;
  if (activeUntilIso) {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-900">Package active until {dayLabel(activeUntilIso)}</p>
        <p className="text-sm text-ink-soft">{published ? "Your Edition is live." : "Your Edition has what it needs. Press Publish on the overview when you are ready."}</p>
        <Link href={root} className={btnSecondary}>Back to the overview</Link>
      </div>
    );
  }
  if (!approved) {
    return (
      <div className="space-y-4">
        <p role="note" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">You can choose a package once OneShetland has approved your Edition. Here is what is on offer, so nothing is a surprise.</p>
        <ul className="grid gap-4 sm:grid-cols-2">{packages.map((p) => { const v = packageView(p, { commerceOn }); return <li key={p.id} className="rounded-card border border-line bg-paper p-5 shadow-soft"><PackageCardBody v={v} /></li>; })}</ul>
        <Link href={root} className={btnSecondary}>Back to the overview</Link>
      </div>
    );
  }
  if (packages.length === 0) return <EmptyState>No packages are available for this Edition right now.</EmptyState>;
  return (
    <div className="space-y-4">
      {!canChoose && <p role="note" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">Only an owner or administrator can choose a package.</p>}
      <ul className="grid gap-4 sm:grid-cols-2">{packages.map((p) => <ChoiceCard key={p.id} organiserSlug={organiserSlug} editionSlug={editionSlug} editionTitle={editionTitle} pkg={p} commerceOn={commerceOn} canChoose={canChoose} />)}</ul>
    </div>
  );
}
