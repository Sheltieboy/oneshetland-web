import { type HomeAlert } from "@/lib/home-data";

/**
 * Surfaces active partner/urgent alerts at the very top of the home page.
 * Mirrors the app's AlertPill / urgent chip. Renders nothing when there are
 * no active alerts.
 */

const ALERT_STYLE: Record<string, { bg: string; dot: string; label: string }> = {
  emergency: { bg: "#c53b2f", dot: "#fff", label: "Emergency" },
  disruption: { bg: "#e0722a", dot: "#fff", label: "Disruption" },
  info: { bg: "#0e6ea6", dot: "#fff", label: "Notice" },
};

export function UrgentAlertBanner({ alerts }: { alerts: HomeAlert[] }) {
  if (!alerts.length) return null;
  // Lead with the most severe alert; one banner keeps the home page calm.
  const order = ["emergency", "disruption", "info"];
  const a = [...alerts].sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type))[0];
  const style = ALERT_STYLE[a.type] ?? ALERT_STYLE.info;

  return (
    <div role="alert" className="text-paper" style={{ background: style.bg }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 1 21h22L12 2zm0 6 0 7m0 3 0 .5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          <span className="font-bold">{style.label}:</span> {a.message}
          {a.business_name ? <span className="text-paper/80"> — {a.business_name}</span> : null}
        </p>
        {alerts.length > 1 && (
          <span className="shrink-0 rounded-pill bg-white/20 px-2 py-0.5 text-xs font-bold">+{alerts.length - 1}</span>
        )}
      </div>
    </div>
  );
}
