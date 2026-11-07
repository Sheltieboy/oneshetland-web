/**
 * event-front-door.ts — pure rules for the hidden "Add an Event or Activity" page: who may see it, and where a choice leads.
 * No imports beyond the shared category list.
 */
import { routeForCategory, routeForAskAnswer, isSharedCategory } from "./event-categories";

/**
 * The page is hidden. It opens only when the SERVER-ONLY switch EVENT_FRONT_DOOR is exactly "on" (never a NEXT_PUBLIC_ variable, which
 * would be public), or for a signed-in administrator previewing it, or for an ALLOWLISTED TESTER (controlled acceptance testing: the database switch is 'testers' and
 * the account is on its list; see migration 20261230030000). Everyone else gets a 404.
 */
export function frontDoorAccess(input: { flag: string | undefined | null; isStaff: boolean; isTester?: boolean }): "open" | "staff_preview" | "tester" | "hidden" {
  if (input.flag === "on") return "open";
  if (input.isStaff) return "staff_preview";
  return input.isTester === true ? "tester" : "hidden";
}

/**
 * Does this viewer get a link to "My events & submissions"? EXACTLY when /account/event-submissions would open for them: the same rule as the gate
 * (frontDoorAccess), so the link can never lead to a 404 and is never shown to someone the page would refuse. Pure; the one place this is decided.
 */
export function myEventsEntryVisible(input: { flag: string | undefined | null; isStaff: boolean; isTester?: boolean }): boolean {
  return frontDoorAccess(input) !== "hidden";
}

/** Props to spread so that the prop is ABSENT (not false) for everyone who may not open the page: their account pages carry exactly the same bytes as before. */
export function myEventsProps(visible: boolean): { myEvents?: true } {
  return visible ? { myEvents: true } : {};
}

export type FrontDoorOutcome =
  | { kind: "choose" }                       // nothing (or something unknown) chosen yet
  | { kind: "ask"; slug: string }            // needs the one question
  | { kind: "event"; slug: string }
  | { kind: "activity"; slug: string };

/** Where a category (and, for 'ask' categories, the answer to the one question) leads. Unknown input never routes anywhere. */
export function frontDoorOutcome(slug: unknown, answer?: unknown): FrontDoorOutcome {
  if (!isSharedCategory(slug)) return { kind: "choose" };
  const r = routeForCategory(slug);
  if (r === "event") return { kind: "event", slug };
  if (r === "activity") return { kind: "activity", slug };
  const a = routeForAskAnswer(answer);
  return a ? { kind: a, slug } : { kind: "ask", slug };
}
