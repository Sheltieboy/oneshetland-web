import Link from "next/link";
import { planEssentialSlot, type NoticeCardModel } from "@/lib/notices-alerts";

/**
 * The reserved Essential Alert slot at the top of the homepage: ONE compact red strip (label, headline, area, count). It never shows the body,
 * "what to do" or source detail; those are on the alert page it links to. One alert links straight to it; several link to the essential list,
 * where every active alert is reachable. Renders NOTHING when there are none (no empty bar).
 * This is the ONLY place red/urgent styling is used for notices.
 *
 * Accessibility: a single link whose accessible name is built once (aria-label) so a screen reader hears the label, the headline, the count and the
 * area in a sensible order, then where it goes; the icon and the chevron are decorative. The height is never fixed (long titles wrap to two lines,
 * larger text grows the strip), and the focus ring is white-on-red.
 */
export function EssentialAlertSlot({ alerts, scopedToMyAreas = false }: { alerts: NoticeCardModel[]; scopedToMyAreas?: boolean }) {
  const plan = planEssentialSlot(alerts);
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
  return (
    <section aria-label="Essential alerts" className="bg-[#9b1c1c] text-white">
      <div className="mx-auto max-w-6xl px-5 py-2 sm:py-2.5">
        <Link href={href} aria-label={name} className="group flex min-h-[44px] items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          {/* A solid exclamation mark (rounded bar + dot) filled, like the app's: the earlier hairline stroke with a half-unit dot read as a plain white disc at 13px. */}
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#9b1c1c]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" focusable="false"><rect x="9.8" y="3" width="4.4" height="12" rx="2.2" /><circle cx="12" cy="19.6" r="2.4" /></svg>
          </span>
          <span aria-hidden className="min-w-0 flex-1">
            <span className="block text-[11px] font-black uppercase tracking-widest text-white/90">{many ? `Essential alert · ${plan.count} active` : "Essential alert"}</span>
            <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="line-clamp-2 min-w-0 break-words text-[15px] font-bold leading-snug sm:line-clamp-1 sm:text-base">{a.title}</span>
              {a.areaSummary && <span className="block truncate text-[13px] leading-snug text-white/90 sm:max-w-[40%] sm:shrink-0">{a.areaSummary}</span>}
            </span>
          </span>
          <svg aria-hidden focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"><path d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </section>
  );
}
