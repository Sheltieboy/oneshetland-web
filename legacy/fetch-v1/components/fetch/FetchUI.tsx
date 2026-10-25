import Link from "next/link";
import { CancelRunButton } from "./CancelRunButton";
import {
  FETCH, getCategoryIcon, penceToGBP,
  REQUEST_STATUS_PILL, RUN_STATUS_PILL, DRIVER_STATUS_PILL,
  runOrigin, runDestination, fmtDateTime, fmtTimeRange, getCategoryName,
  type DeliveryRequest, type Run, type RequestStatus, type RunStatus, type DriverStatus,
} from "@/lib/fetch-data";

export { FETCH };

/* ── Status pills ─────────────────────────────────────────────────────────── */

export function RequestStatusPill({ status }: { status: RequestStatus }) {
  const p = REQUEST_STATUS_PILL[status];
  return <span className="rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: p.bg, color: p.text }}>{p.label}</span>;
}
export function RunStatusPill({ status }: { status: RunStatus }) {
  const p = RUN_STATUS_PILL[status];
  return <span className="rounded-pill px-2.5 py-1 text-xs font-bold" style={{ background: p.bg, color: p.text }}>{p.label}</span>;
}
export function DriverStatusPill({ status }: { status: DriverStatus }) {
  const p = DRIVER_STATUS_PILL[status];
  return <span className="rounded-pill px-3 py-1 text-xs font-bold" style={{ background: p.bg, color: p.text }}>{p.label}</span>;
}

/* ── Route block (collection → delivery) ──────────────────────────────────── */

export function RouteBlock({ req }: { req: Pick<DeliveryRequest, "pickup_name" | "pickup_location" | "destination_area" | "destination_address"> }) {
  return (
    <div className="space-y-0">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FETCH }} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">Collection</p>
          <p className="font-bold text-ink">{req.pickup_name}</p>
          <p className="text-sm text-ink-muted">{req.pickup_location}</p>
        </div>
      </div>
      <div className="ml-[4px] h-4 w-0.5 bg-line" />
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-navy" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">Delivery</p>
          <p className="font-bold text-ink">
            {req.destination_area ? `${req.destination_area} · ` : ""}{req.destination_address}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Request card (requester + driver lists) ──────────────────────────────── */

export function RequestCard({ req, href }: { req: DeliveryRequest; href?: string }) {
  const inner = (
    <div className="rounded-card border border-line bg-paper p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: FETCH }}>
          {getCategoryIcon(req.category_slug)} {getCategoryName(req.category_slug)}
        </span>
        <div className="flex items-center gap-1.5">
          {req.base_fee_pence != null && (
            <span className="rounded-pill border border-line bg-cream px-2.5 py-1 text-xs font-extrabold text-ink">{penceToGBP(req.base_fee_pence)}</span>
          )}
          <RequestStatusPill status={req.status} />
        </div>
      </div>
      <RouteBlock req={req} />
      {req.already_paid && <p className="mt-2 text-xs font-semibold text-green-700">✓ Already paid at collection</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

/* ── Run card ─────────────────────────────────────────────────────────────── */

export function RunCard({ run }: { run: Run }) {
  return (
    <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-display font-bold text-ink">
          <span className="capitalize">{runOrigin(run)}</span>
          <span className="px-1.5 font-normal text-ink-faint">→</span>
          <span className="capitalize" style={{ color: FETCH }}>{runDestination(run)}</span>
        </p>
        <div className="flex items-center gap-1.5">
          {run.ferry_crossing && <span className="rounded-pill bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">⛴ Ferry</span>}
          <RunStatusPill status={run.status} />
        </div>
      </div>
      <p className="text-sm text-ink-muted">{fmtDateTime(run.departure_start)} · {fmtTimeRange(run.departure_start, run.departure_end)}</p>
      {(run.categories_accepted ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(run.categories_accepted ?? []).slice(0, 5).map((c) => (
            <span key={c} className="rounded-pill border border-line bg-cream px-2 py-0.5 text-xs text-ink-soft">{getCategoryName(c)}</span>
          ))}
        </div>
      )}
      {run.status === "open" && (
        <div className="mt-3 flex justify-end border-t border-line pt-2">
          <CancelRunButton runId={run.id} />
        </div>
      )}
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

export function EmptyState({ icon, title, body, cta }: {
  icon: string; title: string; body: string; cta?: { label: string; href: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="mt-3 font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && (
        <Link href={cta.href} className="mt-4 inline-block rounded-pill px-5 py-2.5 text-sm font-semibold text-white" style={{ background: FETCH }}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/* ── Quick link tile ──────────────────────────────────────────────────────── */

export function QuickLink({ href, icon, label, primary }: { href: string; icon: string; label: string; primary?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-card border bg-paper px-4 py-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift" style={{ borderColor: primary ? `${FETCH}55` : "var(--color-line)" }}>
      <span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ background: `${FETCH}1a` }}>{icon}</span>
      <span className="text-sm font-bold text-ink">{label}</span>
    </Link>
  );
}
