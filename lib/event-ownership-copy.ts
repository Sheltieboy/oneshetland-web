/**
 * event-ownership-copy.ts — the wording of the "Who is organising this?" journey. Plain, warm, no jargon, no "wee".
 * Pure strings so the wording is testable. Rules held by tests: nothing here says or implies that a Regular Activity can be
 * submitted independently; nothing promises a notification, instant publishing or approval.
 */
export const ORGANISER_STEP_TITLE = "Who is organising this?";
export const ORGANISER_STEP_HELP = "Pick the one that runs it. Events and regular activities work best when they belong to a business or a group people can find.";
export const OPT_BUSINESS_HINT = "A business you run";
export const OPT_HUB_HINT = "A hub or community group you help run";
export const OPT_INDEPENDENT_TITLE = "Independent event";
export const OPT_INDEPENDENT_HINT = "A one-off event, run by you or a group that isn't on OneShetland. We look at it before it goes on.";
export const NO_ORGANISERS_LINE = "You don't run a business or a hub on OneShetland yet. A one-off event can still be sent on its own. If you run something regularly, a business or club can be added free.";
export const ORGANISERS_UNAVAILABLE_LINE = "We couldn't check which businesses and hubs you run just now, so only a one-off event is on offer. Please try again in a few minutes.";

export const CATEGORY_STEP_HELP = "Pick the closest match. You can change your mind on the next step.";
export const CHANGE_ORGANISER = "Change who is organising this";
export const BACK = "Back";

export const SIGN_IN_FIRST_TITLE = "Please sign in first";
export const SIGN_IN_FIRST_BODY = "We need your account to show the businesses and hubs you run, and to keep track of what you send us. You'll come straight back here. You must be 18 or over to add an event.";

export function continueEventsLabel(name: string): string { return `Continue to ${name}'s events`; }
export function continueActivitiesLabel(name: string): string { return `Continue to ${name}'s regular activities`; }
export const ORGANISER_EVENT_NOTE = "This opens the events page you already use. Nothing about how your events are published changes.";
export const ORGANISER_ACTIVITY_NOTE = "This opens the regular activities page you already use. Nothing about how your activities are published changes.";

export const ACTIVITY_PANEL_TITLE = "A regular activity needs a business or a hub";
export const ACTIVITY_PANEL_WHY = "Regular activities, like a weekly class, club or group, need someone who looks after them: so people can see who runs it, and so changes, cancellations and messages to the people following it have an owner.";
export const ACTIVITY_PANEL_NEED = "To add one you need a business or a hub. Both are free to set up:";
export const START_HUB_LABEL = "Start a free hub";
export const START_HUB_HINT = "For a club, group, charity or community organisation.";
export const ADD_BUSINESS_LABEL = "Add your business";
export const ADD_BUSINESS_HINT = "If it is run by a business or sole trader.";
export const ONE_OFF_INSTEAD = "It's really a one-off event";
export const ONE_OFF_INSTEAD_HINT = "A one-off event, or a run of specific dates, can be sent without a business or hub.";
export const PICK_ANOTHER_KIND = "Choose a different kind of thing";

/* the gentle hub suggestion (My submissions, and after sending) */
export const HUB_SUGGESTION_TITLE = "Putting on events regularly?";
export const HUB_SUGGESTION_BODY = "A free hub gives your group its own page on OneShetland, and lets you manage your events and regular activities in one place. You don't need one for a one-off event. This is only a thought.";
export const HUB_SUGGESTION_CHECK = "Events from a hub are still checked before they appear across the islands, unless the hub is verified.";
export const HUB_SUGGESTION_LINK = "Find out about starting a hub";

export const ALL_COPY_FOR_TESTS = (): string[] => [
  ORGANISER_STEP_TITLE, ORGANISER_STEP_HELP, OPT_BUSINESS_HINT, OPT_HUB_HINT, OPT_INDEPENDENT_TITLE, OPT_INDEPENDENT_HINT, NO_ORGANISERS_LINE,
  ORGANISERS_UNAVAILABLE_LINE, CATEGORY_STEP_HELP, CHANGE_ORGANISER, SIGN_IN_FIRST_TITLE, SIGN_IN_FIRST_BODY, continueEventsLabel("X"),
  continueActivitiesLabel("X"), ORGANISER_EVENT_NOTE, ORGANISER_ACTIVITY_NOTE, ACTIVITY_PANEL_TITLE, ACTIVITY_PANEL_WHY, ACTIVITY_PANEL_NEED,
  START_HUB_LABEL, START_HUB_HINT, ADD_BUSINESS_LABEL, ADD_BUSINESS_HINT, ONE_OFF_INSTEAD, ONE_OFF_INSTEAD_HINT, PICK_ANOTHER_KIND,
  HUB_SUGGESTION_TITLE, HUB_SUGGESTION_BODY, HUB_SUGGESTION_CHECK, HUB_SUGGESTION_LINK,
];
