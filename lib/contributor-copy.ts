/**
 * contributor-copy.ts — wording shown to someone who has put an event in front of OneShetland (Phase 2 screens).
 * Plain, warm, no jargon. Pure strings so the wording is testable and one screen cannot drift from another.
 */

export type ChangeRoute = "after_approval" | "automatic";

/** What a contributor may do straight away once their event is approved. */
export const AFTER_APPROVAL_NOTE =
  "Once your event is approved, you can tell us straight away if a performance or the whole event is cancelled. You don't need to wait for anyone.";

/** The real support contact (the Support page and its monitored inbox). One place, so no screen invents an address. */
export const SUPPORT_EMAIL = "hello@oneshetland.com";
export const SUPPORT_PATH = "/support";
/** A ready-to-send email to support about cancelling an event that has ticket buyers. */
export function ticketBuyersMailto(eventTitle: string): string {
  const subject = `Cancelling an event with ticket buyers: ${eventTitle.trim() || "my event"}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/**
 * OneShetland sends NOTHING to anyone when a community event (free, no OneShetland tickets) is cancelled: no email, no push, no notification.
 * So every cancellation screen says so, kindly, and hands the job of telling people to the organiser. Never replace this with "we'll let people know".
 */
export const CANCEL_NO_NOTIFY_LINE =
  "OneShetland doesn't send cancellation notifications to people yet. If anyone has told you they plan to come, please let them know yourself.";

export function cancelledReportedLine(scope: "performance" | "event"): string {
  return scope === "performance"
    ? `Thank you for letting us know. That performance now shows as cancelled on OneShetland. ${CANCEL_NO_NOTIFY_LINE}`
    : `Thank you for letting us know. The event page stays on OneShetland, clearly marked Cancelled, and it is off the lists and calendar. ${CANCEL_NO_NOTIFY_LINE}`;
}
/** Shown on the change-request form: which route this change will take. */
export function changeRouteLine(route: ChangeRoute): string {
  return route === "automatic"
    ? "As we know you, this change goes live straight away."
    : "We'll take a quick look before this change goes live. You can check how it's getting on on this page.";
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

// What really happens: one performance stays visible marked Cancelled. A whole-event cancellation keeps the event page on OneShetland, clearly marked
// Cancelled (anyone with the link sees it), and takes the event off the lists, calendar, homepage and feeds. Nothing notifies anyone (see CANCEL_NO_NOTIFY_LINE).
export const CANCEL_PERFORMANCE_CONFIRM = "This performance will show as cancelled on OneShetland straight away.";
export const CANCEL_EVENT_CONFIRM = "This keeps the event page on OneShetland, clearly marked Cancelled, and takes it off the lists and calendar.";
/** Kept for older callers: the performance wording. */
export const CANCEL_CONFIRM_PROMPT = CANCEL_PERFORMANCE_CONFIRM;

/* ── Phase 2 screens: submitting, My submissions, looking after an approved event ─────────────────────────────────────────────── */

export type SubmissionStatusName = "pending" | "approved" | "changes_requested" | "rejected" | "withdrawn";

export const STATUS_LABEL: Record<SubmissionStatusName, string> = {
  pending: "With us",
  approved: "Approved",
  changes_requested: "We need a change",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const STATUS_EXPLAINER: Record<SubmissionStatusName, string> = {
  pending: "We'll look at this soon. You don't need to do anything.",
  approved: "Your event is on OneShetland.",
  changes_requested: "We'd like something changed before it can go on. You're welcome to send it again with the change.",
  rejected: "We couldn't put this one on OneShetland.",
  withdrawn: "You took this back, so we won't look at it.",
};

export const SUBMIT_THANKS_TITLE = "Thank you, we'll look at this soon";
export const SUBMIT_THANKS_BODY = "Your event has been sent to us. It isn't on OneShetland yet. We'll look at it, and you can check how it's getting on in My events & submissions.";

export const FORM_INTRO = "Tell us about your event. It takes a few minutes, and we look at every one before it goes on OneShetland.";
export const ORGANISER_HELP = "The club, group or charity running it. This is the name people will see.";
export const DESCRIPTION_HELP = "A few sentences about what's happening. Please leave out links, email addresses and phone numbers. There are separate boxes for those.";
export const DATES_HELP = "Add each performance. Use Shetland time. If it runs more than once, choose Add another performance: it copies the last date and times, so you only change what is different.";
export const TICKET_LINK_HELP = "Only if people book somewhere else online. It must start with https://";
export const POSTER_HELP = "A picture or poster, if you have one. JPG, PNG or WebP, up to 10 MB.";
export const REVIEW_INTRO = "This is exactly what we will see. Check it, then send it to us.";
export const NOT_OPEN_YET = "We aren't taking event submissions just yet. Thank you for your patience. Nothing has been sent or saved.";
export const NOT_AVAILABLE_YET = "Sending an event isn't available yet. Please check back soon. Nothing has been sent or saved.";
/** For pages that are not about sending: My submissions, looking after an event, staff queues. */
export const PAGE_NOT_AVAILABLE_YET = "This isn't available yet. Please check back soon.";
export const SIGN_IN_TO_SUBMIT = "Please sign in to tell us about an event. You'll come straight back here.";

export const POSTER_DEFERRED = "Adding a poster is coming soon.";

/** What happened to a change the person asked for, told honestly. */
export function changeOutcomeLine(status: string): string {
  if (status === "auto_approved" || status === "approved") return CHANGE_APPLIED_LINE;
  return CHANGE_PENDING_LINE;
}

export const CHANGE_FORM_INTRO = "Tell us what needs to change. Some changes go live straight away. Others, like a new name or poster, we look at first. After you send it, this page tells you which.";
export const CHANGE_FORM_NOTHING = "Nothing has changed yet. Change at least one thing, then send it.";

export const PERFORMANCE_CANCELLED_BUTTON = "This performance is cancelled";
export const EVENT_CANCELLED_BUTTON = "The whole event is cancelled";
export const RESTORE_HINT = "Changed your mind? You can undo this for 24 hours, as long as nothing else has changed.";
export const HIDDEN_EVENT_LINE = "This event is cancelled. Its page stays on OneShetland, clearly marked Cancelled, and it is off the lists and calendar.";
export const EVENT_RESTORED_LINE = "Done. The event is back on the lists and calendar, and no longer marked Cancelled.";
export const PERFORMANCE_RESTORED_LINE = "Done. That performance is back on.";
/** My events & submissions: an approved event that has since been cancelled. */
export const CANCELLED_EVENT_EXPLAINER = "This event is cancelled. Its page stays on OneShetland, clearly marked Cancelled.";

/** Why a particular status can't be acted on. */
export function cannotChangeLine(reason: "past" | "decided" | "restore_window"): string {
  if (reason === "past") return "This one has already started, so it can't be changed here.";
  if (reason === "decided") return "This has already been decided, so it can't be changed.";
  return "It's too late to undo this here. Please ask OneShetland and we'll sort it out.";
}

/** One line for the history of what happened to an event. */
export function historyLine(entry: { action: string; actor_kind: string }): string {
  const who = entry.actor_kind === "staff" ? "OneShetland" : "You";
  const what: Record<string, string> = {
    performance_cancelled: "marked a performance as cancelled",
    performance_restored: "undid the cancellation of a performance",
    performance_note: "changed a note on a performance",
    event_cancelled: "marked the whole event as cancelled",
    event_restored: "undid the cancellation of the event",
    change_requested: "asked for a change",
    change_withdrawn: "took back a request for a change",
    change_auto_approved: "asked for a change, and it went live straight away",
    change_approved: "approved a change you asked for",
    change_rejected: "did not accept a change you asked for",
  };
  const verb = what[entry.action];
  return verb ? `${who} ${verb}` : "A change was made";
}

/** Staff-facing: what approving does. Never OneShetland's own event. */
export const APPROVE_CONFIRM = (organiser: string) =>
  `Approving publishes this as a community event credited to ${organiser.trim() || "the named organiser"}. It will not be shown as organised by OneShetland.`;

/** Shown on the change form when the database says this organiser is trusted. */
export const TRUSTED_CHANGE_INTRO = "Changes to dates, description, place, ticket link and contact details go live straight away. A new name, poster or price is always checked by us first.";
