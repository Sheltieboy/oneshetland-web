import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { CruiseTodayCard } from "@/components/cruise/CruiseTodayCard";
import { getCruiseHomeCard } from "@/lib/cruise-data";
import { CRUISE_ACCENT } from "@/lib/cruise-shared";
import {
  type HomeData,
  type HomeContent,
  formatEventDate,
  formatEventTime,
  offerBadge,
} from "@/lib/home-data";
import { type GamePrompt } from "@/lib/home-extras";

/* The three editable promo tiles are managed in the admin control centre
   (/admin/homepage) and stored in the `home_content` table — see buildPromo().
   A blank tile renders nothing so the mosaic stays clean on the live site. */
type WelcomePromo = { eyebrow: string; title: string; body: string; href: string; cta: string };
type FeaturePromo = { eyebrow: string; title: string; image: string; href: string };
type SpotlightPromo = { eyebrow: string; title: string; body: string; image: string; href: string; cta: string };

function buildPromo(c: HomeContent | null) {
  return {
    welcome: { eyebrow: "Welcome", title: c?.welcome_title ?? "", body: c?.welcome_body ?? "", href: c?.welcome_href ?? "", cta: c?.welcome_cta ?? "" } as WelcomePromo,
    feature: { eyebrow: "Featured", title: c?.feature_title ?? "", image: c?.feature_image ?? "", href: c?.feature_href ?? "" } as FeaturePromo,
    spotlight: { eyebrow: "Spotlight", title: c?.spotlight_title ?? "", body: c?.spotlight_body ?? "", image: c?.spotlight_image ?? "", href: c?.spotlight_href ?? "", cta: c?.spotlight_cta || "Find out more" } as SpotlightPromo,
  };
}

const ACCENT = {
  cruise: "#0e6ea6",
  games: "var(--color-games)",
  events: "#d4921a",
  local: "#7c3aed",
  spik: "var(--color-spik)",
  work: "#2a8b5c",
  navy: "#032f4c",
};

// Section-coloured hover: each card/row tints toward its OWN accent on hover
// instead of a neutral grey, so the mosaic comes alive as you move across it.
// `tint(accent)` sets the CSS vars (color-mix works with hex and var() accents);
// HOVER_TINT applies them to background + border on hover.
const HOVER_TINT = "hover:bg-[var(--tint)] hover:border-[var(--tint-strong)]";
const HOVER_TINT_BG = "hover:bg-[var(--tint)]";
// Clean warm-neutral cards; a faint section-colour wash appears only on hover
// (the resting warmth comes from photography + serif, not flat colour fills).
const CARD_TINT = "bg-paper border-line";
function tint(accent: string): React.CSSProperties {
  return {
    "--tint": `color-mix(in srgb, ${accent} 10%, transparent)`,
    "--tint-strong": `color-mix(in srgb, ${accent} 35%, transparent)`,
  } as React.CSSProperties;
}

// Keeps overlaid text legible on ANY photo (bright, busy, or dark): a scrim at
// BOTH ends where text sits, paired with TSHADOW on the text itself.
const TSHADOW = "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.7),_0_2px_12px_rgb(0_0_0_/_0.6)]";
function PhotoScrim() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
    </>
  );
}

