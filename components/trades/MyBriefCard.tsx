"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { closeBrief, shareContactWithTrade } from "@/lib/trades-actions";

/**
 * One posted job, and what came back from it.
 *
 * A decline is shown, with its reason, rather than quietly dropped. Eleven
 * "booked up" replies is a real answer — it tells somebody to stop waiting and
 * widen their search today, and it's the evidence behind the waiting list.
 * Hiding it would only make the page look tidier.
 */

const OUTCOMES: { key: "via_oneshetland" | "elsewhere" | "no_longer_needed" | "gave_up"; label: string }[] = [
  { key: "via_oneshetland",  label: "Sorted — through OneShetland" },
  { key: "elsewhere",        label: "Sorted — found someone elsewhere" },
  { key: "no_longer_needed", label: "Don't need it now" },
  { key: "gave_up",          label: "Gave up looking" },
];

const DECLINE_LABEL: Record<string, string> = {
  booked_up: "booked up",
  too_small: "job too small",
  too_far: "too far",
  wrong_trade: "not their trade",
  other: "can't take it on",
};

export function MyBriefCard({
  brief,
  responses,
}: {
  brief: { id: string; title: string; trades: string[]; location: string; status: string; outcome: string | null; createdAt: string };
  responses: { id: string; status: string; declineReason: string | null; businessName: string; businessSlug: string | null; businessPhone: string | null; contactShared?: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState(brief.status);
  const [shared, setShared] = useState<Set<string>>(
    () => new Set(responses.filter((r) => r.contactShared).map((r) => r.id)),
  );
  const [shareError, setShareError] = useState<string | null>(null);

  const interested = responses.filter((r) => r.status === "interested");
  const declined = responses.filter((r) => r.status === "declined");
  const waiting = responses.filter((r) => r.status === "sent" || r.status === "viewed");

  return (
    <article className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{brief.title}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {brief.trades.join(" · ")} · {brief.location}
          </p>
        </div>
        {status !== "open" && (
          <span className="shrink-0 rounded-pill bg-sand px-2.5 py-1 text-xs font-bold text-ink-soft">
            {status === "sorted" ? "Sorted" : "Closed"}
          </span>
        )}
      </div>

      {responses.length > 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          Told {responses.length} {responses.length === 1 ? "trade" : "trades"}.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {interested.map((r) => (
          <div key={r.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="font-semibold text-emerald-900">
              {r.businessSlug
                ? <Link href={`/directory/${r.businessSlug}`} className="underline">{r.businessName}</Link>
                : r.businessName}{" "}
              is interested
            </p>
            {r.businessPhone && (
              <a href={`tel:${r.businessPhone}`} className="mt-1 inline-block font-bold text-emerald-800 underline">
                {r.businessPhone}
              </a>
            )}
            {shared.has(r.id) ? (
              <p className="mt-2 text-sm font-semibold text-emerald-900">Shared with {r.businessName}</p>
            ) : status === "open" ? (
              <div className="mt-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setShareError(null);
                      const res = await shareContactWithTrade(r.id);
                      if (res.ok) setShared((p) => new Set(p).add(r.id));
                      else setShareError(res.error ?? "Couldn't share your details.");
                    })
                  }
                  className="rounded-pill bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Share my details with {r.businessName}
                </button>
                <p className="mt-1 text-xs text-emerald-900">Only this trade will see your name, phone and email.</p>
              </div>
            ) : null}
          </div>
        ))}
        {shareError && <p className="text-sm font-medium text-rose-700">{shareError}</p>}

        {[...waiting, ...declined].map((r) => (
          <p key={r.id} className="text-sm text-ink-muted">
            {r.businessSlug
              ? <Link href={`/directory/${r.businessSlug}`} className="font-semibold underline">{r.businessName}</Link>
              : <span className="font-semibold">{r.businessName}</span>}
            {" — "}
            {r.status === "declined"
              ? <>Not available{r.declineReason ? ` (${DECLINE_LABEL[r.declineReason] ?? DECLINE_LABEL.other})` : ""}</>
              : "Waiting to hear"}
          </p>
        ))}

        {responses.length === 0 && (
          <p className="text-sm text-ink-muted">
            No trade has been told about this job. It&apos;s counted in the waiting list, which is
            what we use to get more trades signed up.
          </p>
        )}
      </div>

      {status === "open" && (
        <div className="mt-4 border-t border-line pt-3">
          {!closing ? (
            <button onClick={() => setClosing(true)} className="text-sm font-semibold text-ink-soft underline">
              Mark this as done
            </button>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink">How did it end?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.key}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await closeBrief(brief.id, o.key);
                        if (res.ok) { setStatus("sorted"); setClosing(false); }
                      })
                    }
                    className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand disabled:opacity-50"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
