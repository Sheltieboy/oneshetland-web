import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { FollowButton } from "@/components/activities/FollowButton";
import { WhatsOnTabs } from "@/components/activities/WhatsOnTabs";
import { HERO, REGULAR } from "@/components/activities/tokens";
import {
  CATEGORY_LABEL, SESSION_STATUS_LABEL, changeLine, changedAhead, dayLabel, dayLong, dayShort, formatPrice, joinSummary, monthGroups, movedFrom,
  nextLiveSession, patternText, safeHttps, stillToCome, timeHM, timeRange, type RuleRow, type SessionRow,
} from "@/lib/activities";
import type { ActivityDetail, Owner } from "@/lib/activities-data";

const Icon = ({ d, className = "h-4 w-4" }: { d: string; className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const PIN = "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z";
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z";
const CLOCK = "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z";
const JOIN = "M5 12h14M13 6l6 6-6 6";
const WHO = "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8";
const TAG = "M3 12V4h8l9 9-8 8-9-9z M7.5 8.5h.01";

const BADGE: Record<string, string> = {
  cancelled: "bg-rose-100 text-rose-900", break: "bg-rose-100 text-rose-900", moved: "bg-amber-100 text-amber-950", changed: "bg-amber-100 text-amber-950", extra: "bg-sky-100 text-sky-900", scheduled: "",
};

export type DetailViewProps = {
  activity: ActivityDetail; owner: Owner; rules: RuleRow[]; sessions: SessionRow[]; now: Date;
  isPublic: boolean; canManage: boolean; manageHref: string | null; signedIn: boolean; following: boolean;
};

/**
 * The public Regular Activity page. Presentational: everything shown comes from the activity itself, and a section with nothing to say is left out
 * (no invented descriptions, venues, prices or dates). Without a photo the page uses a coloured hero chosen by the kind of activity; with one, the
 * photo sits under a legible gradient. No animation, and every control is a real link, button or <details>.
 */
export function ActivityDetailView({ activity: a, owner, rules, sessions, now, isPublic, canManage, manageHref, signedIn, following }: DetailViewProps) {
  const [c1, c2] = HERO[a.category] ?? HERO.other;
  const photo = safeHttps(a.cover_url);
  const place = [a.venue, a.locality].filter(Boolean).join(", ");
  const price = formatPrice(a.price_text);
  const join = joinSummary(a);
  const ahead = stillToCome(sessions, now);
  const next = nextLiveSession(sessions, now);
  const changes = changedAhead(sessions, now);
  const preview = ahead.slice(0, 6);
  const ownerHref = owner.kind === "hub" ? `/hubs/${owner.slug || owner.id}` : owner.kind === "business" ? `/directory/${owner.slug || owner.id}` : null;
  const ownerKnown = owner.kind !== "platform" && !!owner.name;   // platform-owned or unreadable owner: say nothing about who runs it
  const nextPlace = next ? [next.venue, next.locality].filter(Boolean).join(", ") || place : place;
  const nextMoved = next ? movedFrom(next) : null;

  return (
    <div className="pb-16">
      <div className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <Link href="/whats-on/regular" className="text-sm font-semibold text-ink-soft hover:text-ink">← All regular activities</Link>
          <div className="hidden sm:block"><WhatsOnTabs active="regular" /></div>
        </div>
      </div>

      {!isPublic && (
        <div className="mx-auto max-w-5xl px-5 pt-4">
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Only you can see this.</strong>{" "}
            {a.admin_paused ? "OneShetland has paused this listing." : a.status === "draft" ? "It's a draft. Publish it from Manage when it's ready." : "It has ended."}
            {manageHref && <> <Link href={manageHref} className="font-bold underline">Open Manage</Link></>}
          </div>
        </div>
      )}

      {/* ── Introduction ───────────────────────────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative isolate mt-4 overflow-hidden text-white" style={{ background: c1 }} data-hero={photo ? "photo" : "colour"}>
        {photo && <SafeImage src={photo} alt="" loading="eager" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />}
        <div className="absolute inset-0 -z-10" style={{ background: photo ? `linear-gradient(to top, ${c2}f2 0%, ${c2}c4 34%, ${c2}7a 70%, ${c2}5c 100%)` : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }} />
        {!photo && (
          <svg aria-hidden className="absolute -right-16 -top-20 -z-10 h-80 w-80 opacity-[0.12]" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="1.2">
            <circle cx="100" cy="100" r="95" /><circle cx="100" cy="100" r="72" /><circle cx="100" cy="100" r="49" /><circle cx="100" cy="100" r="26" />
          </svg>
        )}
        <div className={"mx-auto max-w-5xl px-5 pb-16 pt-8 sm:pb-20 sm:pt-12" + (photo ? " sm:pt-24 [text-shadow:0_1px_14px_rgba(0,0,0,.45)]" : "")}>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
            <span className="rounded-pill bg-white/20 px-3 py-1 backdrop-blur-sm">{CATEGORY_LABEL[a.category] ?? "Activity"}</span>
            {a.audience && <span className="rounded-pill bg-white/15 px-3 py-1 normal-case tracking-normal backdrop-blur-sm">{a.audience}</span>}
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] sm:text-6xl">{a.title}</h1>
          {ownerKnown && (
            <p className="mt-2 text-base text-white/90">
              Run by {ownerHref ? <Link href={ownerHref} className="font-semibold underline underline-offset-2 hover:text-white">{owner.name}</Link> : <span className="font-semibold">{owner.name}</span>}
            </p>
          )}
          <ul className="mt-5 flex flex-col gap-2 text-sm text-white/95 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li className="flex items-center gap-2"><Icon d={CAL} /><span className="font-semibold">{patternText(rules)}</span></li>
            {place && <li className="flex items-center gap-2"><Icon d={PIN} /><span>{place}</span></li>}
          </ul>
          <div className="mt-6 flex flex-wrap items-start gap-4">
            {isPublic && <FollowButton activityId={a.id} slug={a.slug} signedIn={signedIn} following={following} tone="onDark" />}
            {canManage && manageHref && isPublic && <Link href={manageHref} className="rounded-pill border border-white/60 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage this activity</Link>}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5">
        {/* ── Changes ─────────────────────────────────────────────────────────────────────────────────────────────────────── */}
        {changes.length > 0 && (
          <section aria-labelledby="changes-h" className="relative z-10 -mt-8 rounded-card border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-soft sm:-mt-10">
            <h2 id="changes-h" className="flex items-center gap-2 font-display text-base font-bold sm:text-lg">
              <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-sm font-black text-white">!</span>
              {changes.some((c) => c.status === "cancelled" || c.status === "break") ? "Check before you go" : "Changes to upcoming sessions"}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {changes.slice(0, 4).map((c, i) => <li key={`${c.starts_at}-${i}`}>{changeLine(c, a.venue)}</li>)}
            </ul>
            {changes.length > 4 && <p className="mt-1 text-sm">…and {changes.length - 4} more in the full schedule below.</p>}
          </section>
        )}

        {/* ── Next session ────────────────────────────────────────────────────────────────────────────────────────────────── */}
        <section aria-labelledby="next-h" className={"relative z-10 rounded-card border border-t-[3px] border-[color-mix(in_srgb,var(--color-jobs)_26%,#fff)] border-t-[color:var(--color-jobs)] bg-[color-mix(in_srgb,var(--color-jobs)_7%,#fff)] p-5 shadow-lift sm:p-6 " + (changes.length > 0 ? "mt-4" : "-mt-10 sm:-mt-12")}>
          <p id="next-h" className="text-[11px] font-bold uppercase tracking-widest" style={{ color: REGULAR }}>Next session</p>
          {next ? (
            <div className="mt-2 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                {dayLabel(next.starts_at, now) !== dayShort(next.starts_at) && <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">{dayLabel(next.starts_at, now)}</p>}
                <p className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{dayShort(next.starts_at)}</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink"><Icon d={CLOCK} className="h-5 w-5" />{timeRange(next.starts_at, next.ends_at)}</p>
                {(nextMoved || next.status === "changed" || next.status === "extra" || next.note) && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {SESSION_STATUS_LABEL[next.status] && <span className={"rounded-pill px-3 py-1 text-xs font-bold " + BADGE[next.status]}>{SESSION_STATUS_LABEL[next.status]}</span>}
                    <span className="text-ink-soft">{[nextMoved, next.note].filter(Boolean).join(" · ")}</span>
                  </p>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {nextPlace && <div><dt className="flex items-center gap-1.5 font-semibold text-ink-soft"><Icon d={PIN} className="h-3.5 w-3.5" />Where</dt><dd className="mt-0.5 text-ink">{nextPlace}</dd></div>}
                  {price && <div><dt className="flex items-center gap-1.5 font-semibold text-ink-soft"><Icon d={TAG} className="h-3.5 w-3.5" />Cost</dt><dd className="mt-0.5 text-ink">{price}</dd></div>}
                  <div className="col-span-2"><dt className="font-semibold text-ink-soft">How to join</dt><dd className="mt-0.5 text-ink"><strong>{join.headline}.</strong> {join.detail && <span className="text-ink-soft">{join.detail}</span>}</dd></div>
                </dl>
              </div>
              {join.href && join.cta && (
                <a href={join.href} rel="noopener noreferrer" className="w-full rounded-pill px-6 py-3 text-center text-sm font-bold text-white shadow-soft transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none md:w-auto" style={{ background: REGULAR }}>{join.cta}</a>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <p className="font-display text-2xl font-bold text-ink">No sessions are scheduled right now</p>
              <p className="mt-1 text-ink-soft">{rules.length > 0 ? `This activity usually runs ${patternText(rules).toLowerCase()}, and new dates appear here as they are scheduled.` : "The organiser hasn't added any times yet."}</p>
            </div>
          )}
        </section>

        {/* ── Coming up + full schedule ───────────────────────────────────────────────────────────────────────────────────── */}
        {preview.length > 0 && (
          <section aria-labelledby="soon-h" className="mt-8">
            <h2 id="soon-h" className="font-display text-xl font-bold text-ink">Coming up</h2>
            <ol className="-mx-5 mt-3 flex scroll-pl-5 snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
              {preview.map((s, i) => {
                const off = s.status === "cancelled" || s.status === "break";
                return (
                  <li key={`${s.starts_at}-${i}`} className={"w-[7.5rem] shrink-0 snap-start rounded-xl border p-3 sm:w-auto " + (off ? "border-rose-200 bg-rose-50" : s.status === "moved" || s.status === "changed" ? "border-amber-200 bg-amber-50" : "border-line bg-paper")}>
                    <p className={"text-sm font-bold text-ink " + (off ? "line-through opacity-70" : "")}>{dayShort(s.starts_at)}</p>
                    <p className={"text-xs text-ink-soft " + (off ? "line-through opacity-70" : "")}>{timeHM(s.starts_at)}</p>
                    {SESSION_STATUS_LABEL[s.status] && <p className={"mt-1 inline-block rounded-pill px-2 py-0.5 text-[11px] font-bold " + BADGE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</p>}
                  </li>
                );
              })}
            </ol>
            {ahead.length > preview.length && (
              <details className="group mt-3 rounded-card border border-line bg-paper shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-3 text-sm font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                  <span>See the full schedule ({ahead.length} sessions)</span>
                  <span aria-hidden className="text-lg leading-none transition group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <div className="border-t border-line px-4 pb-4">
                  {monthGroups(ahead).map((g) => (
                    <div key={g.month} className="mt-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{g.month}</h3>
                      <ul className="mt-1 divide-y divide-line">
                        {g.rows.map((s, i) => {
                          const off = s.status === "cancelled" || s.status === "break";
                          const note = [movedFrom(s), s.venue && s.venue !== a.venue ? `At ${s.venue}` : null, s.note].filter(Boolean).join(" · ");
                          return (
                            <li key={`${s.starts_at}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                              <div className="min-w-0">
                                <p className={"text-sm font-semibold text-ink " + (off ? "line-through opacity-60" : "")}>{dayLong(s.starts_at)} · {timeRange(s.starts_at, s.ends_at)}</p>
                                {note && <p className="text-xs text-ink-soft">{note}</p>}
                              </div>
                              {SESSION_STATUS_LABEL[s.status] && <span className={"shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-bold " + BADGE[s.status]}>{SESSION_STATUS_LABEL[s.status]}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
        )}

        {/* ── About, where, how to join ───────────────────────────────────────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {a.description && (
            <section aria-labelledby="about-h" className="rounded-card border border-line bg-paper p-5 shadow-soft md:col-span-2">
              <h2 id="about-h" className="font-display text-xl font-bold text-ink">About</h2>
              <p className="mt-2 whitespace-pre-line text-ink-soft">{a.description}</p>
            </section>
          )}
          <div className="grid overflow-hidden rounded-card border border-line bg-paper shadow-soft md:col-span-2 md:grid-cols-2">
            <section aria-labelledby="join-h" className="border-t-[3px] border-t-[color:var(--color-events)] bg-[color-mix(in_srgb,var(--color-events)_10%,#fff)] p-5">
              <h2 id="join-h" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-events)_22%,#fff)] text-[#7a4f05]"><Icon d={JOIN} className="h-4 w-4" /></span>How to join</h2>
              <p className="mt-2 font-semibold text-ink">{join.headline}</p>
              {join.detail && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-soft">{join.detail}</p>}
              {join.href && join.cta && <a href={join.href} rel="noopener noreferrer" className="mt-3 inline-block rounded-pill px-5 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: REGULAR }}>{join.cta}</a>}
              {a.booking_mode !== "contact" && a.contact_info && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft"><span className="font-semibold text-ink">Contact:</span> {a.contact_info}</p>}
              {price && <p className="mt-3 text-sm"><span className="font-semibold text-ink">Cost:</span> <span className="text-ink-soft">{price}</span></p>}
            </section>
            {(place || a.audience) && (
              <section aria-labelledby="where-h" className="border-t-[3px] border-t-[color:var(--color-navy-light)] bg-[color-mix(in_srgb,var(--color-teal)_9%,#fff)] p-5">
                <h2 id="where-h" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-teal)_20%,#fff)] text-[color:var(--color-navy-light)]"><Icon d={place ? PIN : WHO} className="h-4 w-4" /></span>{place ? "Where" : "Who it's for"}</h2>
                {place && <p className="mt-2 text-ink">{place}</p>}
                {a.lat != null && a.lng != null && <a href={`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`} rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold underline underline-offset-2">Open in Maps</a>}
                {a.audience && <p className="mt-3 text-sm"><span className="font-semibold text-ink">Who it&apos;s for:</span> <span className="text-ink-soft">{a.audience}</span></p>}
              </section>
            )}
          </div>
          {ownerKnown && owner.kind !== "platform" && ownerHref && (
            <section aria-labelledby="org-h" className="rounded-card border border-line bg-paper p-5 shadow-soft md:col-span-2">
              <h2 id="org-h" className="font-display text-xl font-bold text-ink">Organiser</h2>
              <p className="mt-1 text-ink-soft">This activity is run by <strong className="text-ink">{owner.name}</strong>.</p>
              <Link href={ownerHref} className="mt-2 inline-block text-sm font-bold underline underline-offset-2" style={{ color: REGULAR }}>See their {owner.kind === "hub" ? "hub" : "business"} page →</Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