export async function HomeBento({ data, game, content }: { data: HomeData; game: GamePrompt; content: HomeContent | null }) {
  const promo = buildPromo(content);
  // When a ship is in port TODAY the cruise tile is escalated above the other
  // equal-weight tiles — mirrors the app's CruiseTodayCard "in port today" accent.
  const cruiseCard = await getCruiseHomeCard();
  const shipInToday = Boolean(cruiseCard?.isToday);
  const { events, businesses, offers, notices, campaigns, jobs, shifts, spik } = data;
  const featured = events[0];
  // Fundraisers get their own progress-bar card, so drop notices that just
  // re-announce an active campaign (avoids the same appeal appearing twice).
  const campaignTitles = campaigns.map((c) => c.title.toLowerCase());
  const visibleNotices = notices.filter(
    (n) => !campaignTitles.some((t) => n.title.toLowerCase().includes(t)),
  );
  const work = [
    ...jobs.slice(0, 2).map((j) => ({ kind: "job" as const, id: j.id, title: j.title, sub: `${j.location || "Shetland"}${j.pay_text ? ` · ${j.pay_text}` : ""}` })),
    ...shifts.slice(0, 2).map((s) => ({ kind: "shift" as const, id: s.id, title: s.title, sub: `${s.location_text || "Shetland"}${s.pay_text ? ` · ${s.pay_text}` : ""}` })),
  ].slice(0, 4);

  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[200px] lg:grid-flow-dense lg:grid-cols-4">

        {/* ── Editable welcome copy ─────────────────────────────────── */}
        <PromoCopyTile p={promo.welcome} className="lg:col-span-2" />

        {/* ── In port today (cruise) — self-contained tile ──────────── */}
        {/* When a ship is in port TODAY the tile is escalated: a coloured ring
            + "Ship in today" badge lift it above the equal-weight tiles. */}
        {shipInToday ? (
          <div
            className="relative h-full rounded-2xl p-1 shadow-lift lg:col-span-2 lg:row-span-2"
            style={{ background: `linear-gradient(135deg, ${CRUISE_ACCENT}, ${CRUISE_ACCENT}66)` }}
          >
            <span
              className="absolute -top-2 left-4 z-10 rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-soft"
              style={{ background: CRUISE_ACCENT }}
            >
              Ship in today
            </span>
            <CruiseTodayCard className="h-full" />
          </div>
        ) : (
          <CruiseTodayCard className="h-full lg:col-span-2 lg:row-span-2" />
        )}

        {/* ── Featured event — big, with cover image ────────────────── */}
        {featured && (
          <Link
            href={`/whats-on/${featured.id}`}
            className="group relative flex overflow-hidden rounded-2xl border border-line bg-events/10 shadow-soft transition hover:shadow-lift sm:col-span-2 lg:col-span-2 lg:row-span-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <SafeImage src={featured.cover_url || "/heroes/events.jpg"} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<img src="/heroes/events.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />} />
            <PhotoScrim />
            <div className="relative mt-auto p-5 text-paper">
              <span className="inline-block rounded-pill bg-paper/95 px-3 py-1 text-xs font-bold text-events">{formatEventDate(featured.starts_at)}</span>
              <h3 className={`mt-3 font-display text-2xl font-bold leading-tight ${TSHADOW}`}>{featured.title}</h3>
              <p className={`mt-1 text-sm text-white/90 ${TSHADOW}`}>{formatEventTime(featured.starts_at)}{featured.venue ? ` · ${featured.venue}` : ""}</p>
            </div>
            <Eyebrow className={`absolute left-5 top-5 !text-white/95 ${TSHADOW}`}>What&apos;s on</Eyebrow>
          </Link>
        )}

        {/* ── Today's game — self-contained tile ────────────────────── */}
        <GamePromptCard game={game} className="h-full lg:col-span-2" />

        {/* ── Spik o' da day ────────────────────────────────────────── */}
        {spik && (
          <TileLink href="/spik" className="lg:col-span-2" accent={ACCENT.spik}>
            <Eyebrow accent={ACCENT.spik}>Spik o&apos; da day</Eyebrow>
            <p className="mt-2 font-display text-3xl font-bold text-spik">{spik.word}</p>
            <p className="mt-1 line-clamp-1 text-ink">{spik.meaning}</p>
            {spik.example && <p className="mt-2 line-clamp-1 border-l-2 border-spik/40 pl-2 text-sm italic text-ink-soft">&ldquo;{spik.example}&rdquo;</p>}
            <Arrow accent={ACCENT.spik}>Mair o da dialect</Arrow>
          </TileLink>
        )}

        {/* ── Editable feature image (tall) ─────────────────────────── */}
        <PromoImageTile p={promo.feature} className="sm:col-span-2 lg:col-span-2 lg:row-span-2" />

        {/* ── Featured business ─────────────────────────────────────── */}
        {businesses[0] && (
          <Link href="/directory" className="group relative flex overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift lg:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <SafeImage src={businesses[0].cover_url || "/heroes/local.jpeg"} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" fallback={<img src="/heroes/local.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" />} />
            <PhotoScrim />
            <div className="relative mt-auto flex items-end gap-3 p-5 text-paper">
              {businesses[0].logo_url && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/40 bg-white/10 backdrop-blur">
                  <SafeImage src={businesses[0].logo_url} className="h-full w-full object-cover" fallback={<BizArt name={businesses[0].name} />} />
                </div>
              )}
              <div className="min-w-0">
                <h3 className={`truncate font-display text-xl font-bold leading-tight ${TSHADOW}`}>{businesses[0].name}</h3>
                {businesses[0].category && <p className={`truncate text-sm capitalize text-white/90 ${TSHADOW}`}>{businesses[0].category.replace(/_/g, " ")}</p>}
              </div>
            </div>
            <Eyebrow className={`absolute left-5 top-5 !text-white/95 ${TSHADOW}`}>Shop &amp; eat local</Eyebrow>
          </Link>
        )}

        {/* ── Offers ────────────────────────────────────────────────── */}
        {offers.length > 0 && (
          <ListCard eyebrow="Worth a look" accent={ACCENT.local} href="/local" className="lg:col-span-2">
            <ul className="mt-3 space-y-1">
              {offers.slice(0, 2).map((o) => (
                <li key={o.id}>
                  <Link href={o.business ? `/directory/${o.business.id}` : "/local"} style={tint(ACCENT.local)} className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition ${HOVER_TINT_BG}`}>
                    <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-local/10 text-center text-[11px] font-bold leading-tight text-local">{offerBadge(o)}</span>
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-local/10">
                      {o.business?.logo_url ? (
                        <SafeImage src={o.business.logo_url} alt="" className="h-full w-full object-cover" fallback={<BizAvatar name={o.business?.name} />} />
                      ) : <BizAvatar name={o.business?.name} />}
                    </span>
                    <span className="min-w-0"><span className="block truncate font-semibold text-ink">{o.title}</span>{o.business?.name && <span className="block truncate text-xs text-ink-muted">{o.business.name}</span>}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </ListCard>
        )}

        {/* ── Fundraisers — each row carries a live progress bar ───────── */}
        {campaigns.length > 0 && (
          <ListCard eyebrow="Chip in" accent={ACCENT.work} href="/hubs/campaigns" className="lg:col-span-2">
            <ul className="mt-3 space-y-2.5">
              {campaigns.slice(0, 2).map((c) => {
                const pct = c.goal_pence > 0 ? Math.min(100, Math.round((c.raised_pence / c.goal_pence) * 100)) : 0;
                const bar = c.brand_color || "#2a8b5c";
                return (
                  <li key={c.id}>
                    <Link href={`/hubs/campaign/${c.id}`} style={tint(bar)} className={`-mx-2 block rounded-xl px-2 py-1.5 transition ${HOVER_TINT_BG}`}>
                      <span className="line-clamp-1 block font-semibold text-ink">{c.title}</span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: bar }} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        <b className="text-ink">£{Math.round(c.raised_pence / 100).toLocaleString()}</b> of £{Math.round(c.goal_pence / 100).toLocaleString()} · {pct}% · {c.hub}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ListCard>
        )}

        {/* ── Community notices (taller list) ───────────────────────── */}
        {visibleNotices.length > 0 && (
          <ListCard eyebrow="The latest fae da isles" accent={ACCENT.navy} href="/local" className="lg:col-span-2">
            <ul className="mt-3 space-y-1">
              {visibleNotices.slice(0, 2).map((n) => (
                <li key={n.id}>
                  <Link href="/local" style={tint(n.brand_color || ACCENT.cruise)} className={`-mx-2 block rounded-xl px-2 py-2 transition ${HOVER_TINT_BG}`}>
                    <span className="block border-l-2 pl-3" style={{ borderColor: n.brand_color || "#0e6ea6" }}>
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
                        <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${n.brand_color || "#0e6ea6"} 18%, transparent)` }}>
                          {n.logo_url ? (
                            <SafeImage src={n.logo_url} alt="" className="h-full w-full object-cover" fallback={<PublisherDot name={n.publisher} color={n.brand_color} />} />
                          ) : <PublisherDot name={n.publisher} color={n.brand_color} />}
                        </span>
                        <span className="truncate">{n.publisher}{n.locality ? ` · ${n.locality}` : ""}</span>
                      </span>
                      <span className="line-clamp-1 block font-semibold text-ink">{n.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </ListCard>
        )}

        {/* ── Work — jobs & shifts (taller list) ────────────────────── */}
        {work.length > 0 && (
          <ListCard eyebrow="Work" accent={ACCENT.work} href="/jobs" className="lg:col-span-2">
            <ul className="mt-3 space-y-2.5">
              {work.slice(0, 2).map((w) => (
                <li key={w.id}>
                  <Link href={w.kind === "shift" ? `/shifts/${w.id}` : `/jobs/${w.id}`} style={tint(ACCENT.work)} className={`flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 transition ${HOVER_TINT}`}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {w.kind === "shift" && <span className="rounded-pill bg-shifts/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-shifts">Shift</span>}
                        <span className="truncate font-semibold text-ink">{w.title}</span>
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{w.sub}</span>
                    </span>
                    <span aria-hidden className="shrink-0 text-ink-faint">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </ListCard>
        )}

        {/* ── Editable spotlight ────────────────────────────────────── */}
        <PromoSpotlightTile p={promo.spotlight} className="lg:col-span-2" />

        {/* ── Second event (compact) ────────────────────────────────── */}
        {events[1] && (
          <TileLink href={`/whats-on/${events[1].id}`} className="lg:col-span-2" accent={ACCENT.events}>
            <Eyebrow accent={ACCENT.events}>Also on</Eyebrow>
            <h3 className="mt-2 line-clamp-2 font-display text-xl font-bold leading-snug">{events[1].title}</h3>
            <p className="mt-1 text-sm text-ink-muted">{formatEventDate(events[1].starts_at)} · {formatEventTime(events[1].starts_at)}{events[1].venue ? ` · ${events[1].venue}` : ""}</p>
          </TileLink>
        )}
      </div>
    </section>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */
function Eyebrow({ children, accent, className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
  // Quiet editorial overline (letter-spaced small caps), not a coloured chip —
  // the warmth comes from photography + serif headlines, not label fills.
  void accent;
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted ${className}`}>{children}</span>
  );
}

function Arrow({ children, accent }: { children: React.ReactNode; accent: string }) {
  return <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold" style={{ color: accent }}>{children} <span aria-hidden>→</span></span>;
}

/** A tile shell. `bare` skips inner padding/border (for cards that bring their own). */
function TileLink({ href, children, className = "", accent, bare = false }: { href?: string; children: React.ReactNode; className?: string; accent?: string; bare?: boolean }) {
  const cls = bare
    ? `group relative overflow-hidden rounded-2xl border ${CARD_TINT} shadow-soft transition ${HOVER_TINT} hover:shadow-lift ${className}`
    : `group relative flex h-full flex-col overflow-hidden rounded-2xl border ${CARD_TINT} p-5 shadow-soft transition hover:-translate-y-0.5 ${HOVER_TINT} hover:shadow-lift ${className}`;
  const style = tint(accent ?? ACCENT.navy);
  return href ? <Link href={href} className={cls} style={style}>{children}</Link> : <div className={cls} style={style}>{children}</div>;
}

/** A non-link card shell for LIST tiles: the header links to the section, and
 *  each row inside is its own hover-shaded link to a specific item. (A single
 *  whole-card <Link> can't wrap per-row links — nested <a> is invalid HTML.) */
function ListCard({ eyebrow, accent, href, className = "", children }: { eyebrow: string; accent: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-full flex-col rounded-2xl border ${CARD_TINT} p-5 shadow-soft ${className}`} style={tint(accent)}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow accent={accent}>{eyebrow}</Eyebrow>
        {href && <Link href={href} className="shrink-0 text-xs font-semibold text-ink-muted transition hover:text-ink">See all →</Link>}
      </div>
      {children}
    </div>
  );
}

function BizArt({ name }: { name: string }) {
  return <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-local">{name.charAt(0)}</div>;
}
/** Small round avatar fallback for an offer's business (used at h-9/w-9). */
function BizAvatar({ name }: { name?: string | null }) {
  return <div className="flex h-full w-full items-center justify-center text-sm font-bold text-local">{(name ?? "?").charAt(0).toUpperCase()}</div>;
}
/** Tiny brand-colour dot/initial fallback for a notice publisher (used at h-5/w-5). */
function PublisherDot({ name, color }: { name?: string | null; color?: string | null }) {
  return <span className="text-[9px] font-bold leading-none" style={{ color: color || "#0e6ea6" }}>{(name ?? "?").charAt(0).toUpperCase()}</span>;
}

function GamePromptCard({ game, className = "" }: { game: GamePrompt; className?: string }) {
  return (
    <Link
      href={game.href}
      className={`group flex items-center gap-4 overflow-hidden rounded-2xl p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift hover:brightness-[1.07] ${className}`}
      style={{ background: "var(--color-games)" }}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-white">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Today&apos;s game</p>
        <h3 className="font-display text-xl font-bold">{game.title}</h3>
        <p className="truncate text-sm text-white/85">{game.sub}</p>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-games transition group-hover:translate-x-0.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </Link>
  );
}

/* ── Editable promo tiles ─────────────────────────────────────────────────── */
function isSet(s: string | undefined) { return !!s && s.trim().length > 0; }

function PromoCopyTile({ p, className = "" }: { p: WelcomePromo; className?: string }) {
  if (!isSet(p.title) && !isSet(p.body)) return null;
  const inner = (
    <>
      <Eyebrow accent={ACCENT.navy}>{p.eyebrow}</Eyebrow>
      {isSet(p.title) && <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{p.title}</h3>}
      {isSet(p.body) && <p className="mt-2 text-ink-soft">{p.body}</p>}
      {isSet(p.cta) && isSet(p.href) && <Arrow accent={ACCENT.navy}>{p.cta}</Arrow>}
    </>
  );
  return isSet(p.href)
    ? <Link href={p.href} style={tint(ACCENT.navy)} className={`group flex h-full flex-col rounded-2xl border ${CARD_TINT} p-5 shadow-soft transition ${HOVER_TINT} hover:shadow-lift ${className}`}>{inner}</Link>
    : <div style={tint(ACCENT.navy)} className={`flex h-full flex-col rounded-2xl border ${CARD_TINT} p-5 shadow-soft ${className}`}>{inner}</div>;
}

function PromoImageTile({ p, className = "" }: { p: FeaturePromo; className?: string }) {
  if (!isSet(p.image)) return null;
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.image} alt={p.title || ""} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      {isSet(p.title) && (
        <>
          <PhotoScrim />
          <p className={`relative mt-auto p-5 font-display text-xl font-bold text-paper ${TSHADOW}`}>{p.title}</p>
        </>
      )}
    </>
  );
  const cls = `group relative flex min-h-[12rem] overflow-hidden rounded-2xl border border-line shadow-soft transition hover:shadow-lift ${className}`;
  return isSet(p.href) ? <Link href={p.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function PromoSpotlightTile({ p, className = "" }: { p: SpotlightPromo; className?: string }) {
  if (!isSet(p.title) && !isSet(p.body)) return null;
  const inner = (
    <>
      <Eyebrow accent="#c2410c">{p.eyebrow}</Eyebrow>
      <div className="mt-2 flex gap-3">
        {isSet(p.image) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          {isSet(p.title) && <h3 className="font-display text-lg font-bold leading-snug">{p.title}</h3>}
          {isSet(p.body) && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.body}</p>}
          {isSet(p.cta) && isSet(p.href) && <Arrow accent="#c2410c">{p.cta}</Arrow>}
        </div>
      </div>
    </>
  );
  const cls = `group flex h-full flex-col rounded-2xl border ${CARD_TINT} p-5 shadow-soft ${isSet(p.href) ? `transition ${HOVER_TINT} hover:shadow-lift` : ""} ${className}`;
  return isSet(p.href)
    ? <Link href={p.href} style={tint("#c2410c")} className={cls}>{inner}</Link>
    : <div style={tint("#c2410c")} className={cls}>{inner}</div>;
}
