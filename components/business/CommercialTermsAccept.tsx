"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BIZ = "#0f766e";

/**
 * The one place a business accepts the commercial terms.
 *
 * Owning a Directory listing does not make anybody a seller — a business is
 * welcome to keep its opening hours right without ever selling anything. This
 * appears only when the owner opens a screen that takes money, bookings or
 * commitments, and once for the whole business rather than once per feature.
 *
 * ── What the browser is trusted with ─────────────────────────────────────
 *
 * Nothing. The call carries ONE argument: the business id. The user comes from
 * auth.uid() inside the function, the version is held on the server, and the
 * event type is a literal in its body — there are no parameters for any of
 * them. Direct insertion of the acceptance event is refused by policy, so this
 * route is the only one there is.
 *
 * And the result is not believed on the client's word: on success the page is
 * refreshed so the server re-reads the status. An optimistic unlock would be a
 * screen deciding it had permission.
 */
export function CommercialTermsAccept({
  businessId,
  businessName,
  feature,
  statusUnavailable = false,
}: {
  businessId: string;
  businessName: string;
  /** The screen they were trying to open, e.g. "Products". */
  feature: string;
  /** True when the server could not read the acceptance status at all. */
  statusUnavailable?: boolean;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      // One argument. Deliberately no user id, event type, version or metadata.
      const { error: rpcErr } = await sb.rpc("record_commercial_terms_acceptance", {
        p_business_id: businessId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      // Re-read rather than assume: the server decides whether this screen opens.
      router.refresh();
      // Not an unlock — only so the button is usable again if the refresh comes
      // back still showing this screen.
      setBusy(false);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error && /own this business/i.test(e.message)
          ? "You no longer manage this business, so it can't be accepted from here."
          : "We couldn't record that just now. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <div className="rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BIZ }}>
          Before you start selling
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">
          Accept the business &amp; selling terms
        </h1>

        <p className="mt-3 text-ink-soft">
          <span className="font-semibold text-ink">{businessName}</span> is about to use
          OneShetland&rsquo;s commercial features — {feature.toLowerCase()} is one of them.
          Managing your Directory listing didn&rsquo;t need this; selling, taking bookings and
          accepting payments do.
        </p>

        <p className="mt-3 text-ink-soft">
          Please read{" "}
          <Link
            href="/terms#commercial"
            target="_blank"
            className="font-semibold text-ink underline underline-offset-2"
          >
            section 11 of our Terms — Businesses &amp; selling on OneShetland
          </Link>
          . It covers what you&rsquo;re responsible for as the seller: accurate listings,
          fulfilling what you offer, cancellations and refunds, your own tax, and dealing with
          customer questions.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-sand/40 p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-teal"
          />
          <span className="text-sm text-ink">
            I&rsquo;m authorised to act for {businessName}, and I accept the Businesses &amp;
            selling on OneShetland terms for this business.
          </span>
        </label>

        <button
          onClick={() => void accept()}
          disabled={!agreed || busy}
          className="mt-5 w-full rounded-pill px-6 py-3 font-semibold text-paper shadow-soft transition hover:brightness-110 disabled:opacity-40"
          style={{ background: BIZ }}
        >
          {busy ? "Recording…" : "Accept and continue"}
        </button>

        {statusUnavailable && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            We couldn&rsquo;t check whether you&rsquo;ve already accepted these terms. Accepting
            again is safe — it won&rsquo;t create a second record.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <p className="mt-5 text-sm text-ink-muted">
          This applies to this business and the current version of the terms. Your Directory
          listing is unaffected —{" "}
          <Link href={`/business/${businessId}/manage`} className="font-semibold text-ink underline">
            back to the dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
