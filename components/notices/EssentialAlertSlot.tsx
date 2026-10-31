"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNoticeDateTime, planEssentialSlot, type NoticeCardModel } from "@/lib/notices-alerts";

/**
 * The reserved Essential Alert slot at the very top of the homepage. The most recent alert is shown in full (what is happening, what to do, where,
 * who issued it, how to read more). With several concurrent alerts the others are compact one-line rows (title + areas) that expand in place, under a
 * count heading ("3 essential alerts"), so a phone never gets a stack of full red cards. Renders NOTHING when there are none (no empty bar).
 * This is the ONLY place red/urgent styling is used for notices.
 */
function Details({ a }: { a: NoticeCardModel }) {
  return (
    <>
      <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-[15px] leading-relaxed text-white/95 sm:text-base">{a.body}</p>
      {a.actionText && <p className="mt-3 max-w-3xl break-words rounded-xl bg-white/12 px-4 py-3 text-[15px] leading-snug sm:text-base"><span className="font-black">What to do: </span>{a.actionText}</p>}
      <p className="mt-3 text-sm text-white/90"><span className="font-bold">{a.areaSummary}</span>{" · "}{a.attribution.byline}{a.publishedAt ? ` · ${formatNoticeDateTime(a.publishedAt)}` : ""}</p>
      <div className="flex flex-wrap items-center gap-x-5">
        <Link href={`/notices/${a.id}`} className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">Read more</Link>
        {a.linkUrl && <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">Official information<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
    </>
  );
}

export function EssentialAlertSlot({ alerts, scopedToMyAreas = false }: { alerts: NoticeCardModel[]; scopedToMyAreas?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const plan = planEssentialSlot(alerts);
  if (!plan.lead) return null;
  const a = plan.lead;
  return (
    <section aria-label={plan.heading} className="bg-[#9b1c1c] text-white">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:py-5">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-white/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17v.5" /></svg>
          </span>
          {plan.heading}
        </p>
        <h2 className="mt-1 break-words font-display text-2xl font-bold leading-tight sm:text-3xl">{a.title}</h2>
        <Details a={a} />

        {plan.others.length > 0 && (
          <ul className="mt-2 divide-y divide-white/20 border-t border-white/25" aria-label="Other essential alerts">
            {plan.others.map((o) => {
              const isOpen = open === o.id;
              return (
                <li key={o.id}>
                  <button type="button" aria-expanded={isOpen} aria-controls={`ea-${o.id}`} onClick={() => setOpen(isOpen ? null : o.id)} className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{o.title}</span><span className="block truncate text-xs text-white/85">{o.areaSummary}</span></span>
                    <span aria-hidden className={"shrink-0 text-lg transition-transform " + (isOpen ? "rotate-180" : "")}>{"▾"}</span>
                  </button>
                  {isOpen && <div id={`ea-${o.id}`} className="pb-3"><Details a={o} /></div>}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-5">
          <Link href="/notices?tab=essential" className="inline-flex min-h-[44px] items-center text-sm font-bold underline underline-offset-2">{plan.count > 1 ? `All ${plan.count} alerts` : "All alerts"}</Link>
          {scopedToMyAreas && <span className="text-xs text-white/80">Showing alerts for your areas</span>}
        </div>
      </div>
    </section>
  );
}
