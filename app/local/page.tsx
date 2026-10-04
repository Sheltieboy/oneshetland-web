import Image from "next/image";
import Link from "next/link";
import { getLocalFeed, getActiveLocalPasses, getBookableServices, money, getNoticeBroadcastState, offerBadge, SHETLAND_AREAS } from "@/lib/local-data";
import { getAccount } from "@/lib/auth";
import { NoticeBroadcast } from "@/components/notices/NoticeBroadcast";
import { SafeImage } from "@/components/ui/SafeImage";
import { FindLocal } from "@/components/home/HomeSections";
import { getCuratedBusinesses, countShopProducts } from "@/lib/curated-businesses";
import { localHeroCopy } from "@/lib/local-copy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local" };

/**
 * Local is Shetland's trading community: the businesses, and what they offer.
 *
 *   hero → (urgent notice) → Open for business → Offers → Book → Passes → Shop → Jobs → Local rewards → Add your business
 *
 * It is not a second home page. Events live in What's On, notices on Home. Every commerce module appears only
 * when genuine public items exist, so with none the page is still complete: real businesses, jobs, the
 * Directory, and the invitation to list. Test fixtures never reach it (withheld by the database).
 */

const LOCAL = "#7c3aed";
const JOBS_COLOR = "#0ea5e9";
const OFFERS_COLOR = "#d97706";
const PASSES_COLOR = "#7c3aed";
const BOOK_COLOR = "#059669";

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

