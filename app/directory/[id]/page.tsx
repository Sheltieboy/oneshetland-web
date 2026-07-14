/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBusiness,
  getBusinessExtras,
  getBusinessEventsAndJobs,
  CATEGORY_LABEL,
  type OpeningHours,
} from "@/lib/local-data";
import { getAccount } from "@/lib/auth";
import { TrackView } from "@/components/analytics/TrackView";
import { ContactLink } from "@/components/analytics/ContactLink";
import { OfferClaimList } from "@/components/local/OfferClaimList";
import { UnitItemsSection } from "@/components/local/UnitItemsSection";
import { ServicesSection } from "@/components/local/ServicesSection";
import { WalletTopUpButton } from "@/components/local/WalletTopUpButton";
import { FollowButton } from "@/components/local/FollowButton";
import { LoyaltyProgress } from "@/components/local/LoyaltyProgress";
import { BusinessLocationMap } from "@/components/local/BusinessLocationMap";
import { tierUnlocks } from "@/lib/listing-tiers";

export const dynamic = "force-dynamic";

const LOCAL = "#7c3aed";
const DAYS: [keyof OpeningHours, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusiness(id);
  return { title: b?.name ?? "Business" };
}

function accentOf(brand: string | null) {
  if (brand && /^#?[0-9a-f]{6}$/i.test(brand)) return brand.startsWith("#") ? brand : `#${brand}`;
  return LOCAL;
}

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBusiness(id);
  if (!b) notFound();

  const [{ offers, loyalty, services, unitItems }, { events, jobs, owner }, account] = await Promise.all([
    getBusinessExtras(b.id),
    getBusinessEventsAndJobs(b.id),
    getAccount(),
  ]);
  const accent = accentOf(b.brand_color);
  const cashback = b.accepts_wallet && b.cashback_percent > 0 ? b.cashback_percent : 0;
  const isLoggedIn = !!account;
  const signInHref = `/sign-in?next=/directory/${id}`;
  const isOwner = !!account && !!b.owner_id && account.id === b.owner_id;

  // Tier gating — richer listings for higher subscription tiers. Only affects
  // what is DISPLAYED; a business always keeps everything its tier includes.
  const tier = b.subscription_tier;
  const showCover     = tierUnlocks(tier, "coverPhoto");
  const showAbout     = tierUnlocks(tier, "description");
  const showContacts  = tierUnlocks(tier, "extraContacts");
  const showMap       = tierUnlocks(tier, "mapPin");
  const showOffers    = tierUnlocks(tier, "offers");
  const showLoyalty   = tierUnlocks(tier, "loyalty");
  const showHiring    = tierUnlocks(tier, "hiring");
  const showWallet    = tierUnlocks(tier, "wallet");
  const showFeatured  = tierUnlocks(tier, "featuredBadge");
  const showGallery   = tierUnlocks(tier, "gallery");
  const showEvents    = tierUnlocks(tier, "events");
  const showServices  = tierUnlocks(tier, "services");
  const showTickets   = tierUnlocks(tier, "tickets");

  const highlights = [
    showTickets && b.accepts_bookings && { t: "Book online", s: "Reserve a slot" },
    showWallet && cashback && { t: `${cashback}% cashback`, s: "Pay with OneShetland" },
    showOffers && offers.length > 0 && { t: "Offers", s: `${offers.length} live just now` },
    showLoyalty && loyalty && { t: "Loyalty rewards", s: loyalty.type === "points" ? "Earn points" : "Collect stamps" },
  ].filter(Boolean) as { t: string; s: string }[];

  const mapHref = b.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address}`)}`
    : null;

  return (
    <>
      <TrackView event="content_viewed" objectType="business" objectId={b.id} businessId={b.id} />
      {/* Cover hero */}
      <section className="relative isolate flex min-h-[34vh] flex-col justify-end overflow-hidden text-paper sm:min-h-[40vh]" style={{ background: accent }}>
        {showCover && b.cover_url ? (
          <img src={b.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

        <div className="absolute left-0 right-0 top-0">
          <div className="mx-auto max-w-5xl px-5 pt-5">
            <Link href="/directory" className="inline-flex items-center gap-2 rounded-pill bg-black/40 px-4 py-2 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-black/55">
              <span aria-hidden>‹</span> Directory
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-5xl items-end gap-4 px-5 pb-8">
          {b.logo_url ? (
            <img src={b.logo_url} alt="" className="h-20 w-20 shrink-0 rounded-2xl border-2 border-paper bg-paper object-contain p-1.5 shadow-lg" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {b.category && (
                <span className="rounded-pill bg-paper/90 px-2.5 py-0.5 text-xs font-bold" style={{ color: accent }}>
                  {CATEGORY_LABEL[b.category] ?? b.category}
                </span>
              )}
              {showFeatured && (
                <span className="rounded-pill bg-paper/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">★ Featured</span>
              )}
            </div>
            <h1 className="mt-2 flex items-center gap-2 font-display text-4xl font-bold drop-shadow sm:text-5xl">
              {b.name}
              {b.is_verified && (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-label="Verified">
                  <path d="M12 2l2.4 1.8 3 .2.2 3L21.4 12 19.6 15l-.2 3-3 .2L12 22l-2.4-1.8-3-.2-.2-3L4.6 12 6.4 9l.2-3 3-.2z" />
                  <path d="M9.5 12.5l1.8 1.8 3.4-3.6" stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </h1>
            {b.address && <p className="mt-1 text-paper/85">{b.address}</p>}
          </div>
          <div className="shrink-0 self-end pb-1">
            <FollowButton businessId={b.id} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} />
          </div>
        </div>
      </section>

      {/* Owner-only upgrade hint (shown on your own lower-tier listing) */}
      {isOwner && tier !== "premium" && (
        <div className="border-b border-line" style={{ background: `${accent}0c` }}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">This is your listing.</span>{" "}
              {tier === "free"
                ? "Upgrade to add a cover photo, gallery, offers, loyalty and a featured spot."
                : "Go Premium to add bookings, a gallery and a featured homepage spot."}
            </p>
            <Link href={`/business/${b.id}/manage/billing`} className="shrink-0 rounded-pill px-4 py-2 text-sm font-bold text-paper shadow-soft transition hover:brightness-110" style={{ background: accent }}>
              See plans &amp; upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Add-on highlights */}
      {highlights.length > 0 && (
        <div className="border-b border-line bg-sand/40">
          <div className="mx-auto grid max-w-5xl gap-3 px-5 py-6 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h) => (
              <div key={h.t} className="rounded-card border border-line bg-paper px-4 py-3 shadow-soft">
                <p className="font-display text-lg font-bold" style={{ color: LOCAL }}>{h.t}</p>
                <p className="text-sm text-ink-muted">{h.s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim banner — unclaimed listings only */}
      {!b.is_claimed && (
        <div id="claim" className="scroll-mt-20 border-b border-local/20 bg-local/8">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-xl font-bold text-local">Is this your business?</p>
              <p className="mt-1 text-ink-soft">
                Claim this free listing to manage your details and add offers, loyalty and online bookings.
              </p>
            </div>
            <Link
              href={`/directory/${id}/claim`}
              className="shrink-0 rounded-pill px-6 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95"
              style={{ background: LOCAL }}
            >
              Claim this listing
            </Link>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.6fr_1fr] lg:py-16">
        <div className="space-y-12">
          {showAbout && b.description && (
            <section>
              <h2 className="font-display text-2xl font-bold">About</h2>
              <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink-soft">{b.description}</p>
            </section>
          )}

          {showOffers && offers.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Current offers</h2>
              <OfferClaimList offers={offers} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} />
            </section>
          )}

          {showTickets && (
            <UnitItemsSection items={unitItems} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} />
          )}

          {showLoyalty && loyalty && (
            <section>
              <h2 className="font-display text-2xl font-bold">Loyalty rewards</h2>
              <div className="mt-5 overflow-hidden rounded-xl p-6 text-paper shadow-soft" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
                {loyalty.type === "points" ? (
                  <>
                    <p className="font-display text-2xl font-bold">Earn as you spend</p>
                    <p className="mt-1 text-paper/90">
                      {loyalty.points_per_pound ?? 1} point{loyalty.points_per_pound === 1 ? "" : "s"} per £1 spent
                      {loyalty.points_for_pound ? ` · ${loyalty.points_for_pound} points = £1 back` : ""}.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-display text-2xl font-bold">Collect &amp; reward</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Array.from({ length: Math.min(loyalty.stamps_required ?? 8, 12) }).map((_, idx) => (
                        <span key={idx} className="h-6 w-6 rounded-full border-2 border-paper/70" />
                      ))}
                    </div>
                    <p className="mt-3 text-paper/90">
                      Collect {loyalty.stamps_required ?? 0} stamps{loyalty.stamp_reward ? ` for ${loyalty.stamp_reward}` : ""}.
                    </p>
                  </>
                )}
                <LoyaltyProgress businessId={b.id} loyalty={loyalty} isLoggedIn={isLoggedIn} />
                <p className="mt-4 text-sm text-paper/80">Collect your stamps and points in the OneShetland app.</p>
              </div>
            </section>
          )}

          {showServices && b.accepts_bookings && services.length > 0 && (
            <ServicesSection services={services} businessId={b.id} accent={accent} isLoggedIn={isLoggedIn} signInHref={signInHref} userId={account?.id ?? null} />
          )}

          {/* Upcoming events */}
          {showEvents && events.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">Upcoming events</h2>
              <div className="mt-5 space-y-3">
                {events.map(ev => (
                  <Link key={ev.id} href={`/whats-on/${ev.id}`}
                    className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 shadow-soft transition hover:border-current"
                    style={{ color: accent }}
                  >
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-center text-paper text-xs font-bold" style={{ background: accent }}>
                      {new Date(ev.starts_at).toLocaleDateString("en-GB", { day: "numeric" })}
                      <br />
                      {new Date(ev.starts_at).toLocaleDateString("en-GB", { month: "short" })}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold text-ink">{ev.title}</p>
                      <p className="text-sm text-ink-muted">
                        {new Date(ev.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {ev.venue ? ` · ${ev.venue}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Jobs */}
          {showHiring && jobs.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold">We&apos;re hiring</h2>
              <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-paper shadow-soft">
                {jobs.map(j => (
                  <Link key={j.id} href={`/jobs/${j.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{j.title}</p>
                      {j.location && <p className="text-sm text-ink-muted">{j.location}</p>}
                    </div>
                    {j.pay_text && (
                      <span className="shrink-0 rounded-pill bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-muted">{j.pay_text}</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Photo gallery */}
          {showGallery && (b as { gallery_urls?: string[] | null }).gallery_urls?.length ? (
            <section>
              <h2 className="font-display text-2xl font-bold">Photos</h2>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {((b as { gallery_urls?: string[] }).gallery_urls ?? []).map((url, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
            <h3 className="font-display text-lg font-bold">Find &amp; contact</h3>
            {showMap && b.lat != null && b.lng != null && (
              <div className="mt-4">
                <BusinessLocationMap lat={b.lat} lng={b.lng} name={b.name} accent={accent} />
              </div>
            )}
            <dl className="mt-4 space-y-3 text-ink-soft">
              {b.address && (
                <ContactRow label="Address">
                  {b.address}
                  {mapHref && (
                    <ContactLink objectType="business" objectId={b.id} businessId={b.id} method="directions" href={mapHref} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-semibold text-local hover:underline">
                      View on map →
                    </ContactLink>
                  )}
                </ContactRow>
              )}
              {b.phone && (
                <ContactRow label="Phone">
                  <ContactLink objectType="business" objectId={b.id} businessId={b.id} method="phone" href={`tel:${b.phone}`} className="font-medium text-ink hover:text-local">{b.phone}</ContactLink>
                </ContactRow>
              )}
              {showContacts && b.website && (
                <ContactRow label="Website">
                  <ContactLink objectType="business" objectId={b.id} businessId={b.id} method="website" href={b.website} target="_blank" rel="noreferrer" className="break-all font-medium text-ink hover:text-local">
                    {b.website.replace(/^https?:\/\//, "")}
                  </ContactLink>
                </ContactRow>
              )}
              {showContacts && b.email && (
                <ContactRow label="Email">
                  <ContactLink objectType="business" objectId={b.id} businessId={b.id} method="email" href={`mailto:${b.email}`} className="break-all font-medium text-ink hover:text-local">{b.email}</ContactLink>
                </ContactRow>
              )}
            </dl>
          </div>

          {b.opening_hours && Object.keys(b.opening_hours).length > 0 && (
            <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
              <h3 className="font-display text-lg font-bold">Opening hours</h3>
              <dl className="mt-4 space-y-1.5 text-sm">
                {DAYS.map(([k, label]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="font-medium text-ink">{b.opening_hours?.[k] || "Closed"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {showWallet && cashback > 0 && (
            <div className="rounded-xl border border-local/30 bg-local/8 p-6">
              <p className="font-display text-lg font-bold text-local">Pay with OneShetland</p>
              <p className="mt-1 text-ink-soft">
                Pay with your wallet and get <strong>{cashback}% back</strong>.
              </p>
              <WalletTopUpButton accent={LOCAL} isLoggedIn={isLoggedIn} signInHref={signInHref} />
            </div>
          )}

          {/* Managed by — quiet attribution */}
          {owner?.full_name && (
            <p className="px-1 text-xs text-ink-faint">
              Managed by {owner.full_name.split(" ").map((part, i, arr) =>
                i === arr.length - 1 && i > 0 ? part.slice(0, 1) + "." : part
              ).join(" ")}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow text-ink-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
