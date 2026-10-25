import Link from "next/link";
import type { Detail, Issue, Message, Photo, TimelineEvent } from "@/lib/fetch-api";
import { requesterActions } from "@/lib/fetch/flow";
import { boardWhen, pounds, requesterStatus, sizeLabel, timelineFor, when } from "@/lib/fetch/present";
import { RequesterButtons } from "@/components/fetch/v2/RequesterButtons";
import { Messages, PaymentConfirm, PhotoSection, ReportProblem } from "@/components/fetch/v2/JobParts";
import { MoneyTable, Notice, Panel, RouteLine, StatusCard, Timeline } from "@/components/fetch/v2/ui";

export type RequesterJobData = {
  detail: Detail; timeline: TimelineEvent[]; messages: { can_send: boolean; messages: Message[] } | null; photos: Photo[]; issues: Issue[];
  hint: { heading_that_way: boolean; hint?: string } | null; posted?: boolean; now: number;
};

/** The requester's page for one Fetch: where it is, what they can do now, the money, the history, messages, photos and problems. */
export function RequesterJob({ data }: { data: RequesterJobData }) {
  const r = data.detail.request;
  const now = data.now;
  const actions = requesterActions(r, now);
  const status = requesterStatus(r);
  const lines: [string, number][] = [["Driver payment", r.base_fee_pence ?? 0]];
  if (r.ferry_supplement_pence) lines.push(["Ferry journey extra", r.ferry_supplement_pence]);
  if (r.waiting_fee_pence) lines.push(["Waiting time", r.waiting_fee_pence]);
  if (r.return_fee_pence) lines.push(["Return journey", r.return_fee_pence]);
  const fee = (r.total_fee_pence ?? 0) - lines.reduce((s, [, v]) => s + v, 0);
  if (fee > 0) lines.push(["OneShetland fee", fee]);
  const driverName = r.driver?.first_name ?? "Your driver";

  return (
    <div className="space-y-4">
      {data.posted && <Notice tone="ok">Your Fetch is posted. Nothing has been charged.</Notice>}
      <StatusCard status={status} />
      {r.status === "pending" && (
        <Notice>You&apos;ll hear from us as soon as someone accepts; your card is only authorised then.
          <span className="mt-1 block">This isn&apos;t a booking yet — a driver still needs to accept your Fetch.</span>
          {data.hint?.heading_that_way && <span className="mt-1 block font-semibold">{data.hint.hint ?? "A Fetch driver may be heading that way soon."}</span>}
          {r.expires_at && <span className="mt-1 block text-xs">Open to drivers until {when(r.expires_at)}.</span>}
        </Notice>
      )}
      {actions.includes("pay") && <Panel title="Payment" id="pay"><PaymentConfirm requestId={r.id} paymentStatus={r.payment_status} /></Panel>}

      <Panel>
        <RouteLine from={`${r.pickup_area ? `${r.pickup_area}, ` : ""}${r.pickup_region}`} to={`${r.destination_area ? `${r.destination_area}, ` : ""}${r.destination_region}`} ferry={r.ferry_required} />
        <p className="mt-1 text-ink">{r.item_description}</p>
        <p className="text-sm text-ink-soft">{sizeLabel(r.size_class)}{r.handling_flags?.includes("heavy_two_person") ? " · two-person lift" : ""}{r.handling_flags?.includes("fragile") ? " · fragile" : ""} · {boardWhen(r)}</p>
        {r.driver && <p className="mt-2 text-sm text-ink">Driver: <b>{driverName}</b>{r.driver.vehicle_class ? ` · ${String(r.driver.vehicle_class).replace(/_/g, " ")}` : ""}</p>}
        {r.operational_details_visible !== false && r.pickup_location && (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Collect from</dt><dd className="text-ink">{r.pickup_name ? `${r.pickup_name}, ` : ""}{r.pickup_location}</dd></div>
            <div><dt className="text-ink-muted">Deliver to</dt><dd className="text-ink">{r.destination_address}</dd></div>
            {r.safe_place_allowed && <div><dt className="text-ink-muted">Safe place</dt><dd className="text-ink">{r.safe_place_note || "Allowed"}</dd></div>}
          </dl>
        )}
      </Panel>

      {(actions.some((a) => ["cancel", "ask_cancel", "extend", "ready"].includes(a)) || r.cancel_requested_at) && (
        <Panel title="What you can do">
          {r.cancel_requested_at && r.status === "matched" && <p className="mb-2 text-sm text-ink-soft">You asked to cancel. Your driver can agree, or ask to go ahead; OneShetland decides if you don&apos;t agree.</p>}
          <RequesterButtons id={r.id} actions={actions} />
        </Panel>
      )}

      <Panel title="Price">
        <MoneyTable lines={lines} total={r.total_fee_pence ?? 0} totalLabel={["delivered", "returned"].includes(r.status) ? "Total" : "Expected total"} />
        {r.return_max_pence > 0 && !["delivered", "returned", "cancelled", "expired"].includes(r.status) && (
          <p className="mt-2 text-xs text-ink-muted">The higher amount is only temporarily reserved in case there is waiting time or the item has to be returned (up to {pounds(r.return_max_pence)} for a return). You are only charged for what actually happens.</p>
        )}
        {r.status === "pending" && <p className="mt-2 text-xs text-ink-muted">Nothing is charged until delivery.</p>}
      </Panel>

      {actions.includes("photos") || data.photos.length > 0 ? (
        <Panel title="Photos" id="photos">
          <PhotoSection requestId={r.id} photos={data.photos} addKinds={actions.includes("photos") ? ["item"] : []} manageItem={r.status === "pending"} />
          {r.size_class === "bulky" && r.status === "pending" && !data.photos.some((p) => p.kind === "item") && <div className="mt-2"><Notice tone="warn">Bulky items need a photo before a driver can accept.</Notice></div>}
        </Panel>
      ) : null}

      {actions.includes("message") && data.messages && (
        <Panel title={`Messages with ${driverName}`} id="messages">
          <Messages requestId={r.id} initial={data.messages.messages} canSend={data.messages.can_send} otherName={driverName} />
        </Panel>
      )}

      <Panel title="What's happened" id="timeline"><Timeline items={timelineFor("requester", data.timeline)} /></Panel>

      {(actions.includes("report") || data.issues.length > 0) && (
        <Panel title="Problems" id="problems">
          {data.issues.map((i) => (
            <p key={i.id} className="mb-2 text-sm text-ink">{i.status === "open" ? "Reported" : "Resolved"} {when(i.created_at)}{i.resolution ? ` — ${i.resolution}` : ""}</p>
          ))}
          {actions.includes("report") ? <ReportProblem requestId={r.id} viewer="requester" /> : <p className="text-sm text-ink-muted">Problems can be reported up to 72 hours after a Fetch finishes.</p>}
        </Panel>
      )}

      {r.status === "expired" && <Link href="/fetch/new" className="inline-block text-sm font-semibold underline">Post it again</Link>}
    </div>
  );
}