/** "1h 30m" / "45m" / "2h" */
function formatServiceDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function LocalPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;
  const areaLabel = SHETLAND_AREAS.find((a) => a.key === area)?.label;
  const [{ jobs, notices, offers }, passes, bookableServices, businesses, shopCount] = await Promise.all([
    getLocalFeed(area),
    getActiveLocalPasses(9),
    getBookableServices({ area }),
    getCuratedBusinesses({ limit: 8, areaLabel }),
    countShopProducts(),
  ]);
  // Only platform admins see the island-wide broadcast control, on an urgent notice.
  const account = await getAccount();
  const isAdmin = account?.profile?.role === "admin";
  const urgent = notices.filter((n) => n.severity === "urgent");
  const broadcastState = isAdmin && urgent.length ? await getNoticeBroadcastState(urgent.map((n) => n.id)) : {};

  // Each module — and the shortcut to it — exists only if something genuine does.
  const hasOffers = offers.length > 0;
  const hasPasses = passes.length > 0;
  const hasBookable = bookableServices.length > 0;
  const pillars = [
    ...(hasOffers ? [{ emoji: "🏷", title: "Offers & deals", body: "Exclusive savings from local businesses", href: "#offers", color: OFFERS_COLOR }] : []),
    ...(hasBookable ? [{ emoji: "📅", title: "Book", body: "Pick a service, pick a slot", href: "#book", color: BOOK_COLOR }] : []),
    ...(hasPasses ? [{ emoji: "🎫", title: "Passes & experiences", body: "Buy once, use more than once", href: "#passes", color: PASSES_COLOR }] : []),
  ];
  const stats = [
    ...(hasOffers ? [{ n: offers.length, label: "live offers" }] : []),
    ...(hasBookable ? [{ n: bookableServices.length, label: `bookable service${bookableServices.length === 1 ? "" : "s"}` }] : []),
    ...(hasPasses ? [{ n: passes.length, label: "passes & experiences" }] : []),
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden" style={{ background: LOCAL }}>
        <Image src="/heroes/local.jpeg" alt="" fill priority className="object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${LOCAL}e0 30%,${LOCAL}b0)` }} />
        <div className="relative mx-auto max-w-6xl px-5 py-8 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">OneShetland · Local</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white sm:text-5xl">
            {areaLabel ? areaLabel : "All Shetland"}
          </h1>
          <p className="mt-2 text-base text-white/85 sm:text-lg">{localHeroCopy({ areaLabel, hasOffers, hasPasses, hasBookable })}</p>
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

      {/* ── Stats strip — only when there is something to count (no empty band) ── */}
      {stats.length > 0 && (
        <div className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap divide-x divide-line px-5">
            {stats.map(({ n, label }) => (
              <div key={label} className="px-5 py-3 first:pl-0 last:pr-0">
                <span className="font-display text-xl font-bold text-ink">{n}</span>
                <span className="ml-1.5 text-sm text-ink-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Urgent notice — contextual; keeps the admin broadcast control ─────── */}
      {urgent.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-8">
          <div className="space-y-3">
            {urgent.map((n) => (
              <div key={n.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-[10px] font-black tracking-wide text-rose-600">URGENT{n.hub ? ` · ${n.hub.name}` : ""}</p>
                <p className="mt-1 font-display font-bold leading-snug text-ink">{n.title}</p>
                {n.body && <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">{n.body}</p>}
                {isAdmin && <NoticeBroadcast noticeId={n.id} title={n.title} broadcastAt={broadcastState[n.id] ?? null} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Open for business ─────────────────────────────────────────────── */}
      {businesses.length > 0 ? (
        <FindLocal
          businesses={businesses}
          eyebrow={areaLabel ? `In ${areaLabel}` : "Worth a look"}
          title="Open for business"
        />
      ) : (
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <EmptySection
            icon="🏪"
            title={areaLabel ? `No businesses listed in ${areaLabel} yet` : "No businesses listed yet"}
            body="Know a great Shetland business? Add them — it's free and takes two minutes."
            cta={{ label: "Add a business", href: "/directory/new" }}
          />
        </section>
      )}

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:pb-12 space-y-14">

        {/* Shortcuts to the commerce modules below — only when there are two or more to jump between. */}
        {pillars.length >= 2 && (
          <section className={"grid grid-cols-1 gap-4 sm:grid-cols-2 " + (pillars.length === 3 ? "lg:grid-cols-3" : "")}>
            {pillars.map((p) => (
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
        )}

        {/* ── Offers & deals ──────────────────────────────────────────────── */}
        {hasOffers && (
          <section id="offers" className="scroll-mt-24">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: OFFERS_COLOR }}>
                  Exclusive savings
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Offers &amp; deals</h2>
              </div>
              <Link href="/loyalty" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                Local rewards →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* ── Book now ─────────────────────────────────────────────────────────
            Service-first, not business-first: finding something to book used
            to mean opening a business from a list and scrolling to "Book
            online" to see what it actually offered. Each card here already
            is a bookable service — its own CTA drops straight into that
            service's slot picker on the business page (?book=<serviceId>,
            the same mechanism the gift-claim flow already used), never
            through a business list first. */}
        {hasBookable && (
          <section id="book" className="scroll-mt-24">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BOOK_COLOR }}>
                  Pick a service, pick a slot
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Book</h2>
              </div>
              <Link href="/directory/bookable" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bookableServices.slice(0, 6).map((s) => {
                const cat = s.business_category ?? "other";
                const bizHref = `/directory/${s.business_slug ?? s.business_id}`;
                return (
                  <Link
                    key={s.id}
                    href={`${bizHref}?book=${s.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <div className="flex flex-1 items-start gap-3 p-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-sand text-lg">
                        {CATEGORY_EMOJI[cat] ?? "📅"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: LOCAL }}>
                          {CATEGORY_LABEL[cat] ?? cat}
                        </p>
                        <p className="font-display text-base font-bold leading-snug text-ink group-hover:underline">
                          {s.name}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted truncate">{s.business_name}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: BOOK_COLOR }}>
                          {formatServiceDuration(s.duration_minutes)} · {money(s.price_pence)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Passes & experiences ────────────────────────────────────────────
            Multi-use passes (class packs, day passes) bought once and spent
            down over several visits — distinct from a timed booking, and
            previously undiscoverable from Local at all: a business's own page
            showed these correctly, but nothing here ever pointed at one. */}
        {hasPasses && (
          <section id="passes" className="scroll-mt-24">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: PASSES_COLOR }}>
                  Buy once, use more than once
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Passes &amp; experiences</h2>
              </div>
              <Link href="/directory" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                Find more →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {passes.map((p) => {
                const cat = p.business_category ?? "other";
                const href = `/directory/${p.business_slug ?? p.business_id}`;
                return (
                  <Link
                    key={p.id}
                    href={href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    {/* Cover */}
                    <div className="relative h-36 sm:h-40" style={{ background: PASSES_COLOR + "14" }}>
                      {p.image_url ? (
                        <SafeImage src={p.image_url} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-5xl opacity-25">{CATEGORY_EMOJI[cat] ?? "🎫"}</span>
                        </div>
                      )}
                      {/* Price badge */}
                      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black text-white shadow"
                        style={{ background: PASSES_COLOR }}>
                        🎫 £{(p.price_pence / 100).toFixed(2)}
                      </div>
                    </div>
                    {/* Body */}
                    <div className="flex flex-1 items-start gap-3 p-4">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
                        {p.business_logo_url ? (
                          <img src={p.business_logo_url} alt="" className="h-full w-full object-cover" />
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
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted truncate">{p.business_name}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: PASSES_COLOR }}>
                          {p.uses_per_purchase > 1 ? `${p.uses_per_purchase} uses` : "1 use"}
                          {p.valid_days !== null ? ` · ${p.valid_days}d valid` : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Shop — one entry, only when the Shop genuinely has something on sale ── */}
        {shopCount > 0 && (
          <Link
            href="/shop"
            className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: LOCAL + "18" }}>🛍</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold text-ink group-hover:underline">Shop</span>
              <span className="mt-0.5 block text-sm text-ink-muted">Knitwear, craft, art, food and drink from Shetland&apos;s own makers.</span>
            </span>
            <span className="shrink-0 text-sm font-bold" style={{ color: LOCAL }}>Browse the Shop →</span>
          </Link>
        )}

        {/* ── Jobs ────────────────────────────────────────────────────────── */}
        {(jobs.length > 0) && (
          <section>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: JOBS_COLOR }}>
                  {areaLabel ? `Work in ${areaLabel}` : "Opportunities"}
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Jobs</h2>
              </div>
              <Link href="/jobs" className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-sand">
                All jobs →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {jobs.slice(0, 4).map((j) => (
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

        {/* ── Local rewards — loyalty and Wallet ─────────────────────────────── */}
        <Link
          href="/loyalty"
          className="group flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white shadow-soft transition hover:shadow-lift sm:p-6"
          style={{ background: `linear-gradient(135deg, ${LOCAL} 0%, #4f46e5 55%, #0ea5e9 100%)` }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20 text-2xl">⭐️</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold sm:text-xl">Local rewards</span>
            <span className="mt-0.5 block text-sm text-white/90">
              One card for every shop — collect stamps, earn points and use your Wallet across the isles.
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white/20 px-4 py-2 text-sm font-bold transition group-hover:bg-white/30">
            Explore →
          </span>
        </Link>

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
