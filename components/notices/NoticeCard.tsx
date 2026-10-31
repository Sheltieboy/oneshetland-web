import Link from "next/link";
import type { ReactNode } from "react";
import { formatNoticeDate, formatNoticeDateTime, type NoticeCardModel } from "@/lib/notices-alerts";

/**
 * One notice. Two shapes of the same card:
 *   compact  the homepage grid: equal-sized cards (title and body clamped). A notice WITH a destination is a link to it; one WITHOUT is a plain,
 *            non-interactive block (existing rule: never a link to an unrelated section).
 *   full     the Notices page and detail: nothing clamped, what to do, source and publisher links. The title opens the notice's own page.
 * Official ("Issued by ...") notices carry a quiet navy tint; community cards are plain paper. Red is reserved for the Essential Alert slot.
 */

function Mark({ n }: { n: NoticeCardModel }) {
  const a = n.attribution;
  const bg = a.brandColor ?? (a.kind === "official" ? "#0a4a70" : a.kind === "hub" ? "#6b47bf" : "#6b7280");
  if (a.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-md bg-white object-cover" />;
  }
  return <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-black text-white" style={{ background: bg }}>{a.label.slice(0, 1).toUpperCase()}</span>;
}

function Byline({ n }: { n: NoticeCardModel }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Mark n={n} />
      <span className={"min-w-0 truncate text-[11px] font-black uppercase tracking-widest " + (n.attribution.kind === "official" ? "text-navy-light" : "text-ink-muted")}>{n.attribution.byline}</span>
    </div>
  );
}

function CategoryChip({ label }: { label: string | null }) {
  if (!label) return null;
  return <span className="inline-flex w-fit rounded-pill bg-sand px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">{label}</span>;
}

export function NoticeCard({ n, variant = "compact", now, detail = false }: { n: NoticeCardModel; variant?: "compact" | "full"; now?: Date; detail?: boolean }) {
  const tint = n.attribution.kind === "official" ? "border-navy/15 bg-[#f3f8fb]" : "border-line bg-paper";
  const when = formatNoticeDate(n.publishedAt, now ?? new Date());

  if (variant === "compact") {
    const body = (
      <>
        <Byline n={n} />
        <div className="mt-3"><CategoryChip label={n.categoryLabel} /></div>
        <h3 className="mt-2 line-clamp-2 break-words font-display text-xl font-bold leading-snug text-ink">{n.title}</h3>
        <p className="mt-2 line-clamp-3 break-words text-[15px] leading-relaxed text-ink-soft">{n.body}</p>
        <div className="mt-auto pt-4">
          <p className="truncate text-xs font-semibold text-ink-muted">{[n.areaSummary, when].filter(Boolean).join(" · ")}</p>
          {n.destination && <p className="mt-1 text-sm font-bold text-navy-light">{n.destination.label} <span aria-hidden>{"→"}</span></p>}
        </div>
      </>
    );
    const cls = `flex h-full min-w-0 flex-col rounded-card border p-5 shadow-soft ${tint}`;
    return n.destination
      ? <Link href={n.destination.href} className={cls + " transition hover:shadow-lift"}>{body}</Link>
      : <article className={cls}>{body}</article>;
  }

  return (
    <article className={`min-w-0 rounded-card border p-5 shadow-soft sm:p-6 ${tint}`} id={`notice-${n.id}`}>
      <Byline n={n} />
      <div className="mt-3 flex flex-wrap items-center gap-2"><CategoryChip label={n.categoryLabel} />{n.level === 2 && <span className="rounded-pill bg-navy/10 px-2.5 py-0.5 text-[11px] font-bold text-navy">Health &amp; official</span>}</div>
      {detail
        ? <h1 className="mt-2 break-words font-display text-3xl font-bold leading-snug text-ink">{n.title}</h1>
        : <h2 className="mt-2 break-words font-display text-2xl font-bold leading-snug text-ink"><Link href={`/notices/${n.id}`} className="hover:underline">{n.title}</Link></h2>}
      <p className="mt-3 whitespace-pre-line break-words text-base leading-relaxed text-ink-soft">{n.body}</p>
      {n.actionText && (
        <div className="mt-4 rounded-xl bg-sand/70 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-ink-muted">What to do</p>
          <p className="mt-1 whitespace-pre-line break-words text-base text-ink">{n.actionText}</p>
        </div>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        {n.areaSummary && <span className="font-semibold text-ink-soft">{n.areaSummary}</span>}
        {[when ? `Posted ${when}` : null, n.expiresAt ? `Until ${formatNoticeDateTime(n.expiresAt)}` : null].filter(Boolean).map((t, i) => <span key={i}>{n.areaSummary || i > 0 ? " · " : ""}{t}</span>)}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-5">
        {n.destination && <ActionLink href={n.destination.href}>{n.destination.label}</ActionLink>}
        {n.attribution.sourceUrl && <ActionLink href={n.attribution.sourceUrl} external>View at source</ActionLink>}
        {n.linkUrl && n.linkUrl !== n.attribution.sourceUrl && <ActionLink href={n.linkUrl} external>More information</ActionLink>}
      </div>
    </article>
  );
}

export function ActionLink({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  const cls = "inline-flex min-h-[44px] items-center text-sm font-bold text-navy-light underline underline-offset-2 hover:text-navy";
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}<span className="sr-only"> (opens in a new tab)</span></a>
    : <Link href={href} className={cls}>{children}</Link>;
}
