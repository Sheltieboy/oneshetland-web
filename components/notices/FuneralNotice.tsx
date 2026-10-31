import Link from "next/link";
import type { FuneralView } from "@/lib/notices-alerts";
import { formatNoticeDate } from "@/lib/notices-alerts";

/**
 * The traditional funeral-announcement template: quiet, like a notice in a shop window or the newspaper. Serif name, an ornamental rule, generous
 * spacing, a restrained palette (warm parchment, deep slate, muted burgundy) - no emergency colours, no promotion, no animation, nothing that moves
 * (so prefers-reduced-motion needs nothing). An optional small oval portrait. Arrangements appear ONLY when the family chose to publish them.
 * It renders a FuneralView, which is a whitelist: nothing private can reach this file.
 */
const PARCH = "#f6f0e4", SLATE = "#2b3a47", BURG = "#7a2c3b", RULE = "#cdbfa6";

export function OrnamentalRule() {
  return (
    <div aria-hidden className="mx-auto my-5 flex w-48 items-center gap-3">
      <span className="h-px flex-1" style={{ background: RULE }} />
      <span className="h-2 w-2 rotate-45" style={{ background: BURG }} />
      <span className="h-px flex-1" style={{ background: RULE }} />
    </div>
  );
}

function Portrait({ url }: { url: string | null }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="mx-auto mb-5 h-36 w-28 rounded-[50%] border-2 object-cover" style={{ borderColor: RULE }} />;
}

export function FuneralHeadline({ v, as: H = "h2" }: { v: FuneralView; as?: "h1" | "h2" }) {
  return (
    <div className="text-center">
      <H className="break-words font-display text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: SLATE }}>{v.fullName}</H>
      {v.knownAs && <p className="mt-1 font-display text-lg italic" style={{ color: BURG }}>known as {v.knownAs}</p>}
      {v.lifeSpan && <p className="mt-2 text-sm tracking-wide" style={{ color: SLATE }}>{v.lifeSpan}</p>}
    </div>
  );
}

/** A listing entry: the name, the dates, the first lines of the announcement, the place. */
export function FuneralCard({ v }: { v: FuneralView }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-sm border px-6 py-8 text-center shadow-soft" style={{ background: PARCH, borderColor: RULE }}>
      <Portrait url={v.photoUrl} />
      <FuneralHeadline v={v} />
      <OrnamentalRule />
      {v.announcement && <p className="line-clamp-3 break-words text-[15px] leading-relaxed" style={{ color: SLATE }}>{v.announcement}</p>}
      <div className="mt-auto pt-5">
        {v.areaName && <p className="text-sm" style={{ color: BURG }}>{v.areaName}</p>}
        <Link href={`/notices/funeral/${v.id}`} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-2" style={{ color: SLATE }}>
          Read the announcement<span className="sr-only"> for {v.fullName}</span>
        </Link>
      </div>
    </article>
  );
}

export function FuneralAnnouncement({ v }: { v: FuneralView }) {
  const a = v.arrangements;
  return (
    <article className="mx-auto max-w-2xl rounded-sm border px-6 py-10 sm:px-12 sm:py-14" style={{ background: PARCH, borderColor: RULE }}>
      <Portrait url={v.photoUrl} />
      <FuneralHeadline v={v} as="h1" />
      <OrnamentalRule />
      {v.announcement && <p className="whitespace-pre-line break-words text-center font-display text-lg leading-loose" style={{ color: SLATE }}>{v.announcement}</p>}

      {a && (
        <section aria-label="Arrangements" className="mt-8 text-center">
          <h2 className="font-display text-xl font-semibold" style={{ color: BURG }}>{a.kindLabel ?? "Arrangements"}</h2>
          <div className="mt-3 space-y-1.5 text-base leading-relaxed" style={{ color: SLATE }}>
            {a.when && <p>{a.when}</p>}
            {a.venue && <p>{a.venue}</p>}
            {a.notes && <p className="whitespace-pre-line break-words pt-1 italic">{a.notes}</p>}
          </div>
        </section>
      )}

      {(v.familyRequests || v.donationInfo) && (
        <section aria-label="Family requests" className="mt-8 text-center text-base leading-relaxed" style={{ color: SLATE }}>
          {v.familyRequests && <p className="whitespace-pre-line break-words">{v.familyRequests}</p>}
          {v.donationInfo && <p className="mt-2 whitespace-pre-line break-words">{v.donationInfo}</p>}
          {v.donationUrl && (
            <p className="mt-2"><a href={v.donationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-2" style={{ color: BURG }}>Donation page<span className="sr-only"> (opens in a new tab)</span></a></p>
          )}
        </section>
      )}

      <OrnamentalRule />
      <p className="text-center text-sm" style={{ color: SLATE }}>
        {v.areaName ? <>{v.areaName}</> : null}
        {v.areaName && v.publishedAt ? " · " : ""}
        {v.publishedAt ? <>Announced {formatNoticeDate(v.publishedAt)}</> : null}
      </p>
    </article>
  );
}
