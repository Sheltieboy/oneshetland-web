import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import {
  FETCH, penceToGBP, getCategoryName, fmtDateTime, fmtTimeRange, SERVICE_FEE_PENCE,
  type RequestStatus,
} from "@/lib/fetch-data";
import {
  getRequest, getDriverInfoForRequest, getLatestWaitingEvent, isRequestDriver,
} from "@/lib/fetch-data.server";
import { RequestStatusPill } from "@/components/fetch/FetchUI";
import { RequestLive } from "@/components/fetch/RequestLive";
import { DriverActions } from "@/components/fetch/DriverActions";
import { CustomerWaitingPanel } from "@/components/fetch/CustomerWaitingPanel";
import { CancelRequestButton } from "@/components/fetch/CancelRequestButton";
import { ExtendRequestButton } from "@/components/fetch/ExtendRequestButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRequest(id);
  return { title: r ? `${getCategoryName(r.category_slug)} delivery · Fetch` : "Delivery · Fetch" };
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=/fetch/${id}`);

  const req = await getRequest(id);
  if (!req) notFound();

  const isOwner = req.customer_id === account.id;
  const viewerIsDriver = await isRequestDriver(req, account.id);
  if (!isOwner && !viewerIsDriver) notFound();

  const [driverInfo, waitingEvent] = await Promise.all([
    req.run_id && req.status !== "pending" ? getDriverInfoForRequest(id) : Promise.resolve(null),
    getLatestWaitingEvent(id),
  ]);

  const driverArrived = !!waitingEvent && !waitingEvent.collected_at && req.status === "matched";
  const isDelivered = req.status === "delivered";
  const baseFee = req.base_fee_pence;
  const waitFee = req.waiting_fee_pence ?? 0;
  // The £1.50 service fee sits ON TOP of the driver's fee and must be shown all
  // the way through — leaving it out here and only in the captured total is what
  // made the price appear to jump on delivery.
  const serviceFee = baseFee != null ? SERVICE_FEE_PENCE : 0;
  const totalFee = req.total_fee_pence ?? (baseFee ?? 0) + serviceFee + waitFee;

  return (
    <>
      <section className="relative isolate overflow-hidden text-white" style={{ background: FETCH }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg,${FETCH}f2,${FETCH}cc)` }} />
        <div className="relative mx-auto max-w-3xl px-5 py-10">
          <Link href={viewerIsDriver && !isOwner ? "/fetch?tab=driver" : "/fetch"} className="text-sm font-semibold text-white/85 hover:text-white">← Fetch</Link>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{getCategoryName(req.category_slug)} delivery</h1>
            <RequestStatusPill status={req.status} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-5 py-8">
        {req.status === "cancelled" ? (
          <div className="rounded-card border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-display text-lg font-bold text-ink">This delivery was cancelled</p>
          </div>
        ) : (
          <Timeline status={req.status} driverArrived={driverArrived} />
        )}

        {/* Driver-side actions (assigned driver only) */}
        {viewerIsDriver && req.status !== "cancelled" && (
          <DriverActions req={req} waitingEvent={waitingEvent} />
        )}

        {/* Requester waiting panel while driver is at collection */}
        {isOwner && driverArrived && waitingEvent && (
          <CustomerWaitingPanel requestId={id} waitingEvent={waitingEvent} readyForCollection={req.ready_for_collection} />
        )}

        {/* Driver info (requester view) */}
        {driverInfo && req.status !== "pending" && (
          <div className="rounded-card border-2 p-4" style={{ borderColor: `${FETCH}55`, background: `${FETCH}0a` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: FETCH }}>Your driver</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full text-lg font-extrabold text-white" style={{ background: FETCH }}>
                {(driverInfo.full_name ?? "D")[0].toUpperCase()}
              </span>
              <div>
                <p className="font-display text-lg font-bold text-ink">{driverInfo.full_name?.split(" ")[0] ?? "Your driver"}</p>
                {driverInfo.vehicle_type && <p className="text-sm text-ink-muted">🚗 {driverInfo.vehicle_type}</p>}
              </div>
            </div>
            {driverInfo.departure_start && driverInfo.departure_end && (
              <p className="mt-3 text-sm text-ink-soft"><span className="text-ink-muted">Departure window: </span>{fmtDateTime(driverInfo.departure_start)} · {fmtTimeRange(driverInfo.departure_start, driverInfo.departure_end)}</p>
            )}
            {driverInfo.ferry_crossing && <p className="mt-1 text-sm text-blue-700">⛴ This run involves a ferry crossing</p>}
          </div>
        )}

        {/* Fee breakdown */}
        {baseFee != null && (
          <div className={"rounded-card border p-4 " + (isDelivered ? "border-green-300 bg-green-50" : "border-line bg-paper shadow-soft")}>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">{isDelivered ? "Payment charged" : "Payment"}</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <Row label="Delivery fee (to your driver)" value={penceToGBP(baseFee)} />
              <Row label="OneShetland service fee" value={penceToGBP(serviceFee)} />
              {waitFee > 0 && <Row label="Waiting fee" value={penceToGBP(waitFee)} />}
              <div className="my-1 h-px bg-line" />
              <Row label="Total" value={penceToGBP(totalFee)} bold />
            </div>
            <p className="mt-2 text-xs text-ink-muted">{isDelivered ? "The customer's card has been charged." : "The card is pre-authorised when a driver accepts and only charged on delivery."}</p>
          </div>
        )}

        {/* Collection */}
        <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Collection</p>
          <Detail label="From" value={req.pickup_name} />
          <Detail label="Address" value={req.pickup_location} />
          {req.pickup_notes && <Detail label="Notes" value={req.pickup_notes} />}
          <Detail label="Already paid" value={req.already_paid ? "Yes" : "No"} />
          <Detail label="Ready to collect" value={req.ready_for_collection ? "Yes" : "Not yet"} last />
        </div>

        {/* Delivery */}
        <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-muted">Delivery</p>
          {req.destination_area && <Detail label="Area" value={req.destination_area} />}
          <Detail label="Address" value={req.destination_address} />
          {req.delivery_notes && <Detail label="Notes" value={req.delivery_notes} />}
          {viewerIsDriver && req.contact_phone && (
            <Detail label="Phone" value={req.contact_phone} last />
          )}
        </div>

        {/* Keep looking (requester only, while still waiting for a driver) */}
        {isOwner && req.status === "pending" && (
          <ExtendRequestButton requestId={id} />
        )}
        {/* Cancel (requester only, before collection) */}
        {isOwner && (req.status === "pending" || req.status === "matched") && (
          <CancelRequestButton requestId={id} isMatched={req.status === "matched"} />
        )}
        {isOwner && req.status === "collected" && (
          <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
            <p className="font-bold text-amber-900">⚠️ Can&apos;t cancel at this stage</p>
            <p className="mt-1 text-sm text-amber-900/80">The driver has already collected your item and is on their way.</p>
          </div>
        )}

        <p className="text-center text-xs text-ink-faint">
          Submitted {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </p>
        {req.status !== "cancelled" && req.status !== "delivered" && <RequestLive requestId={id} />}
      </div>
    </>
  );
}

