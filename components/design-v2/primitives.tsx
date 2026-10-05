import type { ReactNode } from "react";
import Link from "next/link";
import { LIME, NAVY, gbp } from "@/lib/business-page/tokens";

/**
 * Presentation pieces shared by the Launch Partner Preview and Business Page V2, so the two read as one design
 * system (Fraunces display type, the navy / coral / teal / lime palette, rounded editorial cards).
 * They carry no business logic and no sales copy: anything specific is passed in by the caller.
 */

export function Img({ src, alt, className = "", style, eager = false }: { src: string; alt: string; className?: string; style?: React.CSSProperties; eager?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" className={className} style={style} />;
}

export function Section({ id, eyebrow, title, children, tone = "cream", className = "" }: { id?: string; eyebrow?: string; title?: ReactNode; children: ReactNode; tone?: "cream" | "sand" | "white" | "navy"; className?: string }) {
  const bg = { cream: "bg-transparent", sand: "bg-[#f3ece0]", white: "bg-white", navy: "text-white" }[tone];
  return (
    <section id={id} className={`relative scroll-mt-16 ${bg} ${className}`} style={tone === "navy" ? { background: `linear-gradient(135deg, ${NAVY}, #0a4a70 62%, #12667a)` } : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        {eyebrow && <p className="eyebrow" style={{ color: tone === "navy" ? LIME : "#0e9ab8" }}>{eyebrow}</p>}
        {title && <h2 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>}
        <div className={title || eyebrow ? "mt-8 sm:mt-10" : ""}>{children}</div>
      </div>
    </section>
  );
}

/** A product card. `tag` overlays the picture; `footer` sits beside the price. With `href` the whole card is a link. */
export function ProductTile({ title, price, image, blurb, big = false, tag, footer, href, accent = NAVY }: {
  title: string; price: number; image: string | null; blurb?: string; big?: boolean; tag?: ReactNode; footer?: ReactNode; href?: string; accent?: string;
}) {
  const inner = (
    <>
      <div className={"relative overflow-hidden bg-[#f3ece0] " + (big ? "aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1" : "aspect-square")}>
        {image
          ? <Img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          : <div className="absolute inset-0 grid place-items-center text-3xl" aria-hidden="true">🛍️</div>}
        {tag && <div className="absolute left-3 top-3">{tag}</div>}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className={"font-display font-bold leading-tight " + (big ? "text-2xl sm:text-3xl" : "text-lg")}>{title}</h3>
        {blurb && <p className="mt-1 text-sm text-ink-soft">{blurb}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="font-display text-xl font-bold" style={{ color: accent }}>{gbp(price)}</p>
          {footer}
        </div>
      </div>
    </>
  );
  const cls = "group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft " + (big ? "sm:col-span-2 lg:row-span-2" : "");
  return href ? <Link href={href} className={cls + " transition hover:shadow-lift"}>{inner}</Link> : <article className={cls}>{inner}</article>;
}

/** An experience / pass card: picture, gradient, title and a line beneath. */
export function MediaCard({ image, title, subtitle, price, tag }: { image: { src: string; alt: string }; title: string; subtitle: string; price?: string; tag?: ReactNode }) {
  return (
    <div className="relative block overflow-hidden rounded-2xl shadow-lift">
      <div className="relative aspect-[16/11]">
        <Img src={image.src} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {tag && <span className="absolute left-3 top-3">{tag}</span>}
        {price && <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-black text-ink shadow">{price}</span>}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">{title}</p>
          <p className="mt-1 text-sm font-medium text-white/85">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/** A booking entry card (as the Book pillar shows it). `status` is the small chip on the left; `action` the button word. */
export function ReserveCard({ heading, kind, cta, businessName, tag, status, buttonLabel }: { heading: string; kind: string; cta: string; businessName: string; tag?: ReactNode; status: ReactNode; buttonLabel: string }) {
  return (
    <div className="flex max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
      <div className="relative flex items-end justify-between px-4 pb-3 pt-9 text-white" style={{ background: "linear-gradient(135deg, #059669, #064e3b)" }}>
        {tag && <span className="absolute left-3 top-3">{tag}</span>}
        <span className="font-display text-3xl font-black leading-none">{heading}</span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">{kind}</span>
      </div>
      <div className="p-4">
        <p className="font-display text-lg font-bold leading-snug text-ink">{cta}</p>
        <p className="mt-0.5 text-xs font-medium text-ink-muted">{businessName}</p>
        <div className="mt-3 flex items-center justify-between">
          {status}
          <span className="rounded-full bg-[#059669] px-3.5 py-1.5 text-xs font-bold text-white">{buttonLabel}</span>
        </div>
      </div>
    </div>
  );
}
