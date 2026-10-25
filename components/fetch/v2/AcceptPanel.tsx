"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptAction, photoViewAction } from "@/app/fetch/actions";
import { FETCH_ACCENT, Notice, btnPrimary, btnQuiet } from "@/components/fetch/v2/ui";

/** Accepting a Fetch from the board. Large and bulky items need the fit confirmed. The server decides; its answer is shown in words. */
export function AcceptPanel({ id, needsFit, canClaim, photoIds }: { id: string; needsFit: boolean; canClaim: boolean; photoIds: string[] }) {
  const router = useRouter();
  const [fit, setFit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "error"; text: React.ReactNode } | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    setBusy(true); setMsg(null);
    const r = await acceptAction(id, needsFit ? fit : true).catch(() => null);
    setBusy(false);
    if (!r) { setMsg({ tone: "error", text: "We couldn't reach OneShetland. Please try again — you won't accept it twice." }); return; }
    if (!r.ok) {
      const fix = r.code === "driver_payouts_not_enabled" ? <> <Link href="/account/payments" className="font-semibold underline">Set up payouts</Link></>
        : r.code.startsWith("driver_verification") ? <> <Link href="/fetch/driver/verification" className="font-semibold underline">Your documents</Link></> : null;
      setMsg({ tone: "error", text: <>{r.message}{fix}</> });
      if (r.code === "already_taken" || r.code === "not_claimable") router.refresh();
      return;
    }
    setDone(true);
    setMsg(r.data.can_collect
      ? { tone: "ok", text: "It's yours. The payment is confirmed — you can collect the item." }
      : r.data.payment === "requires_action" || r.data.payment === "requires_payment_method"
        ? { tone: "warn", text: "It's yours. The requester needs to confirm the payment with their bank first — please don't collect until the job says it's ready. If they don't in time, the job is released and you're told." }
        : { tone: "warn", text: "It's yours. We're confirming the requester's payment — please don't collect until the job says it's ready." });
    router.push(`/fetch/jobs/${id}`);
  }
  async function view(photo: string) {
    const r = await photoViewAction(photo, true).catch(() => null);
    if (r?.ok) window.open(r.data.url, "_blank", "noopener,noreferrer"); else setMsg({ tone: "error", text: r?.message ?? "We couldn't open that photo." });
  }

  return (
    <div className="space-y-3">
      {photoIds.length > 0 && <p className="text-sm">{photoIds.map((p, i) => <button key={p} type="button" onClick={() => view(p)} className={btnQuiet}>View photo {photoIds.length > 1 ? i + 1 : ""}</button>)}</p>}
      {needsFit && (
        <label className="flex items-start gap-2 rounded-card border border-line p-3 text-sm text-ink">
          <input type="checkbox" checked={fit} onChange={(e) => setFit(e.target.checked)} className="mt-1" />
          I&apos;ve checked the item details and it will fit in my vehicle.
        </label>
      )}
      <p className="text-xs text-ink-muted">Accepting means you&apos;ll collect and deliver it. The exact addresses are shown once you accept.</p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!done && <button type="button" onClick={accept} disabled={busy || !canClaim || (needsFit && !fit)} className={btnPrimary} style={{ background: FETCH_ACCENT }}>{busy ? "Accepting…" : "Accept this Fetch"}</button>}
    </div>
  );
}
