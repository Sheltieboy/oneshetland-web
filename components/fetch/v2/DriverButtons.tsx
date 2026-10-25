"use client";

import { agreeToCancelAction, arrivedAction, cannotDeliverAction, collectedAction, declineToCancelAction, deliverAction, refreshHoldAction, releaseAction, reportReturnAction } from "@/app/fetch/actions";
import type { ReleaseReason, UndeliverableReason } from "@/lib/fetch-api";
import type { DriverAction } from "@/lib/fetch/flow";
import { RELEASE, UNDELIVERABLE } from "@/lib/fetch/present";
import { ActionDialog } from "@/components/fetch/v2/ActionDialog";
import { btnPrimary } from "@/components/fetch/v2/ui";

/** The driver's state-changing buttons for one job. Only the ones that apply now are given; the server decides and its answer is shown. */
export function DriverButtons({ id, actions, safePlaceAllowed, hasDeliveryPhoto, hasReturnPhoto }: {
  id: string; actions: DriverAction[]; safePlaceAllowed: boolean; hasDeliveryPhoto: boolean; hasReturnPhoto: boolean;
}) {
  const primary = `${btnPrimary} bg-[#e0722a]`;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("agree_cancel") && (
        <ActionDialog trigger="Agree to cancel" title="Agree to cancel this job?" confirm="Agree to cancel" triggerClass={primary}
          body="The Fetch is cancelled, the requester isn't charged, and the job comes off your list." run={() => agreeToCancelAction(id)} />
      )}
      {actions.includes("decline_cancel") && (
        <ActionDialog trigger="Ask to go ahead" title="Ask to go ahead with this job?" confirm="Ask to go ahead"
          body="OneShetland will decide whether the Fetch goes ahead. Please don't collect until it's decided."
          reason={{ label: "Why should it go ahead?", max: 500 }} run={({ reason }) => declineToCancelAction(id, reason || undefined)} />
      )}
      {actions.includes("arrive") && (
        <ActionDialog trigger="I've arrived to collect" title="Tell the requester you've arrived?" confirm="I've arrived"
          body="The requester is told you're there. If you're kept waiting, the waiting time is added to your payment." run={() => arrivedAction(id)} />
      )}
      {actions.includes("collect") && (
        <ActionDialog trigger="I've collected the item" title="Confirm you have the item?" confirm="I've got it" triggerClass={primary}
          body="Only confirm once the item is with you. The requester is told it's on its way." run={() => collectedAction(id)}
          onDone={() => "Collected. Deliver it, or tell us if you can't."} />
      )}
      {actions.includes("refresh_payment") && (
        <ActionDialog trigger="Check the payment again" title="Check the requester's payment?" confirm="Check now"
          body="We'll ask the bank for the latest state of the payment authorisation. Please don't collect until it's confirmed."
          run={() => refreshHoldAction(id)}
          onDone={(r) => (r.ok && (r.data as { can_collect?: boolean }).can_collect ? "Payment confirmed — you can collect." : "The payment still isn't confirmed. Please don't collect yet.")} />
      )}
      {actions.includes("deliver") && (
        <ActionDialog trigger="I've delivered it" title="Confirm delivery?" confirm="Confirm delivery" triggerClass={primary}
          body={safePlaceAllowed
            ? <>Choose how you handed it over. Leaving it in a safe place needs a delivery photo first{hasDeliveryPhoto ? " (you've added one)" : " — add it under Photos"}.</>
            : "Only confirm once the item has been handed over. The requester's card is then charged for what happened."}
          choices={safePlaceAllowed ? { label: "How was it delivered?", options: [{ value: "hand", label: "Handed to someone" }, { value: "safe", label: "Left in the agreed safe place" }] } : undefined}
          run={({ choice }) => deliverAction(id, choice === "safe")} onDone={() => "Delivered. Thank you!"} />
      )}
      {actions.includes("cannot_deliver") && (
        <ActionDialog trigger="I can't deliver it" title="Tell us you can't deliver it?" confirm="I can't deliver it" danger
          body="Keep the item safe. The requester and OneShetland are told, and you'll be asked to return it to where you collected it."
          choices={{ label: "What happened?", options: UNDELIVERABLE }} reason={{ label: "Anything else we should know?", max: 500 }}
          run={({ choice, reason }) => cannotDeliverAction(id, choice as UndeliverableReason, reason || undefined)} />
      )}
      {actions.includes("report_return") && (
        <ActionDialog trigger="I've returned it" title="Report the return?" confirm="Report the return"
          body={<>A photo of the returned item is needed{hasReturnPhoto ? " (you've added one)" : " — add it under Photos first"}. OneShetland then reviews what happened and what you&apos;re paid.</>}
          reason={{ label: "Where did you leave it?", max: 500 }} run={({ reason }) => reportReturnAction(id, reason || undefined)}
          onDone={() => "Return reported — OneShetland will review this."} />
      )}
      {actions.includes("release") && (
        <ActionDialog trigger="I can't do this job" title="Give this job up?" confirm="Give it up" danger
          body="The Fetch goes back to other drivers and the requester's authorisation is released. Giving jobs up often may pause your driver account."
          choices={{ label: "Why?", options: RELEASE }} reason={{ label: "Anything else?", max: 500 }}
          run={({ choice, reason }) => releaseAction(id, choice as ReleaseReason, reason || undefined)} />
      )}
    </div>
  );
}
