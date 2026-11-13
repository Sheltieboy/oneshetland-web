"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAdvert, setAdvertStatus } from "@/app/house-swaps/actions";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { createClient } from "@/lib/supabase/client";
import { btnDanger, btnPrimary, btnSecondary } from "./Shell";

/** Pause / Resume / Withdraw / "Confirm it's still available" for the member's advert. Withdraw asks first, in an on-brand dialog. */
export function StatusControls({ status, emphasiseConfirm, canConfirm = true, photoPaths = [] }: { photoPaths?: string[]; status: "active" | "paused"; emphasiseConfirm: boolean; canConfirm?: boolean }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (fn: () => Promise<{ status: string; message?: string }>) => start(async () => {
    const r = await fn();
    setMsg({ ok: r.status === "ok", text: r.message ?? "" });
    if (r.status === "ok") router.refresh();
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canConfirm && <button type="button" disabled={pending} onClick={() => run(confirmAdvert)} className={emphasiseConfirm ? btnPrimary : btnSecondary}>Confirm it&apos;s still available</button>}
        {status === "active"
          ? <button type="button" disabled={pending} onClick={() => run(() => setAdvertStatus("paused"))} className={btnSecondary}>Pause advert</button>
          : <button type="button" disabled={pending} onClick={() => run(() => setAdvertStatus("active"))} className={btnPrimary}>Resume advert</button>}
        <button type="button" disabled={pending} className={btnDanger} onClick={async () => {
          const yes = await confirm({ title: "Withdraw your advert?", body: "Your advert will be taken down and any open conversations will be closed. You can create a new advert any time.", confirmLabel: "Withdraw advert", cancelLabel: "Keep it", danger: true });
          if (yes) run(async () => {
            const r = await setAdvertStatus("withdrawn");
            // A withdrawn advert should not leave its photo files lying around in public storage (best effort: the member owns their folder).
            if (r.status === "ok" && photoPaths.length) await createClient().storage.from("house-swap-photos").remove(photoPaths).catch(() => undefined);
            return r;
          });
        }}>Withdraw advert</button>
      </div>
      <div aria-live="polite" role="status">{msg && <p className={"mt-3 rounded-lg px-3 py-2 text-sm font-semibold " + (msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>{msg.text}</p>}</div>
    </div>
  );
}
