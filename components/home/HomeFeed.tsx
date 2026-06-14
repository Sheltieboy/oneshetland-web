/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  type HomeData,
  type HomeEvent,
  type HomeBusiness,
  type HomeOffer,
  type HomeNotice,
  type HomeJob,
  formatEventDate,
  formatEventTime,
  offerBadge,
} from "@/lib/home-data";

const SEV_COLOR: Record<string, string> = {
  urgent: "#c53b2f",
  warning: "#e0722a",
  info: "#0e6ea6",
};

export function HomeFeed({ data }: { data: HomeData }) {
  const { events, businesses, offers, notices, jobs, spik } = data;

  return (
    <>
      {/* Happening soon — events */}
      {events.length > 0 && (
        <Block eyebrow="Happening soon" title="What's on across the isles" href="/whats-on" accent="#d4921a">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        </Block>
      )}

      {/* Featured locals */}
      {businesses.length > 0 && (
        <Block eyebrow="Shop & eat local" title="Featured Shetland businesses" href="/directory" accent="#7c3aed" tint>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.slice(0, 3).map((b) => (
              <BusinessCard key={b.id} b={b} />
            ))}
          </div>
        </Block>
      )}

      {/* Latest offers */}
      {offers.length > 0 && (
        <Block eyebrow="Worth a look" title="Latest offers" href="/local" accent="#7c3aed">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.slice(0, 3).map((o) => (
              <OfferCard key={o.id} o={o} />
            ))}
          </div>
        </Block>
      )}

      {/* Community board + Today's wird, side by side on desktop */}
      {(notices.length > 0 || spik) && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            {notices.length > 0 && (
              <div>
                <p className="eyebrow text-ink-muted">Community board</p>
                <h2 className="mt-1 font-display text-3xl font-bold">The latest fae da isles</h2>
                <div className="mt-6 space-y-3">
                  {notices.slice(0, 3).map((n) => (
                    <NoticeCard key={n.id} n={n} />
                  ))}
                </div>
              </div>
            )}
            {spik && (
              <div>
                <p className="eyebrow text-ink-muted">Today&apos;s wird</p>
                <h2 className="mt-1 font-display text-3xl font-bold">Spik o&apos; da day</h2>
                <Link
                  href="/spik"
                  className="mt-6 block rounded-card border border-line bg-paper p-6 shadow-soft transition hover:shadow-lift"
                >
                  <p className="font-display text-4xl font-bold text-spik">{spik.word}</p>
                  <p className="mt-2 text-lg text-ink">{spik.meaning}</p>
                  {spik.example && (
                    <p className="mt-3 border-l-2 border-spik/40 pl-3 text-ink-soft italic">
                      &ldquo;{spik.example}&rdquo;
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-spik">
                    More o da dialect <span aria-hidden>→</span>
                  </span>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Work in Shetland */}
      {jobs.length > 0 && (
        <Block eyebrow="Work in Shetland" title="Latest jobs & shifts" href="/jobs" accent="#2a8b5c" tint>
          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.slice(0, 4).map((j) => (
              <JobRow key={j.id} j={j} />
            ))}
          </div>
        </Block>
      )}
    </>
  );
}

/* ── Block wrapper ─────────────────────────────────────────────────────────── */
function Block({
  eyebrow,
  title,
  href,
  accent,
  tint,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  accent: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={tint ? "bg-sand/40" : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow" style={{ color: accent }}>
              {eyebrow}
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
          >
            See all <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

/* ── Cards ─────────────────────────────────────────────────────────────────── */
function EventCard({ e }: { e: HomeEvent }) {
  return (
    <Link
      href="/whats-on"
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative h-40 overflow-hidden bg-events/15">
        {e.cover_url ? (
          <img
            src={e.cover_url}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-events/15 text-events">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-pill bg-paper/95 px-3 py-1 text-xs font-bold text-events shadow-sm">
          {formatEventDate(e.starts_at)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl font-bold leading-snug">{e.title}</h3>
        <p className="mt-1.5 text-sm text-ink-muted">
          {formatEventTime(e.starts_at)}
          {e.venue ? ` · ${e.venue}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {e.has_tickets && (
            <span className="rounded-pill bg-events/15 px-2.5 py-1 text-xs font-semibold text-events">Tickets</span>
          )}
          {e.price_text && <span className="text-sm font-medium text-ink-soft">{e.price_text}</span>}
        </div>
      </div>
    </Link>
  );
}

function BusinessCard({ b }: { b: HomeBusiness }) {
  return (
    <Link
      href="/directory"
      className="group flex items-center gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-local/10">
        {b.logo_url || b.cover_url ? (
          <img src={(b.logo_url || b.cover_url)!} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-local">
            {b.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-display text-lg font-bold">{b.name}</h3>
          {b.is_verified && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#7c3aed" className="shrink-0">
              <path d="M12 2l2.4 1.8 3 .2.2 3L21.4 12 19.6 15l-.2 3-3 .2L12 22l-2.4-1.8-3-.2-.2-3L4.6 12 6.4 9l.2-3 3-.2z" />
              <path d="M9.5 12.5l1.8 1.8 3.4-3.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {b.category && <p className="text-sm capitalize text-ink-muted">{b.category.replace(/_/g, " ")}</p>}
        {b.description && <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{b.description}</p>}
      </div>
    </Link>
  );
}

function OfferCard({ o }: { o: HomeOffer }) {
  return (
    <Link
      href="/local"
      className="group flex gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-local/10 text-center font-display text-sm font-bold leading-tight text-local">
        {offerBadge(o)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold leading-snug">{o.title}</h3>
        {o.business?.name && <p className="mt-1 text-sm text-ink-muted">{o.business.name}</p>}
      </div>
    </Link>
  );
}

function NoticeCard({ n }: { n: HomeNotice }) {
  const color = n.brand_color || SEV_COLOR[n.severity ?? "info"] || "#0e6ea6";
  return (
    <div
      className="rounded-card border border-line bg-paper p-4 shadow-soft"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">
          {n.publisher}
          {n.locality ? ` · ${n.locality}` : ""}
        </p>
      </div>
      <h3 className="mt-1 font-semibold text-ink">{n.title}</h3>
      {n.body && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{n.body}</p>}
    </div>
  );
}

function JobRow({ j }: { j: HomeJob }) {
  return (
    <Link
      href="/jobs"
      className="group flex items-center justify-between gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="min-w-0">
        <h3 className="truncate font-display text-lg font-bold">{j.title}</h3>
        <p className="text-sm text-ink-muted">
          {j.location || "Shetland"}
          {j.pay_text ? ` · ${j.pay_text}` : ""}
        </p>
      </div>
      <span className="shrink-0 rounded-pill bg-jobs/15 px-3.5 py-1.5 text-sm font-semibold text-jobs">View</span>
    </Link>
  );
}
