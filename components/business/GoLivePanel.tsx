"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { goLiveAction } from "@/app/business/[id]/manage/launch-setup/actions";
import { runGuarded } from "@/lib/launch-partners/invitation-replace";

/**
 * The owner's explicit go-live step. Never automatic: it appears only after they approved their setup, asks for confirmation, and the database
 * publishes only that approved version. A repeat click is harmless (the database reports "already live").
 */
export function GoLivePanel({ businessId, publicHref, live, waiting }: { businessId: string; publicHref: string; /** Already live (this panel then offers only the link). */ live: boolean; /** Live, but a newer approval has not been published yet. */ waiting: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go() {
    const ok = await confirm({
      title: "Go live with this setup?",
      body: "This will make your approved OneShetland business page public. You can continue editing your business afterwards.\n\nProducts, services, offers and other optional features are not required and will only appear if you add them.",
      confirmLabel: "Go live on OneShetland",
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    const g = await runGuarded(() => goLiveAction(businessId), 60_000);
    setBusy(false);
    if (!g.ok) { setMsg({ ok: false, text: g.error }); router.refresh(); return; }
    if (!g.value.ok) { setMsg({ ok: false, text: g.value.error }); router.refresh(); return; }
    router.refresh();
  }

  if (live && !waiting) {
    return (
      <section id="go-live" aria-labelledby="go-live-h" className="rounded-card border-2 border-emerald-300 bg-emerald-50 p-5 shadow-soft">
        <h2 id="go-live-h" className="font-display text-xl font-bold text-ink">You’re live on OneShetland ✓</h2>
        <p className="mt-1 text-sm text-ink-soft">Your approved page is public. You can keep improving your business any time.</p>
        <Link href={publicHref} className="mt-3 inline-block rounded-pill bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-95">View my page</Link>
      </section>
    );
  }
  return (
    <section id="go-live" aria-labelledby="go-live-h" className="rounded-card border-2 border-violet-300 bg-violet-50 p-5 shadow-soft">
      <h2 id="go-live-h" className="font-display text-xl font-bold text-ink">{waiting ? "Your latest approval is ready to publish" : "Your setup is approved"}</h2>
      <p className="mt-1 text-sm text-ink-soft">Everything is ready. Going live will make your approved OneShetland business page public. You decide when — nothing goes public until you press the button.</p>
      <button type="button" onClick={go} disabled={busy} className="mt-3 rounded-pill bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50">{busy ? "Going live…" : "Go live on OneShetland"}</button>
      {msg && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{msg.text}</p>}
    </section>
  );
}
