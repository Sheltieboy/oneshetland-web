/**
 * event-front-door.ts — pure rules for the hidden "Add an Event or Activity" page: who may see it, and where a choice leads.
 * No imports beyond the shared category list.
 */
import { routeForCategory, routeForAskAnswer, isSharedCategory } from "./event-categories";

/**
 * The page is hidden. It opens only when the SERVER-ONLY switch EVENT_FRONT_DOOR is exactly "on" (never a NEXT_PUBLIC_ variable, which
 * would be public), or for a signed-in administrator previewing it. Everyone else gets a 404.
 */
export function frontDoorAccess(input: { flag: string | undefined | null; isStaff: boolean }): "open" | "staff_preview" | "hidden" {
  if (input.flag === "on") return "open";
  return input.isStaff ? "staff_preview" : "hidden";
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
