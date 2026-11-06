/**
 * contributor-copy.ts — wording shown to someone who has put an event in front of OneShetland (Phase 2 screens).
 * Plain, warm, no jargon. Pure strings so the wording is testable and one screen cannot drift from another.
 */

export type ChangeRoute = "after_approval" | "automatic";

/** What a contributor may do straight away once their event is approved. */
export const AFTER_APPROVAL_NOTE =
  "Once your event is approved, you can tell us straight away if a performance or the whole event is cancelled. You don't need to wait for anyone.";

export function cancelledReportedLine(scope: "performance" | "event"): string {
  return scope === "performance"
    ? "Thank you for letting us know. We've marked that performance as cancelled so nobody turns up for it."
    : "Thank you for letting us know. We've marked the whole event as cancelled so nobody turns up for it.";
}

/** Shown on the change-request form: which route this change will take. */
export function changeRouteLine(route: ChangeRoute): string {
  return route === "automatic"
    ? "As we know you, this change goes live straight away."
    : "We'll take a quick look before this change goes live. We'll tell you as soon as it has.";
}

/** Explains a request that is still waiting for a look. */
export const CHANGE_PENDING_LINE =
  "Your change is with us. Until we've looked at it, the event stays as it was.";

export const CHANGE_APPLIED_LINE = "Your change is now live.";

export function changeDeclinedLine(reason?: string | null): string {
  const r = (reason ?? "").trim();
  return r
    ? `We couldn't make that change. ${r} The event stays as it was, and you're welcome to send another request.`
    : "We couldn't make that change, so the event stays as it was. You're welcome to send another request.";
}

export const CANCEL_CONFIRM_PROMPT = "Are you sure? People who are interested will be told it's off.";
