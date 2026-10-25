import Link from "next/link";
import { fetchMessage, type Detail, type Issue, type JobSummary, type Message, type Photo, type PhotoKind, type TimelineEvent } from "@/lib/fetch-api";
import { driverActions } from "@/lib/fetch/flow";
import { boardWhen, driverStatus, sizeLabel, timelineFor, when } from "@/lib/fetch/present";
import { DriverButtons } from "@/components/fetch/v2/DriverButtons";
import { Messages, PhotoSection, ReportProblem } from "@/components/fetch/v2/JobParts";
import { MoneyTable, Notice, Panel, RouteLine, StatusCard, Timeline } from "@/components/fetch/v2/ui";

/** The driver's own pay, line by line, from the server (waiting and return appear only once the server has set them). */
export function payLines(pay?: JobSummary["pay"] | null): [string, number][] {
  if (!pay) return [];
  const l: [string, number][] = [["Delivery", pay.delivery_pence ?? 0]];
  if (pay.ferry_pence) l.push(["Ferry journey extra", pay.ferry_pence]);
  if (pay.waiting_pence) l.push(["Waiting time", pay.waiting_pence]);
  if (pay.return_pence) l.push(["Return journey", pay.return_pence]);
  return l;
}

export type DriverJobData = { detail: Detail; timeline: TimelineEvent[]; messages: { can_send: boolean; messages: Message[] } | null; photos: Photo[]; issues: Issue[];
  pay?: JobSummary["pay"] | null; driverProblem?: string | null; now: number };

/** The driver's page for a job they hold: what to do next, where to go (while the address window is open), money, photos, messages. */
export function DriverJob({ data }: { data: DriverJobData }) {
  const { detail } = data;
  const r = detail.request;
  const now = data.now;
  const arrived = r.status === "matched" ? [...data.timeline].reverse().find((e) => e.event === "arrived") : undefined;
  // Arrival is recorded once; after that the waiting notice replaces the button.
  const actions = driverActions(r, now).filter((a) => !(a === "arrive" && arrived));
  const name = r.requester_first_name ?? "The requester";
  const photoKinds: PhotoKind[] = r.status === "matched" ? ["collection"] : r.status === "collected" ? ["delivery", "collection"] : r.status === "undeliverable" ? ["return", "delivery"] : [];

  return (
    <div className="space-y-4">
      <StatusCard status={driverStatus(r)} />
      {r.status === "matched" && r.payment_status !== "authorised" && !r.cancel_requested_at && (
        <Notice tone="warn">Waiting for the requester&apos;s payment to be confirmed. Please don&apos;t collect the item until this says it&apos;s ready.</Notice>
      )}
      {r.cancel_requested_at && r.status === "matched" && (
        <Notice tone="warn">{name} has asked to cancel{r.cancel_request_reason ? `: “${r.cancel_request_reason}”` : "."} Please agree, or ask to go ahead.</Notice>
      )}
      {data.driverProblem && r.status === "matched" && (
        <Notice tone="warn">{fetchMessage(data.driverProblem)} You can&apos;t collect the item until this is sorted. <Link href="/fetch/driver/verification" className="font-semibold underline">Your driver details</Link></Notice>
      )}
      {arrived && <Notice>Waiting started {when(arrived.created_at)}. Any waiting charge is calculated automatically.</Notice>}

      {actions.some((a) => !["photos", "message", "report"].includes(a)) && (
        <Panel title="Next">
          <DriverButtons id={r.id} actions={actions} safePlaceAllowed={!!r.safe_place_allowed}
            hasDeliveryPhoto={data.photos.some((p) => p.kind === "delivery")} hasReturnPhoto={data.photos.some((p) => p.kind === "return")} />
        </Panel>
      )}

      <Panel>
        <RouteLine from={r.pickup_region} to={r.destination_region} ferry={r.ferry_required} />
        <p className="mt-1 text-ink">{r.item_description}</p>
        <p className="text-sm text-ink-soft">{sizeLabel(r.size_class)}{r.approx_dimensions_cm ? ` · about ${r.approx_dimensions_cm.l}×${r.approx_dimensions_cm.w}×${r.approx_dimensions_cm.h} cm` : ""}
          {r.handling_flags?.includes("heavy_two_person") ? " · two-person lift" : ""}{r.handling_flags?.includes("fragile") ? " · fragile" : ""} · {boardWhen(r)}</p>
        <p className="mt-1 text-sm text-ink">For {name}</p>
        {detail.addresses_visible === false ? (
          <p className="mt-3 text-sm text-ink-muted">The exact addresses are no longer shown for this job.</p>
        ) : r.pickup_location ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-ink-muted">Collect from</dt><dd className="text-ink">{r.pickup_name ? `${r.pickup_name}, ` : ""}{r.pickup_location}{r.pickup_notes ? <span className="block text-ink-soft">“{r.pickup_notes}”</span> : null}</dd></div>
            <div><dt className="text-ink-muted">Deliver to</dt><dd className="text-ink">{r.destination_address}{r.delivery_notes ? <span className="block text-ink-soft">“{r.delivery_notes}”</span> : null}</dd></div>
            <div><dt className="text-ink-muted">Safe place</dt><dd className="text-ink">{r.safe_place_allowed ? (r.safe_place_note || "Allowed — take a photo") : "Not allowed — hand it to someone"}</dd></div>
            {detail.phone_shared && r.contact_phone && <div><dt className="text-ink-muted">Phone</dt><dd><a href={`tel:${r.contact_phone}`} className="font-semibold text-ink underline">{r.contact_phone}</a></dd></div>}
          </dl>
        ) : null}
      </Panel>

      <Panel title="Your pay" id="pay">
        <MoneyTable lines={payLines(data.pay)} total={r.driver_pay_pence ?? 0} totalLabel={["delivered", "returned"].includes(r.status) ? "You earned" : "You'll receive"} />
        {r.status === "undeliverable" && <p className="mt-2 text-xs text-ink-muted">Any return payment is decided by OneShetland when it reviews the return.</p>}
        <p className="mt-2 text-xs text-ink-muted">Paid to the bank account in <Link href="/account/payments" className="underline">your payments</Link>; bank transfers can take a few working days.</p>
      </Panel>

      {(actions.includes("photos") || data.photos.length > 0) && (
        <Panel title="Photos" id="photos">
          <PhotoSection requestId={r.id} photos={data.photos} addKinds={actions.includes("photos") ? photoKinds : []} manageItem={false} />
        </Panel>
      )}

      {actions.includes("message") && data.messages && (
        <Panel title={`Messages with ${name}`} id="messages">
          <Messages requestId={r.id} initial={data.messages.messages} canSend={data.messages.can_send} otherName={name} />
        </Panel>
      )}

      <Panel title="What's happened" id="timeline"><Timeline items={timelineFor("driver", data.timeline)} /></Panel>

      {(actions.includes("report") || data.issues.length > 0) && (
        <Panel title="Problems" id="problems">
          {data.issues.map((i) => <p key={i.id} className="mb-2 text-sm text-ink">{i.status === "open" ? "Reported" : "Resolved"} {when(i.created_at)}{i.resolution ? ` — ${i.resolution}` : ""}</p>)}
          {actions.includes("report") ? <ReportProblem requestId={r.id} viewer="driver" /> : <p className="text-sm text-ink-muted">Problems can be reported up to 72 hours after a job finishes.</p>}
        </Panel>
      )}

    </div>
  );
}
