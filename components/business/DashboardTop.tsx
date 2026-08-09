import Link from "next/link";
import { AVAILABILITY_LABEL, AVAILABILITY_TTL_DAYS, availabilityIsFresh } from "@/lib/trades";
import { type DashboardData } from "@/lib/business-dashboard.server";

const money = (p: number) => `£${(p / 100).toFixed(2)}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

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

  const staleAvailability =
    data.isTrade && !!data.tradeAvailability && !availabilityIsFresh(data.tradeAvailabilitySetAt);

  return (
    <div className="space-y-4">
      {/* ── What's waiting — the THINGS, not a count of them ──────────
           A badge saying "3 orders" still makes you click through to learn
           anything, which is the old page with a number on it. These are the
           actual rows: who, what, how much, when. */}

      {data.orders.length > 0 && (
        <Panel title="Orders to deal with" href={`${base}/orders`} cta="All orders" tone="amber">
          {data.orders.map((o) => (
            <Row key={o.id} href={`${base}/orders`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{o.items}</span>
                <span className="block text-sm text-ink-muted">
                  {o.who ?? "Customer"} · {o.fulfilment === "fetch" ? "Fetch delivery" : o.fulfilment === "post" ? "Post" : "Collection"} · {ago(o.createdAt)}
                </span>
              </span>
              <span className="shrink-0 font-bold text-ink">{money(o.totalPence)}</span>
            </Row>
          ))}
        </Panel>
      )}

      {data.bookings.length > 0 && (
        <Panel title="Coming up" href={`${base}/bookings`} cta="All bookings" tone="sky">
          {data.bookings.map((b) => (
            <Row key={b.id} href={`${base}/bookings`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{b.service ?? "Booking"}</span>
                <span className="block text-sm text-ink-muted">{b.who ?? "Customer"} · {when(b.startsAt)}</span>
              </span>
              {b.pricePence > 0 && <span className="shrink-0 font-bold text-ink">{money(b.pricePence)}</span>}
            </Row>
          ))}
        </Panel>
      )}

      {data.leads.length > 0 && (
        <Panel title="Job leads waiting" href={`${base}/leads`} cta="All leads" tone="emerald">
          {data.leads.map((l) => (
            <Row key={l.matchId} href={`${base}/leads`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {l.urgency === "emergency" && (
                    <span className="mr-1.5 rounded-pill bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">Urgent</span>
                  )}
                  {l.title}
                </span>
                <span className="block text-sm text-ink-muted">{l.location} · {ago(l.createdAt)}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-emerald-700">Answer →</span>
            </Row>
          ))}
        </Panel>
      )}

      {needs.jobApplications > 0 && (
        <Panel title="Job applications" href={`${base}/jobs`} cta="Open jobs" tone="violet">
          <Row href={`${base}/jobs`}>
            <span className="font-semibold text-ink">
              {needs.jobApplications} {needs.jobApplications === 1 ? "person has" : "people have"} applied
            </span>
          </Row>
        </Panel>
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

function Panel({
  title, href, cta, tone, children,
}: { title: string; href: string; cta: string; tone: string; children: React.ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-paper shadow-soft ${PANEL[tone]}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="font-display font-bold text-ink">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-ink-soft hover:text-ink">{cta} →</Link>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-sand/50">
      {children}
    </Link>
  );
}

const PANEL: Record<string, string> = {
  amber: "border-amber-200",
  sky: "border-sky-200",
  emerald: "border-emerald-200",
  violet: "border-violet-200",
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
