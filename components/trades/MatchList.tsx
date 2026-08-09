"use client";

import Link from "next/link";
import { AVAILABILITY_LABEL, CREDENTIAL_LABEL, CREDENTIALS_DISCLAIMER } from "@/lib/trades";
import { type TradeMatch } from "@/lib/trades-data";

/**
 * Who could actually take this on — shown live, while the job is being
 * described.
 *
 * The empty state matters as much as the full one. "Nobody has said they have
 * room" is a disappointing answer and the right one: it's what people in
 * Shetland find out after three unreturned calls, and finding it out in ten
 * seconds instead is the whole point. So it never says "we'll find someone".
 */

const TONE: Record<string, string> = {
  now: "bg-emerald-100 text-emerald-800",
  weeks: "bg-emerald-100 text-emerald-800",
  months: "bg-amber-100 text-amber-800",
  emergency: "bg-amber-100 text-amber-800",
};

export function MatchList({
  matches,
  loading,
  trades,
}: {
  matches: TradeMatch[] | null;
  loading: boolean;
  trades: string[];
}) {
  if (matches === null && !loading) {
    return (
      <Panel>
        <p className="text-sm text-ink-muted">
          Pick a trade and we&apos;ll show you who has room, before you send anything.
        </p>
      </Panel>
    );
  }

  if (loading && !matches) {
    return <Panel><p className="text-sm text-ink-muted">Looking…</p></Panel>;
  }

  const withRoom = (matches ?? []).filter((m) => m.availability === "now" || m.availability === "weeks");

  return (
    <Panel>
      <p className="font-display text-lg font-bold text-ink">
        {matches!.length === 0
          ? "Nobody yet"
          : `${matches!.length} could take this on`}
      </p>
      {matches!.length > 0 && (
        <p className="mt-0.5 text-sm text-ink-muted">
          {withRoom.length > 0
            ? `${withRoom.length} with room in the next few weeks.`
            : "None with room right now — they'll still see it."}
        </p>
      )}

      {matches!.length === 0 && (
        <div className="mt-2 space-y-2 text-sm text-ink-soft">
          <p>
            No {trades.length ? trades.join(" or ").toLowerCase() : "trade"} on OneShetland
            has said they can take work on.
          </p>
          <p>
            Post it anyway. Every unanswered job goes into the waiting list, and that list
            is what we show trades who aren&apos;t signed up yet — it&apos;s the most useful
            thing you can do about this.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {(matches ?? []).map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-sand/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/directory/${m.slug || m.id}`} className="font-semibold text-ink hover:underline">
                {m.name}
              </Link>
              {m.availability && (
                <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold ${TONE[m.availability] ?? "bg-sand text-ink-soft"}`}>
                  {AVAILABILITY_LABEL[m.availability]}
                </span>
              )}
            </div>
            {!m.availability && (
              <p className="mt-1 text-xs text-ink-faint">Hasn&apos;t said whether they have room.</p>
            )}
            {m.credentials.length > 0 && (
              <p className="mt-1.5 text-xs text-ink-muted">
                {m.credentials.map((c) => CREDENTIAL_LABEL[c] ?? c).join(" · ")}
              </p>
            )}
            {m.minJobPence ? (
              <p className="mt-1 text-xs text-ink-faint">
                Smallest job about £{Math.round(m.minJobPence / 100)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {(matches ?? []).some((m) => m.credentials.length > 0) && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">{CREDENTIALS_DISCLAIMER}</p>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">{children}</div>;
}
