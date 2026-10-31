"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNoticeDateTime, type NoticeCardModel } from "@/lib/notices-alerts";

/**
 * The reserved Essential Alert slot at the very top of the homepage. It shows the most important active alert (the database orders them) with
 * everything a person needs: what is happening, what to do, where, who issued it, and a way to read more. Several alerts: a count and previous / next.
 * Renders NOTHING when there are none (no empty bar). This is the ONLY place red/urgent styling is used for notices.
 * Server-rendered with the first alert; the switcher is progressive (the "See all" link works without scripts).
 */
export function EssentialAlertSlot({ alerts, scopedToMyAreas = false }: { alerts: NoticeCardModel[]; scopedToMyAreas?: boolean }) {
  const [i, setI] = useState(0);
  if (alerts.length === 0) return null;
  const a = alerts[Math.min(i, alerts.length - 1)];
  const many = alerts.length > 1;
  return (
    <section aria-label="Essential alert" className="bg-[#9b1c1c] text-white">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-white/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17v.5" /></svg>
            </span>
            Essential alert{many ? ` · ${i + 1} of ${alerts.length}` : ""}
          </p>
          {many && (
            <div className="flex items-center gap-1" role="group" aria-label="Switch alert">
              <button type="button" onClick={() => setI((i - 1 + alerts.length) % alerts.length)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-lg font-bold hover:bg-white/25" aria-label="Previous alert">{"‹"}</button>
              <button type="button" onClick={() => setI((i + 1) % alerts.length)} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-lg font-bold hover:bg-white/25" aria-label="Next alert">{"›"}</button>
            </div>
          )}
        </div>
        <div aria-live="polite">
          <h2 className="mt-1 break-words font-display text-2xl font-bold leading-tight sm:text-3xl">{a.title}</h2>
          <p className="mt-2 line-clamp-3 max-w-3xl break-words text-[15px] leading-relaxed text-white/95 sm:text-base">{a.body}</p>
          {a.actionText && (
            <p className="mt-3 max-w-3xl break-words rounded-xl bg-white/12 px-4 py-3 text-[15px] leading-snug sm:text-base">
              <span className="font-black">What to do: </span>{a.actionText}
            </p>
          )}
          <p className="mt-3 text-sm text-white/90">
            <span className="font-bold">{a.areaSummary}</span>
            {" · "}{a.attribution.byline}
            {a.publishedAt ? ` · ${formatNoticeDateTime(a.publishedAt)}` : ""}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-5">
          <Link href={`/notices/${a.id}`} className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">Read more</Link>
          {a.linkUrl && <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">Official information<span className="sr-only"> (opens in a new tab)</span></a>}
          <Link href="/notices?tab=essential" className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">{many ? `All ${alerts.length} alerts` : "All alerts"}</Link>
          {scopedToMyAreas && <span className="text-xs text-white/80">Showing alerts for your areas</span>}
        </div>
      </div>
    </section>
  );
}
