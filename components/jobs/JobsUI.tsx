import Link from "next/link";
import {
  type Job, type Shift,
  formatJobPay, CONTRACT_LABELS, REMOTE_LABELS,
  formatPay, formatDuration, formatShiftDate, shiftDisplayBusiness,
  URGENCY_CONFIG, SHIFT_CATEGORY_LABELS,
} from "@/lib/jobs-data";

export const JOBS = "#2a8b5c";
export const SHIFTS = "#e8a020";

function Logo({ url, name, accent }: { url: string | null; name: string; accent: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center font-display text-lg font-bold" style={{ color: accent }}>
          {name.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "jobs" }) {
  return (
    <span
      className="rounded-pill px-2.5 py-1 text-xs font-semibold"
      style={tone === "jobs"
        ? { background: `${JOBS}14`, color: JOBS }
        : { background: "var(--color-sand)", color: "var(--color-ink-soft)" }}
    >
      {children}
    </span>
  );
}

export function JobCard({ job }: { job: Job }) {
  const biz = job.business;
  const name = biz?.name ?? "Employer";
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex flex-col gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <Logo url={biz?.logo_url ?? null} name={name} accent={JOBS} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-lg font-bold leading-tight text-ink group-hover:underline">{job.title}</h3>
            {job.is_featured && <span className="shrink-0 text-xs" style={{ color: JOBS }} title="Featured">★</span>}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            {name}{biz?.is_verified ? " ✓" : ""}{job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
      </div>

      {job.description && <p className="line-clamp-2 text-sm text-ink-soft">{job.description}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: JOBS }}>
          {formatJobPay(job)}
        </span>
        <Chip>{CONTRACT_LABELS[job.contract_type] ?? job.contract_type}</Chip>
        {job.category && <Chip>{job.category}</Chip>}
        {job.remote_mode !== "on_site" && <Chip>{REMOTE_LABELS[job.remote_mode]}</Chip>}
        {job.is_seasonal && <Chip>Seasonal</Chip>}
        {job.relocation_support && <Chip tone="jobs">Relocation</Chip>}
        {job.housing_available && <Chip tone="jobs">Housing</Chip>}
      </div>
    </Link>
  );
}

export function ShiftCard({ shift }: { shift: Shift }) {
  const biz = shiftDisplayBusiness(shift);
  const urg = URGENCY_CONFIG[shift.urgency];
  const now = new Date().toISOString();
  const boosted = shift.boosted_until && shift.boosted_until > now;
  const spotsLeft = Math.max(0, shift.positions_total - shift.positions_filled);
  return (
    <Link
      href={`/shifts/${shift.id}`}
      className="group flex flex-col gap-3 rounded-card border border-line bg-paper p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <Logo url={biz.logo_url} name={biz.name} accent={SHIFTS} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-lg font-bold leading-tight text-ink group-hover:underline">{shift.title}</h3>
            {boosted && <span className="shrink-0 text-xs" style={{ color: SHIFTS }} title="Boosted">⚡</span>}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            {biz.name}{biz.is_verified ? " ✓" : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: urg.bg, color: urg.color }}>
          {urg.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill px-2.5 py-1 text-xs font-bold text-paper" style={{ background: SHIFTS }}>
          {formatPay(shift.pay_type, shift.pay_amount)}
        </span>
        <Chip>{formatShiftDate(shift.start_at)}</Chip>
        <Chip>{formatDuration(shift.start_at, shift.end_at)}</Chip>
        {SHIFT_CATEGORY_LABELS[shift.category] && <Chip>{SHIFT_CATEGORY_LABELS[shift.category]}</Chip>}
      </div>
      <p className="text-xs text-ink-muted">
        📍 {shift.location_text} · {spotsLeft > 0 ? `${spotsLeft} of ${shift.positions_total} spot${shift.positions_total === 1 ? "" : "s"} left` : "Full"}
      </p>
    </Link>
  );
}

export function EmptyState({ icon, title, body, cta }: {
  icon: string; title: string; body: string; cta?: { label: string; href: string; color: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{body}</p>
      {cta && (
        <Link href={cta.href} className="mt-5 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-paper transition hover:brightness-95" style={{ background: cta.color }}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
