"use client";

import { askToCancelAction, cancelOpenAction, extendAction, readyAction } from "@/app/fetch/actions";
import type { RequesterAction } from "@/lib/fetch/flow";
import { ActionDialog } from "@/components/fetch/v2/ActionDialog";

/** The requester's state-changing buttons. Only the ones that apply now are given; each confirms the exact consequence first. */
export function RequesterButtons({ id, actions }: { id: string; actions: RequesterAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("ready") && (
        <ActionDialog trigger="The item is ready" title="Tell your driver it's ready?" confirm="Yes, it's ready"
          body="Your driver will be told the item is ready to collect." run={() => readyAction(id)} />
      )}
      {actions.includes("extend") && (
        <ActionDialog trigger="Give drivers more time" title="Keep your Fetch open longer?" confirm="Keep it open"
          body="Your Fetch stays open to drivers for longer. You can do this twice." run={() => extendAction(id)} />
      )}
      {actions.includes("cancel") && (
        <ActionDialog trigger="Cancel this Fetch" title="Cancel your Fetch?" confirm="Cancel Fetch" danger
          body="No driver has accepted yet, so it is cancelled straight away and nothing is charged."
          reason={{ label: "Why are you cancelling?", max: 500 }} run={({ reason }) => cancelOpenAction(id, reason || undefined)} />
      )}
      {actions.includes("ask_cancel") && (
        <ActionDialog trigger="Ask to cancel" title="Ask your driver to cancel?" confirm="Ask to cancel" danger
          body="A driver has already accepted. They'll be asked to agree. If they agree, nothing is charged; if they don't, OneShetland decides. The item can't be cancelled once it has been collected."
          reason={{ label: "Why do you want to cancel?", required: true, max: 500 }} run={({ reason }) => askToCancelAction(id, reason)} />
      )}
    </div>
  );
}
