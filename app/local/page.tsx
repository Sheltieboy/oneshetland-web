import Image from "next/image";
import Link from "next/link";
import { getLocalFeed, offerBadge, SHETLAND_AREAS } from "@/lib/local-data";
import { SafeImage } from "@/components/ui/SafeImage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local" };

const LOCAL = "#7c3aed";
const EVENTS_COLOR = "#d4921a";
const JOBS_COLOR = "#0ea5e9";
const OFFERS_COLOR = "#d97706";

const CATEGORY_EMOJI: Record<string, string> = {
  food_drink: "🍽",
  retail: "🛍",
  services: "🔧",
  tourism: "🌅",
  accommodation: "🛏",
  other: "📍",
};

const CATEGORY_LABEL: Record<string, string> = {
  food_drink: "Food & Drink",
  retail: "Retail",
  services: "Services",
  tourism: "Tourism",
  accommodation: "Accommodation",
  other: "Other",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function LocalPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;
  const { events, jobs, businesses, notices, offers } = await getLocalFeed(area);
  const areaLabel = SHETLAND_AREAS.find((a) => a.key === area)?.label;

  // Curated-proposition counts (Local = offers / bookable / cashback, not an
  // exhaustive business list — that lives in the Directory).
  const bookableCount = businesses.filter((b) => b.accepts_bookings).length;
  const cashbackCount = businesses.filter((b) => (b.cashback_percent ?? 0) > 0).length;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden" style={{ background: LOCAL }}>
        <Image src="/heroes/local.jpeg" alt="" fill priority className="object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${LOCAL}e0 30%,${LOCAL}b0)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">OneShetland · Local</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">
            {areaLabel ? areaLabel : "All Shetland"}
          </h1>
          <p className="mt-2 text-base text-white/80 sm:text-lg">
            {areaLabel
              ? `What's good in ${areaLabel} — offers, bookable experiences and cashback from local businesses.`
              : "The good stuff close to home — offers, bookable experiences and cashback partners across Shetland."}
          </p>
          {/* Area chips */}
          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/local"
              className={"shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition " +
                (!area ? "bg-white text-purple-700 shadow" : "bg-white/20 text-white hover:bg-white/30")}
            >
              All Shetland
            </Link>
            {SHETLAND_AREAS.map((a) => (
              <Link
                key={a.key}
                href={`/local?area=${encodeURIComponent(a.key)}`}
                className={"shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition " +
                  (area === a.key ? "bg-white text-purple-700 shadow" : "bg-white/20 text-white hover:bg-white/30")}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl divide-x divide-line px-5">
          {[
            { n: offers.length, label: "live offers" },
            { n: bookableCount, label: "bookable spots" },
            { n: cashbackCount, label: "cashback partners" },
          ].map(({ n, label }) => (
            <div key={label} className="px-6 py-3 first:pl-0 last:pr-0">
              <span className="font-display text-xl font-bold text-ink">{n}</span>
              <span className="ml-1.5 text-sm text-ink-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12 space-y-14">

        {/* ── Curated pillars ─────────────────────────────────────────────────
            Local leads with what's good locally — offers, bookable experiences
            and cashback partners. The exhaustive A–Z list lives in the Directory. */}
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { emoji: "🏷", title: "Offers & deals", body: "Exclusive savings from local businesses", href: "#offers", color: OFFERS_COLOR },
            { emoji: "📅", title: "Bookable experiences", body: "Reserve a table, a slot or a stay", href: "/directory/bookable", color: "#059669" },
            { emoji: "👛", title: "Cashback partners", body: "Earn back when you spend in your wallet", href: "/directory", color: LOCAL },
          ].map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className="group flex items-start gap-3 rounded-2xl border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl" style={{ background: p.color + "18" }}>
                {p.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-display font-bold text-ink group-hover:underline">{p.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{p.body}</span>
              </span>
            </Link>
          ))}
        </section>


        {/* ── Offers & deals ──────────────────────────────────────────────── */}
        {offers.length > 0 && (
          <section id="offers" className="scroll-mt-24">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: OFFERS_COLOR }}>
                  Exclusive savings
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Offers &amp; deals</h2>
              </div>
              <Link href="/directory" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                See all →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const cat = o.business?.category ?? "other";
                const href = `/directory/${o.business?.slug ?? o.business_id}`;
                return (
                  <Link
                    key={o.id}
                    href={href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    {/* Cover */}
                    <div className="relative h-36 sm:h-40" style={{ background: OFFERS_COLOR + "14" }}>
                      {o.image_url ? (
                        <SafeImage src={o.image_url} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-5xl opacity-25">{CATEGORY_EMOJI[cat] ?? "🏷"}</span>
                        </div>
                      )}
                      {/* Discount badge */}
                      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black text-white shadow"
                        style={{ background: OFFERS_COLOR }}>
                        🏷 {offerBadge(o)}
                      </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-1 items-start gap-3 p-4">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
                        {o.business?.logo_url ? (
                          <img src={o.business.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg">
                            {CATEGORY_EMOJI[cat] ?? "📍"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: LOCAL }}>
                          {CATEGORY_LABEL[cat] ?? cat}
                        </p>
                        <p className="font-display text-base font-bold leading-snug text-ink group-hover:underline">
                          {o.title}
                        </p>
                        {o.business && (
                          <p className="mt-0.5 text-sm text-ink-muted truncate">{o.business.name}</p>
                        )}
                        <p className="mt-1 text-xs font-semibold" style={{ color: OFFERS_COLOR }}>
                          Until {fmtDate(o.valid_until)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Businesses ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LOCAL }}>
                {areaLabel ? `Featured in ${areaLabel}` : "Worth a look"}
              </p>
              <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Featured businesses</h2>
            </div>
            <Link href="/directory" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
              Full directory →
            </Link>
          </div>

          {businesses.length === 0 ? (
            <EmptySection
              icon="🏪"
              title="No businesses listed yet"
              body="Know a great Shetland business? Add them — it's free and takes two minutes."
              cta={{ label: "Add a business", href: "/directory/new" }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/directory/${b.slug ?? b.id}`}
                  className="group flex items-start gap-4 rounded-2xl border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  {/* Logo */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">
                        {CATEGORY_EMOJI[b.category ?? "other"] ?? "📍"}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-display font-bold text-ink group-hover:underline truncate">{b.name}</p>
                      {b.is_verified && <span className="shrink-0 text-sm" style={{ color: LOCAL }}>✓</span>}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold" style={{ color: LOCAL }}>
                      {CATEGORY_LABEL[b.category ?? "other"] ?? b.category}
                    </p>
                    {b.description && (
                      <p className="mt-1 text-xs text-ink-muted line-clamp-2">{b.description}</p>
                    )}
                    {b.locality && (
                      <p className="mt-1 text-xs text-ink-faint">📍 {b.locality}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        {/* ── Events ──────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: EVENTS_COLOR }}>
                {areaLabel ? `Events in ${areaLabel}` : "What's on"}
              </p>
              <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Upcoming events</h2>
            </div>
            <Link href="/whats-on" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
              See all →
            </Link>
          </div>

          {events.length === 0 ? (
            <EmptySection
              icon="📅"
              title="No events listed yet"
              body={areaLabel ? `Be the first to add an event in ${areaLabel}.` : "Check back soon — events are added regularly."}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/whats-on/${ev.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  {/* Cover */}
                  <div className="relative h-36 bg-events/10 sm:h-40">
                    {ev.cover_url ? (
                      <SafeImage src={ev.cover_url} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-5xl opacity-20">📅</span>
                      </div>
                    )}
                    {/* Date badge */}
                    <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-2.5 py-1.5 shadow backdrop-blur-sm">
                      <p className="text-center text-xs font-black uppercase tracking-wide leading-none" style={{ color: EVENTS_COLOR }}>
                        {new Date(ev.starts_at).toLocaleDateString("en-GB", { month: "short" })}
                      </p>
                      <p className="text-center text-xl font-black leading-tight text-ink">
                        {new Date(ev.starts_at).toLocaleDateString("en-GB", { day: "numeric" })}
                      </p>
                    </div>
                    {/* Tickets pill */}
                    {ev.has_tickets && (
                      <div className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow"
                        style={{ background: EVENTS_COLOR, color: "#fff" }}>
                        {ev.price_text ?? "Get tickets"}
                      </div>
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-display text-base font-bold leading-snug text-ink group-hover:text-events">
                      {ev.title}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {fmtDate(ev.starts_at)} · {fmtTime(ev.starts_at)}
                    </p>
                    {ev.venue && (
                      <p className="mt-0.5 text-xs text-ink-faint">{ev.venue}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Jobs ────────────────────────────────────────────────────────── */}
        {(jobs.length > 0) && (
          <section>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: JOBS_COLOR }}>
                  {areaLabel ? `Work in ${areaLabel}` : "Opportunities"}
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Jobs & shifts</h2>
              </div>
              <Link href="/jobs" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                See all →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {jobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-line bg-paper px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-xl"
                    style={{ background: JOBS_COLOR + "18" }}>
                    💼
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate group-hover:underline">{j.title}</p>
                    <p className="text-sm text-ink-muted">{j.location ?? "Shetland"}</p>
                  </div>
                  {j.pay_text && (
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: JOBS_COLOR + "18", color: JOBS_COLOR }}>
                      {j.pay_text}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Hub notices ─────────────────────────────────────────────────── */}
        {notices.length > 0 && (
          <section>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Community</p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Hub notices</h2>
              </div>
              <Link href="/hubs" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                See all →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {notices.map((n) => (
                <div key={n.id} className="rounded-2xl border border-line bg-paper p-5 shadow-soft">
                  {n.hub && (
                    <Link href={`/hubs/${n.hub.slug ?? n.hub.id}`} className="mb-3 flex items-center gap-2.5">
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
                        {n.hub.logo_url
                          ? <img src={n.hub.logo_url} alt="" className="h-full w-full object-cover" />
                          : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ink-faint">{n.hub.name.slice(0, 1)}</span>}
                      </div>
                      <span className="text-xs font-semibold text-ink-muted hover:underline">{n.hub.name}</span>
                    </Link>
                  )}
                  <p className="font-display font-bold text-ink leading-snug">{n.title}</p>
                  {n.body && <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">{n.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Add your business CTA ───────────────────────────────────────── */}
        <section className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-paper px-6 py-8 text-center sm:px-10">
          <p className="font-display text-2xl font-bold text-ink sm:text-3xl">Running a business in Shetland?</p>
          <p className="mx-auto mt-2 max-w-lg text-ink-soft">
            Free to list. Reach everyone on the islands with your offers, events and job listings in one place.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/directory/new"
              className="rounded-full px-6 py-3 font-semibold text-white shadow-soft transition hover:brightness-95"
              style={{ background: LOCAL }}
            >
              Add your business free →
            </Link>
            <Link
              href="/directory"
              className="rounded-full border border-line-strong px-6 py-3 font-semibold text-ink transition hover:bg-sand"
            >
              Browse the directory
            </Link>
          </div>
        </section>

      </div>
    </>
  );
}

function EmptySection({
  icon, title, body, cta,
}: {
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 font-display font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          style={{ background: LOCAL }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
