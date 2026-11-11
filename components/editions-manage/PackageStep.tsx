"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimFreePackage } from "@/app/organise/commerce-actions";
import { dayLabel, liveUntilText, packageView, renewalState, type PackageView } from "@/lib/editions/journey";
import { priceWithNote } from "@/lib/editions/promo";
import type { Pkg } from "@/lib/editions/commerce";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { BuyFlow } from "@/components/editions-commerce/BuyFlow";
import { EmptyState, Notice, btnPrimary, btnSecondary } from "./kit";
import { useAction } from "./use-action";

/** The price as an amount, then the configured note (nothing at all when there is no note). No tax is worked out here. */
export function PriceLine({ v }: { v: Pick<PackageView, "priceLabel" | "priceNote"> }) {
  const p = priceWithNote(v.priceLabel, v.priceNote);
  return <p className="mt-1 text-2xl font-bold text-ink">{p.amount}{p.note && <span className="ml-2 text-sm font-normal text-ink-muted">{p.note}</span>}</p>;
}

/** What a package includes, in plain words. Shared by the choose step and the organiser-level overview. */
export function PackageCardBody({ v }: { v: PackageView }) {
  return (
    <>
      <h3 className="font-display text-xl font-bold text-ink">{v.name}</h3>
      <PriceLine v={v} />
      <p className="text-sm text-ink-muted">Covers your Edition for {v.durationLabel}</p>
      {v.description && <p className="mt-2 text-sm text-ink-soft">{v.description}</p>}
      <p className="mt-3 text-sm font-semibold text-ink">Everything you need to run it</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{v.includes.map((f) => <li key={f}>{f}</li>)}</ul>
      {v.promoIncludes.length > 0 && (
        <>
          <p className="mt-3 text-sm font-semibold text-ink">Plus promotion</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">{v.promoIncludes.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
    </>
  );
}

/** One plain sentence that makes the comparison honest: every package runs an Edition fully; the difference is promotion. */
export function ComparisonNote({ packages }: { packages: Pkg[] }) {
  if (packages.length < 2) return null;
  return <p className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">Every package includes all of the features below, so you can run your Edition in full. Where packages differ is promotion: the days you can feature your Edition to more people, and the report that shows how it went. Featured places are shared and clearly labelled Promoted.</p>;
}

function ChoiceCard({ organiserSlug, editionSlug, editionTitle, pkg, commerceOn, canChoose, vatNote }: { organiserSlug: string; editionSlug: string; editionTitle: string; pkg: Pkg; commerceOn: boolean; canChoose: boolean; vatNote: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const v = packageView(pkg, { commerceOn, vatNote });
  const { pending, msg, run } = useAction();
  const attempt = useAttemptId(`${editionSlug}:${pkg.id}:free`);

  async function claim() {
    if (!(await confirm({ title: `Choose the ${v.name} package?`, body: `It is free and covers ${editionTitle} for ${v.durationLabel}. You can publish straight afterwards.`, confirmLabel: "Choose this package" }))) return;
    run(() => claimFreePackage(organiserSlug, editionSlug, pkg.id, attempt()), { success: "Package chosen. You can publish now.", onOk: () => router.push(`/organise/${organiserSlug}/editions/${editionSlug}`) });
  }
  const price = priceWithNote(v.priceLabel, vatNote).text;
  return (
    <li className="flex flex-col rounded-card border border-line bg-paper p-5 shadow-soft">
      <PackageCardBody v={v} />
      <div className="mt-4 space-y-2">
        {canChoose && v.choice === "claim" && <button type="button" className={btnPrimary} disabled={pending} onClick={claim}>{pending ? "Working…" : "Choose this free package"}</button>}
        {canChoose && v.choice === "pay" && (
          <BuyFlow organiserSlug={organiserSlug} editionSlug={editionSlug} editionTitle={editionTitle} pkg={pkg} priceText={price} label={`Choose ${v.name} and pay`}
            confirmTitle={`Choose the ${v.name} package?`} confirmBody={`${v.name} is ${price} and covers ${editionTitle} for ${v.durationLabel}. You will be asked to pay securely on the next step.`} />
        )}
        {canChoose && v.choice === "unavailable" && <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{v.unavailableText}</p>}
        <Notice msg={msg} />
      </div>
    </li>
  );
}

/**
 * The package step of an Edition's journey. Before approval it only explains. After approval an owner or administrator chooses: a free package (only if one is on offer) is claimed with no payment,
 * a paid one goes through the existing secure payment flow (only while online payment is switched on). A package is refused while the Edition is live, except renewal in the last days of its period.
 */
export function PackageStep({ organiserSlug, editionSlug, editionTitle, approved, packages, commerceOn, canChoose, activeUntilIso, published, vatNote = "", renewalWindowDays = 30 }: {
  organiserSlug: string; editionSlug: string; editionTitle: string; approved: boolean; packages: Pkg[]; commerceOn: boolean; canChoose: boolean; activeUntilIso: string | null; published: boolean;
  vatNote?: string; renewalWindowDays?: number;
}) {
  const root = `/organise/${organiserSlug}/editions/${editionSlug}`;
  const [renewing, setRenewing] = useState(false);
  const rs = renewalState(activeUntilIso, renewalWindowDays);
  if (activeUntilIso && !(renewing && rs.renewable)) {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-900">{liveUntilText(activeUntilIso, renewalWindowDays)}</p>
        <p className="text-sm text-ink-soft">{published ? "Your Edition is live." : `Your package runs until ${dayLabel(activeUntilIso)}. Press Publish on the overview when you are ready.`}</p>
        <div className="flex flex-wrap gap-3">
          {rs.renewable && canChoose && approved && <button type="button" className={btnPrimary} onClick={() => setRenewing(true)}>Renew your package</button>}
          <Link href={root} className={btnSecondary}>Back to the overview</Link>
        </div>
      </div>
    );
  }
  if (!approved) {
    return (
      <div className="space-y-4">
        <p role="note" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">You can choose a package once OneShetland has approved your Edition. Here is what is on offer, so nothing is a surprise.</p>
        <ComparisonNote packages={packages} />
        <ul className="grid gap-4 sm:grid-cols-2">{packages.map((p) => <li key={p.id} className="rounded-card border border-line bg-paper p-5 shadow-soft"><PackageCardBody v={packageView(p, { commerceOn, vatNote })} /></li>)}</ul>
        <Link href={root} className={btnSecondary}>Back to the overview</Link>
      </div>
    );
  }
  if (packages.length === 0) return <EmptyState>No packages are available for this Edition right now.</EmptyState>;
  return (
    <div className="space-y-4">
      {!canChoose && <p role="note" className="rounded-xl bg-sand px-4 py-3 text-sm text-ink-soft">Only an owner or administrator can choose a package.</p>}
      <ComparisonNote packages={packages} />
      <ul className="grid gap-4 sm:grid-cols-2">{packages.map((p) => <ChoiceCard key={p.id} organiserSlug={organiserSlug} editionSlug={editionSlug} editionTitle={editionTitle} pkg={p} commerceOn={commerceOn} canChoose={canChoose} vatNote={vatNote} />)}</ul>
    </div>
  );
}
