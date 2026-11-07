/**
 * event-entry-points.ts — the "Add an Event or Activity" entry points: one switch, one destination, one set of words.
 *
 * The ONLY activation signal on the website is the server-only variable EVENT_FRONT_DOOR === "on" (the same one the page itself uses). It is read on
 * the server and passed to client components as a plain boolean prop; it is never a NEXT_PUBLIC_ variable. With it off, every entry point renders
 * nothing at all (not even for an administrator previewing the page), so the site is exactly as it was and nobody is ever sent to a 404.
 * Pure and server-safe: no imports.
 */

export const ADD_EVENT_HREF = "/whats-on/add";
export const ADD_EVENT_LABEL = "Add an Event or Activity";
/** The mobile menu's quieter, sentence-case wording. */
export const ADD_EVENT_MENU_LABEL = "Add an event or activity";
export const ADD_EVENT_SIDEBAR_LABEL = "Add an Event or Activity";

export const ADD_EVENT_SHORT_DESC = "Tell the isles about a gig, market, class or group.";
export const ADD_EVENT_ACCOUNT_DESC = "Share an event or activity. Our team checks independent events before they appear.";
export const ADD_EVENT_EMPTY_PROMPT = "Try a different date or category, or tell us about something that is coming up.";

/** True only when EVENT_FRONT_DOOR is exactly "on". Anything else (unset, "ON", "true", "1", " on") is off. */
export function entryPointsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EVENT_FRONT_DOOR === "on";
}

/**
 * Props to spread onto a client component so that, when the feature is OFF, the prop is absent altogether (not `false`): the server-rendered page then
 * carries exactly the same bytes as before the entry points existed.
 */
export function entryPointProps(env?: Record<string, string | undefined>): { addEvent?: true } {
  return entryPointsEnabled(env) ? { addEvent: true } : {};
}
