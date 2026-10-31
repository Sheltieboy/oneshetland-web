import Link from "next/link";
import { planEssentialSlot, type NoticeCardModel } from "@/lib/notices-alerts";

/**
 * The reserved Essential Alert slot at the top of the homepage: ONE compact red strip (label, headline, area, count). It never shows the body,
 * "what to do" or source detail; those are on the alert page it links to. One alert links straight to it; several link to the essential list,
 * where every active alert is reachable. Renders NOTHING when there are none (no empty bar).
 * This is the ONLY place red/urgent styling is used for notices.
 */
export function EssentialAlertSlot({ alerts, scopedToMyAreas = false }: { alerts: NoticeCardModel[]; scopedToMyAreas?: boolean }) {
  const plan = planEssentialSlot(alerts);
  if (!plan.lead) return null;
  const a = plan.lead;
  const many = plan.count > 1;
  const href = many ? "/notices?tab=essential" : `/notices/${a.id}`;
  return (
    <section aria-label={plan.heading} className="bg-[#9b1c1c] text-white">
      <div className="mx-auto max-w-6xl px-5 py-2 sm:py-2.5">
        <Link href={href} className="group flex min-h-[44px] items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[#9b1c1c]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v9M12 19v.5" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-black uppercase tracking-widest text-white/85">{many ? `Essential alert · ${plan.count} active` : "Essential alert"}</span>
            <span className="block truncate text-[15px] font-bold leading-snug sm:text-base">
              {a.title}
              {a.areaSummary && <span className="font-normal text-white/85">{" · "}{a.areaSummary}</span>}
            </span>
            <span className="sr-only">{many ? ` Opens all ${plan.count} essential alerts.` : " Opens the full alert."}{scopedToMyAreas ? " Showing alerts for your areas." : ""}</span>
          </span>
          <span aria-hidden className="shrink-0 text-lg transition-transform group-hover:translate-x-0.5">{"›"}</span>
        </Link>
      </div>
    </section>
  );
}
