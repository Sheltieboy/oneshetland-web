/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEvent,
  getEventSocialStats,
  computeScarcity,
  fmtLongDateTime,
  fmtTime,
  ticketTypeOnSale,
  ticketTypeRemaining,
  UPDATE_KIND_LABELS,
  type TicketType,
  type EventUpdate,
} from "@/lib/events-data";
import { getEventConditions, LERWICK_COORDS } from "@/lib/shetland-today";
import { detectEventArea, detectEventStop, defaultStopForArea } from "@/lib/transit-data";
import { SafeImage } from "@/components/ui/SafeImage";
import { ScarcityStrip, GoingCount, GettingTherePanel } from "@/components/events/EventInsights";
import { TravelPlanner } from "@/components/events/TravelPlanner";
import { getAccount } from "@/lib/auth";
import { canScanEvent } from "@/lib/events-server";
import { TicketButton } from "@/components/events/TicketModal";
import { ShareButton } from "@/components/events/ShareButton";
import { TrackView } from "@/components/analytics/TrackView";
import { TicketLink } from "@/components/analytics/TicketLink";

export const dynamic = "force-dynamic";

const EVENTS = "#d4921a";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getEvent(id);
  return { title: e?.title ?? "Event" };
}

function price(pence: number) {
  return pence <= 0 ? "Free" : `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e, account] = await Promise.all([getEvent(id), getAccount()]);
  if (!e) notFound();

  const isCancelled = e.status === "cancelled";
  const isPostponed = e.status === "postponed";
  const isLive = !isCancelled && !isPostponed;

  const coords = e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : LERWICK_COORDS;
  const [canScan, social, conditions] = await Promise.all([
    account ? canScanEvent(id) : Promise.resolve(false),
    isLive ? getEventSocialStats(id) : Promise.resolve({ goingCount: 0, bookedRecent: 0 }),
    isLive ? getEventConditions(coords, e.starts_at) : Promise.resolve(null),
  ]);

  const organiser = e.hub ?? e.business ?? null;
  const urgentUpdate = e.updates.find((u) => u.is_urgent);
  const scarcity = computeScarcity(e.ticket_types);
  // Journey-home is anchored on the event's own area (from Lerwick out to the
  // isles for a hub event; in to Lerwick for an outer event).
  const eventArea = detectEventArea(e.locality, e.venue, e.lat, e.lng);
  const eventStop = detectEventStop(e.locality, e.venue, eventArea);
  // Default the planner's "my stop" to the user's profile home area, else Lerwick.
  const homeArea = detectEventArea(account?.profile?.location_area, null, null, null);
  const homeDefaultStop = defaultStopForArea(homeArea);

  const mapHref = e.formatted_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [e.venue, e.formatted_address].filter(Boolean).join(" "),
      )}`
    : e.lat != null && e.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`
      : null;

  return (
    <>
      <TrackView event="content_viewed" objectType="event" objectId={id} />
      {/* Cover hero */}
      <section className="relative isolate flex min-h-[44vh] flex-col justify-end overflow-hidden text-paper sm:min-h-[52vh]" style={{ background: EVENTS }}>
        {e.cover_url ? (
          <SafeImage src={e.cover_url} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />

        {/* Back + share */}
        <div className="absolute left-0 right-0 top-0">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5">
            <Link
              href="/whats-on"
              className="inline-flex items-center gap-2 rounded-pill bg-black/40 px-4 py-2 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-black/55"
            >
              <span aria-hidden>‹</span> What&apos;s On
            </Link>
            <ShareButton title={e.title} text={`${e.title} — ${fmtLongDateTime(e.starts_at)}`} />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-5xl px-5 pb-9">
          {e.category && (
            <span className="inline-block rounded-pill bg-paper/95 px-3 py-1 text-xs font-bold" style={{ color: EVENTS }}>
              {e.category}
            </span>
          )}
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight drop-shadow sm:text-5xl">
            {e.title}
          </h1>
          <p className="mt-3 text-lg text-paper/90">
            {fmtLongDateTime(e.starts_at)}
            {e.venue ? ` · ${e.venue}` : ""}
          </p>
        </div>
      </section>

      {/* Organiser check-in (only shown to whoever can scan this event) */}
      {canScan && (
        <div className="border-b border-line bg-navy/[0.04]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-sm font-semibold text-ink">You&apos;re organising this event.</p>
            <Link href={`/whats-on/${e.id}/check-in`} className="rounded-pill bg-navy px-4 py-2 text-sm font-bold text-paper transition hover:bg-navy-dark">
              Check in attendees →
            </Link>
          </div>
        </div>
      )}

      {/* Status / urgent banners */}
      {(isCancelled || isPostponed || urgentUpdate) && (
        <div className="mx-auto max-w-5xl px-5 pt-6">
          <div className="space-y-3">
            {isCancelled && (
              <div className="rounded-card border border-red-300 bg-red-50 px-5 py-4">
                <p className="font-display text-lg font-bold text-red-800">This event has been cancelled</p>
              </div>
            )}
            {isPostponed && (
              <div className="rounded-card border border-amber-300 bg-amber-50 px-5 py-4">
                <p className="font-display text-lg font-bold text-amber-800">This event has been postponed</p>
              </div>
            )}
            {urgentUpdate && !isCancelled && (
              <div className="rounded-card border border-red-300 bg-red-50 px-5 py-4">
                <p className="font-display text-base font-bold text-red-800">{urgentUpdate.title}</p>
                {urgentUpdate.body && <p className="mt-1 text-sm text-red-700">{urgentUpdate.body}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.6fr_1fr] lg:py-16">
        {/* Main */}
        <div>
          {isLive && social.goingCount >= 3 ? (
            <div className="mb-6">
              <GoingCount count={social.goingCount} />
            </div>
          ) : null}

          {e.description ? (
            <div>
              <h2 className="font-display text-2xl font-bold">About this event</h2>
              <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink-soft">{e.description}</p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <InfoCard label="When">
              {fmtLongDateTime(e.starts_at)}
              {e.doors_open_at ? <span className="block text-ink-muted">Doors {fmtTime(e.doors_open_at)}</span> : null}
              {e.ends_at ? <span className="block text-ink-muted">Until {fmtTime(e.ends_at)}</span> : null}
            </InfoCard>
            <InfoCard label="Where">
              {e.venue ?? "Shetland"}
              {e.formatted_address ? <span className="block text-ink-muted">{e.formatted_address}</span> : e.locality ? <span className="block text-ink-muted">{e.locality}</span> : null}
              {mapHref ? (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm font-semibold text-ink hover:underline"
                  style={{ color: EVENTS }}
                >
                  Get directions →
                </a>
              ) : null}
            </InfoCard>
            {e.age_restriction ? <InfoCard label="Age">{e.age_restriction}</InfoCard> : null}
            {e.accessibility_info ? <InfoCard label="Accessibility">{e.accessibility_info}</InfoCard> : null}
          </div>

          {/* Getting there — Shetland context (ferry, weather, daylight) */}
          {isLive && conditions ? (
            <GettingTherePanel conditions={conditions} eventTime={fmtTime(e.starts_at)} />
          ) : null}
          {isLive && eventArea ? (
            <TravelPlanner eventArea={eventArea} eventStop={eventStop} startsAt={e.starts_at} endsAt={e.ends_at} defaultStop={homeDefaultStop} />
          ) : null}

          {/* Photo gallery */}
          {e.gallery_urls?.length ? (
            <section className="mt-10">
              <h2 className="font-display text-2xl font-bold">Photos</h2>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {e.gallery_urls.map((url, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl bg-sand">
                    <SafeImage src={url} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Updates feed */}
          {e.updates.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display text-2xl font-bold">Updates</h2>
              <ul className="mt-5 space-y-3">
                {e.updates.map((u) => (
                  <UpdateRow key={u.id} update={u} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Contact / notes */}
          {e.contact_info || e.event_notes ? (
            <section className="mt-10 rounded-xl border border-line bg-paper p-6 shadow-soft">
              {e.contact_info ? (
                <>
                  <p className="eyebrow text-ink-muted">Contact</p>
                  <p className="mt-2 whitespace-pre-line font-medium text-ink">{e.contact_info}</p>
                </>
              ) : null}
              {e.event_notes ? (
                <p className={`whitespace-pre-line text-sm italic text-ink-muted ${e.contact_info ? "mt-4" : ""}`}>
                  {e.event_notes}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {(e.has_tickets || e.ticket_types.length > 0 || e.price_text) && !isCancelled && (
            <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
              <h3 className="font-display text-xl font-bold">Tickets</h3>
              <div className="mt-4 empty:hidden">
                <ScarcityStrip scarcity={scarcity} bookedRecent={social.bookedRecent} />
              </div>
              {e.ticket_types.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {e.ticket_types.map((t) => (
                    <TicketRow key={t.id} t={t} />
                  ))}
                </ul>
              ) : e.price_text ? (
                <p className="mt-3 text-ink-soft">{e.price_text}</p>
              ) : null}

              {e.refund_policy ? (
                <p className="mt-4 text-xs italic text-ink-muted">{e.refund_policy}</p>
              ) : null}

              <div className="mt-5">
                {e.ticket_url ? (
                  <TicketLink
                    eventId={id}
                    href={e.ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-pill px-5 py-3 text-center font-semibold text-paper transition hover:brightness-95"
                    style={{ background: EVENTS }}
                  >
                    Get tickets ↗
                  </TicketLink>
                ) : e.ticket_types.length > 0 ? (
                  <TicketButton
                    eventId={e.id}
                    eventTitle={e.title}
                    ticketTypes={e.ticket_types}
                    priceText={e.price_text}
                    isLoggedIn={!!account}
                    signInHref={`/sign-in?next=/whats-on/${e.id}`}
                  />
                ) : (
                  <p className="rounded-xl bg-sand/70 px-4 py-3 text-center text-sm text-ink-soft">
                    Tickets available at the door.
                  </p>
                )}
              </div>
            </div>
          )}

          {organiser && (
            <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
              <p className="eyebrow text-ink-muted">Organised by</p>
              <div className="mt-3 flex items-center gap-3">
                {organiser.logo_url ? (
                  <img src={organiser.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-sand font-display text-lg font-bold text-ink">
                    {organiser.name.charAt(0)}
                  </span>
                )}
                <p className="font-display text-lg font-bold">{organiser.name}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <p className="eyebrow text-ink-muted">{label}</p>
      <p className="mt-2 font-medium text-ink">{children}</p>
    </div>
  );
}

function TicketRow({ t }: { t: TicketType }) {
  const remaining = ticketTypeRemaining(t);
  const onSale = ticketTypeOnSale(t);
  const soldOut = remaining === 0;
  const almostGone = remaining !== null && remaining > 0 && remaining <= 10;
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{t.name}</p>
        {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
        <p className="mt-0.5 text-xs font-semibold">
          {soldOut ? (
            <span className="text-red-700">Sold out</span>
          ) : almostGone ? (
            <span className="text-amber-700">Only {remaining} left</span>
          ) : !onSale ? (
            <span className="text-ink-muted">Not on sale</span>
          ) : null}
        </p>
      </div>
      <span className="shrink-0 font-display text-lg font-bold" style={{ color: EVENTS }}>
        {price(t.price_pence)}
      </span>
    </li>
  );
}

function UpdateRow({ update }: { update: EventUpdate }) {
  const isUrgent = update.is_urgent || update.kind === "urgent" || update.kind === "cancellation";
  const kindLabel = UPDATE_KIND_LABELS[update.kind] ?? update.kind;
  return (
    <li className="flex gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: isUrgent ? "#b91c1c" : EVENTS }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: isUrgent ? "#b91c1c" : EVENTS }}
          >
            {kindLabel}
          </span>
          <span className="text-xs text-ink-muted">
            {new Date(update.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        </div>
        <p className="mt-0.5 font-semibold text-ink">{update.title}</p>
        {update.body && <p className="mt-0.5 text-sm text-ink-soft">{update.body}</p>}
      </div>
    </li>
  );
}
