"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResultStep } from "./ResultStep";
import type { BatchDetail } from "./shared";

/**
 * A finished import, reopened from its own address. Everything shown comes from the database through the same
 * endpoint the importer uses, so it is the same on any browser, after any amount of navigating away.
 */
export function BatchResultView({ businessId, batchId, canPublish }: { businessId: string; batchId: string; canPublish: boolean }) {
  const router = useRouter();
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`/api/business/${businessId}/product-import/batches/${batchId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) setErr((data as { error?: string }).error ?? "Couldn't load this import.");
        else { setDetail(data as BatchDetail); setErr(null); }
      })
      .catch(() => { if (live) setErr("Couldn't reach OneShetland. Check your connection and try again."); });
    return () => { live = false; };
  }, [businessId, batchId, tick]);
  const reload = async () => { setTick((t) => t + 1); };

  if (err) {
    return (
      <p role="alert" className="rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
        {err} <button onClick={() => void reload()} className="ml-1 underline underline-offset-2">Try again</button>
      </p>
    );
  }
  if (!detail) return <p role="status" className="text-sm text-ink-muted">Loading this import…</p>;

  const { batch } = detail;
  if (batch.status === "queued" || batch.status === "applying") {
    return (
      <div className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-bold">This import didn&rsquo;t finish.</p>
        <p className="mt-1">Your progress is saved. Open the importer and choose “Carry on” to finish it.</p>
        <Link href={`/business/${businessId}/manage/products/import`} className="mt-3 inline-block rounded-pill border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">Go to the importer →</Link>
      </div>
    );
  }
  return (
    <ResultStep businessId={businessId} detail={detail} canPublish={canPublish} onChanged={reload}
      onNewImport={() => router.push(`/business/${businessId}/manage/products/import`)} />
  );
}
