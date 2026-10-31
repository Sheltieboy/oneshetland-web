import type { HomeAlert } from "@/lib/home-data";

/**
 * Business-sourced partner_alerts, DEMOTED: a calm, small "Update from <business>" strip near the community notices. Never at the top of the page,
 * never red or "emergency": the Essential Alert slot (components/notices/EssentialAlertSlot) is the only urgent position on the homepage.
 * (A partner alert's own type - emergency / disruption / info - is shown as plain words, not as colour.)
 */
export function PartnerUpdateStrip({ alerts }: { alerts: HomeAlert[] }) {
  if (!alerts.length) return null;
  const a = alerts[0];
  return (
    <p className="mb-5 flex flex-wrap items-baseline gap-x-2 rounded-xl border border-line bg-sand/60 px-4 py-2.5 text-sm text-ink-soft">
      <span className="text-[11px] font-black uppercase tracking-widest text-ink-muted">Update{a.business_name ? ` from ${a.business_name}` : ""}</span>
      <span className="min-w-0 break-words">{a.message}</span>
      {alerts.length > 1 && <span className="text-xs font-semibold text-ink-muted">+{alerts.length - 1} more</span>}
    </p>
  );
}
