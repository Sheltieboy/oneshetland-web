"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPackageOrder } from "@/app/organise/commerce-actions";
import { pounds, type Pkg } from "@/lib/editions/commerce";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Notice, btnPrimary } from "@/components/editions-manage/kit";
import { useAction } from "@/components/editions-manage/use-action";
import { PayButton } from "@/components/editions-manage/PayButton";

/**
 * Buy one package or promotion: ask first, create the order (the amount comes from the database row, never from here), then hand over to the existing secure payment button.
 * One primary action. Pressing twice is the same attempt.
 */
export function BuyFlow({ organiserSlug, editionSlug, editionTitle, pkg, priceText, label, confirmTitle, confirmBody }: {
  organiserSlug: string; editionSlug: string; editionTitle: string; pkg: Pkg; priceText: string; label: string; confirmTitle: string; confirmBody: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, msg, run } = useAction();
  const attempt = useAttemptId(`${editionSlug}:${pkg.id}`);
  const [order, setOrder] = useState<string | null>(null);

  async function start() {
    if (!(await confirm({ title: confirmTitle, body: confirmBody, confirmLabel: "Continue to payment" }))) return;
    run(() => createPackageOrder(organiserSlug, editionSlug, pkg.id, attempt()), { onOk: (r) => setOrder((r as unknown as { orderId: string }).orderId) });
  }
  return (
    <div className="space-y-2">
      {!order && <button type="button" className={btnPrimary + " w-full sm:w-auto"} disabled={pending} onClick={start}>{pending ? "Working…" : label}</button>}
      {order && (
        <div className="rounded-xl border border-line p-3">
          <p className="mb-2 text-sm text-ink-soft">{priceText} for {editionTitle}.</p>
          <PayButton kind="order" id={order} label={`Pay ${pounds(pkg.price_pence)}`} amountPence={pkg.price_pence} />
          <button type="button" className="ml-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-navy hover:underline" onClick={() => { setOrder(null); router.refresh(); }}>Done</button>
        </div>
      )}
      <Notice msg={msg} />
    </div>
  );
}
