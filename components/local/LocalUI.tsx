/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CATEGORY_LABEL, offerBadge, type Business, type Offer } from "@/lib/local-data";

const LOCAL = "#7c3aed";

function VerifiedTick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={LOCAL} className="shrink-0" aria-label="Verified">
      <path d="M12 2l2.4 1.8 3 .2.2 3L21.4 12 19.6 15l-.2 3-3 .2L12 22l-2.4-1.8-3-.2-.2-3L4.6 12 6.4 9l.2-3 3-.2z" />
      <path d="M9.5 12.5l1.8 1.8 3.4-3.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AddonChips({ b, className = "" }: { b: Business; className?: string }) {
  const chips: string[] = [];
  if (b.accepts_bookings) chips.push("Book online");
  if (b.accepts_wallet && b.cashback_percent > 0) chips.push(`${b.cashback_percent}% cashback`);
  if (chips.length === 0) return null;
  return (
    <div className={"flex flex-wrap gap-1.5 " + className}>
      {chips.map((c) => (
        <span key={c} className="rounded-pill bg-local/12 px-2.5 py-0.5 text-xs font-semibold text-local">
          {c}
        </span>
      ))}
    </div>
  );
}

export function BusinessCard({ b }: { b: Business }) {
  const href = `/directory/${b.slug ?? b.id}`;
  const accent = b.brand_color && /^#?[0-9a-f]{6}$/i.test(b.brand_color)
    ? (b.brand_color.startsWith("#") ? b.brand_color : `#${b.brand_color}`)
    : LOCAL;
  return (
    <div className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative h-32 overflow-hidden" style={{ background: `${accent}1a` }}>
          {b.cover_url ? (
            <img src={b.cover_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }} />
          )}
          {b.subscription_tier === "premium" && (
            <span className="absolute right-3 top-3 rounded-pill bg-paper/95 px-2.5 py-1 text-xs font-bold text-local shadow-sm">
              ★ Featured
            </span>
          )}
        </div>
        <div className="relative flex flex-1 flex-col p-4">
          {b.logo_url && (
            <img
              src={b.logo_url}
              alt=""
              className="absolute -top-7 left-4 h-12 w-12 rounded-xl border-2 border-paper bg-paper object-cover shadow-sm"
            />
          )}
          <div className={b.logo_url ? "mt-6" : ""}>
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-lg font-bold">{b.name}</h3>
              {b.is_verified && <VerifiedTick />}
            </div>
            {b.category && <p className="text-sm text-ink-muted">{CATEGORY_LABEL[b.category] ?? b.category}</p>}
            {b.description && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{b.description}</p>}
            <AddonChips b={b} className="mt-3" />
          </div>
        </div>
      </Link>

      {/* Unclaimed listings invite a claim; hidden once claimed + verified. */}
      {!b.is_claimed && (
        <Link
          href={`${href}#claim`}
          className="flex items-center justify-center gap-1.5 border-t border-dashed border-local/40 bg-local/5 px-4 py-2.5 text-xs font-bold text-local transition hover:bg-local/12"
        >
          Own this business? Claim this listing →
        </Link>
      )}
    </div>
  );
}

export function OfferCard({ o }: { o: Offer }) {
  const href = o.business ? `/directory/${o.business.slug ?? o.business.id}` : "/directory";
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-local/10 text-center font-display text-sm font-bold leading-tight text-local">
        {o.image_url ? <img src={o.image_url} alt="" className="h-full w-full object-cover" /> : offerBadge(o)}
      </div>
      <div className="min-w-0 flex-1">
        <span className="rounded-pill bg-local/12 px-2 py-0.5 text-xs font-bold text-local">{offerBadge(o)}</span>
        <h3 className="mt-1.5 font-display text-lg font-bold leading-snug">{o.title}</h3>
        {o.business?.name && <p className="text-sm text-ink-muted">{o.business.name}</p>}
      </div>
    </Link>
  );
}

export function CategoryTile({ cat, count }: { cat: { key: string; label: string }; count?: number }) {
  return (
    <Link
      href={`/directory?category=${cat.key}`}
      className="group flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-5 py-4 shadow-soft transition hover:-translate-y-0.5 hover:border-local/40 hover:shadow-lift"
    >
      <div>
        <p className="font-display text-lg font-bold">{cat.label}</p>
        {count !== undefined && <p className="text-sm text-ink-muted">{count} listing{count === 1 ? "" : "s"}</p>}
      </div>
      <span aria-hidden className="text-local transition group-hover:translate-x-0.5">→</span>
    </Link>
  );
}
