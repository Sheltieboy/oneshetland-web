"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  subscription_tier: "free" | "pro" | "premium";
  subscription_until: string | null;
  nfc_status: "none" | "requested" | "dispatched" | "active";
  nfc_token: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  requested:  "bg-amber-100 text-amber-900",
  dispatched: "bg-sky-100 text-sky-900",
  active:     "bg-emerald-100 text-emerald-900",
};

/**
 * Yearly Premium includes a posted NFC tile, so a business paying £290 upfront
 * is owed a physical object. Surfaced here rather than inferred, because the
 * renewal date is the only signal and nobody would think to check it.
 */
function isAnnual(r: Row): boolean {
  return r.subscription_tier === "premium"
    && !!r.subscription_until
    && new Date(r.subscription_until).getTime() - Date.now() > 90 * 86_400_000;
}

export function NfcQueue({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, nfc_status: Row["nfc_status"]) {
    setBusy(id); setError(null);
    try {
      const sb = createClient();
      const { error } = await sb.from("local_businesses").update({ nfc_status }).eq("id", id);
      if (error) throw error;
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-card border border-line bg-paper p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/directory/${r.slug || r.id}`} className="font-display text-lg font-bold text-ink hover:underline">{r.name}</Link>
                <span className={"rounded-pill px-2.5 py-0.5 text-xs font-bold capitalize " + (STATUS_STYLE[r.nfc_status] ?? "bg-sand text-ink-muted")}>{r.nfc_status}</span>
                {isAnnual(r) && <span className="rounded-pill bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-900">Yearly — tile included</span>}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{r.address || <span className="text-ink-faint">No address on file — ask before posting</span>}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {[r.email, r.phone].filter(Boolean).join(" · ") || <span className="text-ink-faint">No contact details</span>}
              </p>
              {r.nfc_token && <p className="mt-1 font-mono text-xs text-ink-faint">Token {r.nfc_token}</p>}
            </div>

            <div className="flex shrink-0 gap-2">
              {r.nfc_status === "requested" && (
                <button onClick={() => setStatus(r.id, "dispatched")} disabled={busy === r.id}
                  className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
                  {busy === r.id ? "…" : "Mark posted"}
                </button>
              )}
              {r.nfc_status === "dispatched" && (
                <button onClick={() => setStatus(r.id, "requested")} disabled={busy === r.id}
                  className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand disabled:opacity-40">
                  {busy === r.id ? "…" : "Not posted after all"}
                </button>
              )}
            </div>
          </div>

          {r.nfc_status === "dispatched" && (
            <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-xs text-ink-muted">
              Posted. It becomes <strong>active</strong> on its own the first time somebody taps it with the app — you don&apos;t need to do anything else here.
            </p>
          )}
          {r.nfc_status === "requested" && !r.address && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No address on file, so this one can&apos;t be posted yet. Get in touch before marking it sent.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
