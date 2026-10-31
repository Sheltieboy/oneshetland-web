"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { planEssentialSlot, type NoticeCardModel } from "@/lib/notices-alerts";
import { DISMISSED_KEY, parseDismissed, undismissed, dismissAll } from "@/lib/essential-dismiss";

/**
 * The reserved Essential Alert slot at the top of the homepage: ONE single-line red strip  [!]  ESSENTIAL ALERT  headline  (area)  count  [×].
 * It is one horizontal line at every width (fixed height, nothing wraps: the headline truncates with an ellipsis, the area and the long
 * count drop out on narrow screens). The full title, areas, instructions and source are in the accessible name and on the page it opens.
 * One undismissed alert links to it; several link to the essential list. The × is a separate button: it hides the strip on this device only
 * (lib/essential-dismiss.ts) and never navigates, and nothing is changed about the notice, the Notices page or any preference.
 * Nothing to show (none active, or all dismissed) renders no strip and no gap. This is the ONLY place red/urgent styling is used for notices.
 *
 * No flash for someone who already dismissed: the server renders the strip, and a tiny inline script (run while the HTML is parsed, before
 * paint) hides it when every active alert id is already in the dismissed list.
 */
const RED = "#9b1c1c";

function hideIfDismissedScript(ids: string[]) {
  return `(function(){try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(DISMISSED_KEY)})||"[]"),ids=${JSON.stringify(ids)};if(Array.isArray(d)&&ids.length&&ids.every(function(i){return d.indexOf(i)>-1})){document.currentScript.parentElement.hidden=true}}catch(e){}})()`;
}

export function EssentialAlertSlot({ alerts, scopedToMyAreas = false }: { alerts: NoticeCardModel[]; scopedToMyAreas?: boolean }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setDismissed(parseDismissed(window.localStorage.getItem(DISMISSED_KEY))); } catch { /* storage blocked: the strip simply shows */ }
    setHydrated(true);
  }, []);
  const shown = undismissed(alerts, dismissed);
  const plan = planEssentialSlot(shown);
  if (!plan.lead) return null;
  const a = plan.lead;
  const many = plan.count > 1;
  const href = many ? "/notices?tab=essential" : `/notices/${a.id}`;
  const name = [
    many ? `Essential alert, ${plan.count} active` : "Essential alert",
    `${many ? "Latest: " : ""}${a.title}`,
    a.areaSummary || null,
    many ? "Opens all essential alerts" : "Opens the full alert",
    scopedToMyAreas ? "Showing alerts for your areas" : null,
  ].filter(Boolean).join(". ");
  const dismiss = () => {
    const next = dismissAll(dismissed, alerts);
    setDismissed(next);
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* the strip is hidden for this visit at least */ }
  };
  return (
    <section aria-label="Essential alerts" className="bg-[#9b1c1c] text-white" data-essential-strip data-hydrated={hydrated ? "1" : "0"}>
      {!hydrated && <script dangerouslySetInnerHTML={{ __html: hideIfDismissedScript(alerts.map((x) => x.id)) }} />}
      <div className="mx-auto flex h-11 max-w-6xl items-stretch pl-3 sm:pl-5">
        <Link href={href} aria-label={name}
          className="group flex min-w-0 flex-1 items-center gap-2.5 whitespace-nowrap rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white">
          {/* One self-contained SVG: its own white disc and explicit red fills, so no inherited colour can blank the mark. */}
          <svg aria-hidden focusable="false" width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
            <circle cx="12" cy="12" r="12" fill="#ffffff" />
            <rect x="10.5" y="4.8" width="3" height="9.6" rx="1.5" fill={RED} />
            <circle cx="12" cy="18.2" r="1.9" fill={RED} />
          </svg>
          <span aria-hidden className="shrink-0 text-[11px] font-black uppercase tracking-wider text-white/90">
            <span className="min-[360px]:hidden">Alert</span><span className="hidden min-[360px]:inline">Essential alert</span>
          </span>
          <span aria-hidden className="min-w-0 flex-1 truncate text-sm font-bold sm:text-[15px]">{a.title}</span>
          {a.areaSummary && <span aria-hidden className="hidden max-w-[28%] shrink truncate text-[13px] text-white/90 md:block">{a.areaSummary}</span>}
          {many && <span aria-hidden className="shrink-0 text-xs font-bold text-white/90"><span className="min-[480px]:hidden">{plan.count}</span><span className="hidden min-[480px]:inline">{plan.count} active</span></span>}
        </Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss Essential Alert"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white">
          <svg aria-hidden focusable="false" width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>
        </button>
      </div>
    </section>
  );
}