/* ── Status timeline ──────────────────────────────────────────────────────── */

const STEPS = [
  { key: "pending", label: "Request submitted", sub: "Waiting for a driver to accept" },
  { key: "matched", label: "Driver matched", sub: "Your driver will collect within the window shown" },
  { key: "driver_arrived", label: "Driver arrived 📍", sub: "Your driver is at the collection point" },
  { key: "collected", label: "Item collected", sub: "Your driver has picked up your item and is on their way" },
  { key: "delivered", label: "Delivered 🎉", sub: "Your item has arrived!" },
];

function Timeline({ status, driverArrived }: { status: RequestStatus; driverArrived: boolean }) {
  const steps = driverArrived || status === "collected" || status === "delivered" ? STEPS : STEPS.filter((s) => s.key !== "driver_arrived");
  const activeKey = driverArrived && status === "matched" ? "driver_arrived" : status;
  const currentIdx = steps.findIndex((s) => s.key === activeKey);
  return (
    <div className="rounded-card border border-line bg-paper p-4 shadow-soft">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">Status</p>
      <ol className="space-y-0">
        {steps.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: done ? FETCH : "var(--color-line-strong)" }} />
                {idx < steps.length - 1 && <span className="h-8 w-0.5" style={{ background: idx < currentIdx ? FETCH : "var(--color-line)" }} />}
              </div>
              <div className="pb-2">
                <p className={"text-sm " + (active ? "font-bold text-ink" : done ? "text-ink" : "text-ink-muted")}>{step.label}</p>
                {active && <p className="text-xs text-ink-muted">{step.sub}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={bold ? "font-bold text-ink" : "text-ink-muted"}>{label}</span>
      <span className={bold ? "font-extrabold text-ink" : "font-semibold text-ink"}>{value}</span>
    </div>
  );
}

function Detail({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={"flex justify-between gap-3 py-2 " + (last ? "" : "border-b border-line")}>
      <span className="w-28 shrink-0 text-sm text-ink-muted">{label}</span>
      <span className="flex-1 text-right text-sm font-medium text-ink">{value || "—"}</span>
    </div>
  );
}
