/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, fmtLongDateTime, fmtTime } from "@/lib/events-data";
import { SafeImage } from "@/components/ui/SafeImage";
import { getAccount } from "@/lib/auth";
import { TicketButton } from "@/components/events/TicketModal";

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

  const organiser = e.hub ?? e.business ?? null;

  return (
    <>
      {/* Cover hero */}
      <section className="relative isolate flex min-h-[44vh] flex-col justify-end overflow-hidden text-paper sm:min-h-[52vh]" style={{ background: EVENTS }}>
        {e.cover_url ? (
          <SafeImage src={e.cover_url} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />

        {/* Back */}
        <div className="absolute left-0 right-0 top-0">
          <div className="mx-auto max-w-5xl px-5 pt-5">
            <Link
              href="/whats-on"
              className="inline-flex items-center gap-2 rounded-pill bg-black/40 px-4 py-2 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-black/55"
            >
              <span aria-hidden>‹</span> What&apos;s On
            </Link>
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

      {/* Body */}
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.6fr_1fr] lg:py-16">
        {/* Main */}
        <div>
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
            </InfoCard>
            {e.age_restriction ? <InfoCard label="Age">{e.age_restriction}</InfoCard> : null}
            {e.accessibility_info ? <InfoCard label="Accessibility">{e.accessibility_info}</InfoCard> : null}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {(e.has_tickets || e.ticket_types.length > 0 || e.price_text) && (
            <div className="rounded-xl border border-line bg-paper p-6 shadow-soft">
              <h3 className="font-display text-xl font-bold">Tickets</h3>
              {e.ticket_types.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {e.ticket_types.map((t) => (
                    <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-semibold text-ink">{t.name}</p>
                        {t.description && <p className="text-sm text-ink-muted">{t.description}</p>}
                      </div>
                      <span className="shrink-0 font-display text-lg font-bold" style={{ color: EVENTS }}>
                        {price(t.price_pence)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : e.price_text ? (
                <p className="mt-3 text-ink-soft">{e.price_text}</p>
              ) : null}

              <div className="mt-5">
                {e.ticket_url ? (
                  <a
                    href={e.ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-pill px-5 py-3 text-center font-semibold text-paper transition hover:brightness-95"
                    style={{ background: EVENTS }}
                  >
                    Get tickets ↗
                  </a>
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
