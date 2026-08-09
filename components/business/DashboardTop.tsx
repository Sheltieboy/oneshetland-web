import Link from "next/link";
import { AVAILABILITY_LABEL, AVAILABILITY_TTL_DAYS, availabilityIsFresh } from "@/lib/trades";
import { type DashboardData } from "@/lib/business-dashboard.server";

/**
 * The top of the business dashboard: what needs you, and how the week went.
 *
 * Two rules it follows.
 *
 * A zero is not shown. "0 orders waiting" is noise dressed as information, and
 * a row of zeroes teaches you to skim past the row that finally matters. If
 * nothing needs doing, the section isn't there and the page is calmer.
 *
 * A number we can't see is not shown as £0. Revenue is null without the
 * analytics add-on, and printing £0 to somebody who took £400 last week would
 * destroy trust in every other figure here.
 */

const BIZ = "#7c3aed";

export function DashboardTop({ data, base }: { data: DashboardData; base: string }) {
  const { needs, week, code } = data;

  const actions = [
    needs.orders && { href: `${base}/orders`, n: needs.orders, label: needs.orders === 1 ? "order to deal with" : "orders to deal with", tone: "amber" },
    needs.bookings && { href: `${base}/bookings`, n: needs.bookings, label: needs.bookings === 1 ? "booking coming up" : "bookings coming up", tone: "sky" },
    needs.leads && { href: `${base}/leads`, n: needs.leads, label: needs.leads === 1 ? "job lead waiting" : "job leads waiting", tone: "emerald" },
    needs.jobApplications && { href: `${base}/jobs`, n: needs.jobApplications, label: needs.jobApplications === 1 ? "job application" : "job applications", tone: "violet" },
  ].filter(Boolean) as { href: string; n: number; label: string; tone: string }[];

  const staleAvailability =
    data.isTrade && !!data.tradeAvailability && !availabilityIsFresh(data.tradeAvailabilitySetAt);

  return (
    <div className="space-y-4">
      {/* ── Needs you ─────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <section>
          <h2 className="eyebrow text-ink-muted">Needs you</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black ${TONE[a.tone]}`}>
                  {a.n}
                </span>
                <span className="font-semibold text-ink">{a.label}</span>
                <span className="ml-auto text-ink-faint" aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* A trade whose availability has lapsed has silently stopped getting
          work. That is the single most costly stale setting on the platform,
          so it is surfaced here rather than only inside the leads page. */}
      {staleAvailability && (
        <Link href={`${base}/leads`} className="block rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            Your availability is more than {AVAILABILITY_TTL_DAYS} days old
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Job leads have stopped coming. Confirm it and they start again.
          </p>
        </Link>
      )}

      {/* ── The week ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="eyebrow text-ink-muted">Last 7 days</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Profile views" value={week.views.toLocaleString()} href={`${base}/analytics`} />
          <Stat label="Contacts" value={week.contacts.toLocaleString()} href={`${base}/analytics`} />
          <Stat label="Followers" value={week.followers.toLocaleString()} href={`${base}/analytics`} />
          {week.revenuePence === null ? (
            <Stat label="Money in" value="—" hint="Needs the analytics add-on" href={`${base}/addons`} />
          ) : (
            <Stat label="Money in" value={`£${(week.revenuePence / 100).toFixed(2)}`} href={`${base}/transactions`} />
          )}
        </div>
      </section>

      {/* ── The code, front and centre ────────────────────────────────── */}
      {code && (
        <section className="rounded-xl border border-line bg-paper p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-ink-muted">Today&apos;s business code</p>
              {/* Read aloud across a counter a dozen times a day, so it's set
                  big and in a monospace face where 0/O and 1/I don't argue. */}
              <p className="font-mono text-3xl font-black tracking-[0.2em] text-ink">{code}</p>
            </div>
            <Link href={`${base}/counter`} className="rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft" style={{ background: BIZ }}>
              Open counter mode
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-800",
  emerald: "bg-emerald-100 text-emerald-800",
  violet: "bg-violet-100 text-violet-800",
};

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:shadow-lift">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Link>
  );
}

/** Availability, shown as a chip when the trade side is on. */
export function AvailabilityChip({ data, base }: { data: DashboardData; base: string }) {
  if (!data.isTrade) return null;
  const live = availabilityIsFresh(data.tradeAvailabilitySetAt) ? data.tradeAvailability : null;
  return (
    <Link
      href={`${base}/leads`}
      className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink-soft shadow-soft"
    >
      <span className={`h-2 w-2 rounded-full ${live === "now" || live === "weeks" ? "bg-emerald-500" : live ? "bg-amber-500" : "bg-rose-500"}`} />
      {live ? AVAILABILITY_LABEL[live] : "Availability not set"}
    </Link>
  );
}
