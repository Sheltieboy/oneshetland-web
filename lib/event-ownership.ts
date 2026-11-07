/**
 * event-ownership.ts — the pure rules for "Who is organising this?" in the unified Add an Event or Activity journey.
 *
 * Events and Regular Activities should preferably belong to a Business or a Hub the member is AUTHORISED to manage. Only those are ever
 * offered. A one-off community event can still be sent as an independent submission (staff approve it). A Regular Activity is NEVER
 * independent: it needs a Business or a Hub, and a member with neither is told so plainly.
 *
 * This file is pure (no I/O, no React). It owns: shaping the organiser list, the step state machine, the link builders and the
 * "start a hub?" suggestion rule. Imports only the shared category rules.
 */
import { ASK_ANSWERS, isSharedCategory, routeForCategory } from "./event-categories";
import { frontDoorOutcome } from "./event-front-door";

/* ── organisers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type OrganiserKind = "business" | "hub";
/** The ONLY organiser data that reaches the browser: no emails, owners, Stripe ids or other private fields. */
export type Organiser = { kind: OrganiserKind; id: string; name: string; slug: string | null; logoUrl: string | null };

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const safeLogo = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/[^\s"'<>]+$/.test(v) && v.length <= 600 ? v : null);

function shapeOne(kind: OrganiserKind, r: unknown): Organiser | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const id = typeof o.id === "string" && SAFE_ID.test(o.id) ? o.id : null;
  const name = text(o.name, 120);
  if (!id || !name) return null;
  if (o.is_active === false && kind === "hub") return null;               // an inactive hub cannot run anything (getMyHubs already filters; belt and braces)
  const slug = typeof o.slug === "string" && SAFE_SLUG.test(o.slug) ? o.slug : null;
  return { kind, id, name, slug, logoUrl: safeLogo(o.logo_url) };
}

/**
 * Turns what the two loaders returned into the minimal list the page shows: businesses first (A to Z), then hubs (A to Z); malformed rows
 * and duplicate ids dropped; only id, name, slug and an https logo kept. The loaders already return only what the member may manage
 * (businesses they own; hubs where they are an active owner or committee member), and nothing here widens that.
 */
export function shapeOrganisers(businesses: readonly unknown[] | null | undefined, hubs: readonly unknown[] | null | undefined): Organiser[] {
  const out: Organiser[] = [];
  const seen = new Set<string>();
  for (const [kind, list] of [["business", businesses], ["hub", hubs]] as const) {
    const part: Organiser[] = [];
    for (const r of Array.isArray(list) ? list : []) {
      const o = shapeOne(kind, r);
      if (!o || seen.has(`${kind}:${o.id}`)) continue;
      seen.add(`${kind}:${o.id}`);
      part.push(o);
    }
    out.push(...part.sort((a, b) => a.name.localeCompare(b.name, "en-GB")));
  }
  return out;
}

export const hubKey = (o: Pick<Organiser, "id" | "slug">): string => o.slug ?? o.id;

/* ── links: each one targets an existing editor and changes nothing about it ─────────────────────────────────────────────────── */

/**
 * Events. A business goes to its Events page (the same door the dashboard uses; it carries the commercial-terms gate and the "New event"
 * button, so choosing here can never skip the terms). A hub goes to its Events page, where adding an event is inline.
 */
export function organiserEventsHref(o: Pick<Organiser, "kind" | "id" | "slug">): string {
  return o.kind === "business" ? `/business/${o.id}/manage/events` : `/hubs/${hubKey(o)}/manage/events`;
}
/** Regular Activities: straight to the existing "New activity" editor of that business or hub. */
export function organiserActivitiesHref(o: Pick<Organiser, "kind" | "id" | "slug">): string {
  return o.kind === "business" ? `/business/${o.id}/manage/activities/new` : `/hubs/${hubKey(o)}/manage/activities/new`;
}
export const START_HUB_HREF = "/hubs/new";
export const ADD_BUSINESS_HREF = "/directory/new";
export const MY_SUBMISSIONS_HREF = "/account/event-submissions";
export const FRONT_DOOR_PATH = "/whats-on/add";

/** Sign-in with the way back kept: the front door, and the chosen category if any. */
export function signInHref(category?: string | null): string {
  const back = isSharedCategory(category) ? `${FRONT_DOOR_PATH}?category=${category}` : FRONT_DOOR_PATH;
  return `/sign-in?next=${encodeURIComponent(back)}`;
}

/** Every internal link the journey can emit, for the link-existence test. */
export function allJourneyLinks(sample: Pick<Organiser, "kind" | "id" | "slug">[]): string[] {
  return [START_HUB_HREF, ADD_BUSINESS_HREF, MY_SUBMISSIONS_HREF, FRONT_DOOR_PATH, signInHref(null),
    ...sample.flatMap((o) => [organiserEventsHref(o), organiserActivitiesHref(o)])];
}

/* ── the state machine ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type OrganiserChoice = { kind: OrganiserKind; id: string } | { kind: "independent" };
type Decision = "organiser" | "category" | "answer";

export type OwnershipState = {
  organiser: OrganiserChoice | null;
  slug: string | null;
  answer: string | null;
  /** The order the person decided things, newest last. A category that arrived in the link is NOT in it (they did not choose it here). */
  trail: Decision[];
};

export type OwnershipAction =
  | { type: "organiser"; choice: OrganiserChoice }
  | { type: "category"; slug: string }
  | { type: "answer"; value: string }
  | { type: "back" }
  | { type: "changeOrganiser" }
  | { type: "changeCategory" }
  | { type: "oneOff" }          // "this is really a one-off event" (from the regular-activity explanation)
  | { type: "restart" };

/** A category in the link (?category=) is remembered, but the organiser question still comes first. */
export function initialState(initialCategory?: string | null): OwnershipState {
  return { organiser: null, slug: isSharedCategory(initialCategory) ? initialCategory : null, answer: null, trail: [] };
}

const sameChoice = (organisers: readonly Organiser[], c: OrganiserChoice): boolean =>
  c.kind === "independent" || organisers.some((o) => o.kind === c.kind && o.id === c.id);

/** The organiser the state really points at: an id that is not in the authorised list resolves to nothing, so a foreign id can never reach an outcome. */
export function resolveOrganiser(state: OwnershipState, organisers: readonly Organiser[]): Organiser | "independent" | null {
  const c = state.organiser;
  if (!c) return null;
  if (c.kind === "independent") return "independent";
  return organisers.find((o) => o.kind === c.kind && o.id === c.id) ?? null;
}

const drop = (trail: Decision[], d: Decision) => trail.filter((x) => x !== d);

export function reduce(state: OwnershipState, action: OwnershipAction, organisers: readonly Organiser[]): OwnershipState {
  switch (action.type) {
    case "organiser":
      if (!sameChoice(organisers, action.choice)) return state;
      return { ...state, organiser: action.choice, trail: [...drop(state.trail, "organiser"), "organiser"] };
    case "category":
      if (!isSharedCategory(action.slug)) return state;
      return { ...state, slug: action.slug, answer: null, trail: [...drop(drop(state.trail, "category"), "answer"), "category"] };
    case "answer":
      if (!ASK_ANSWERS.some((a) => a.value === action.value)) return state;
      return { ...state, answer: action.value, trail: [...drop(state.trail, "answer"), "answer"] };
    case "changeOrganiser":
      return { ...state, organiser: null, trail: drop(state.trail, "organiser") };
    case "changeCategory":
      return { ...state, slug: null, answer: null, trail: drop(drop(state.trail, "category"), "answer") };
    case "back": {
      const last = state.trail[state.trail.length - 1];
      if (last === "answer") return { ...state, answer: null, trail: state.trail.slice(0, -1) };
      if (last === "category") return { ...state, slug: null, answer: null, trail: state.trail.slice(0, -1) };
      // Nothing chosen here is left to undo except (possibly) the organiser, or a category that came in the link.
      if (state.organiser) return { ...state, organiser: null, trail: drop(state.trail, "organiser") };
      if (state.slug) return { ...state, slug: null, answer: null };
      return state;
    }
    case "oneOff": {
      if (!state.slug) return state;
      // A category that could be either becomes a dated event; a category that is only ever a weekly activity goes back to the list.
      if (routeForCategory(state.slug) === "ask") return { ...state, answer: "dates", trail: [...drop(state.trail, "answer"), "answer"] };
      return { ...state, slug: null, answer: null, trail: drop(drop(state.trail, "category"), "answer") };
    }
    case "restart":
      return initialState(null);
  }
}

export type OutcomeKind = "organiser_event" | "organiser_activity" | "independent_event" | "independent_activity";
export type OwnershipStep =
  | { step: "organiser" }
  | { step: "category"; organiser: Organiser | "independent" }
  | { step: "ask"; organiser: Organiser | "independent"; slug: string }
  | { step: "outcome"; outcome: OutcomeKind; organiser: Organiser | "independent"; slug: string; href: string | null };

/** Where the journey is now. Pure function of state + the authorised list. */
export function currentStep(state: OwnershipState, organisers: readonly Organiser[]): OwnershipStep {
  const org = resolveOrganiser(state, organisers);
  if (!org) return { step: "organiser" };
  const cat = frontDoorOutcome(state.slug, state.answer);
  if (cat.kind === "choose") return { step: "category", organiser: org };
  if (cat.kind === "ask") return { step: "ask", organiser: org, slug: cat.slug };
  if (org === "independent") {
    return { step: "outcome", outcome: cat.kind === "event" ? "independent_event" : "independent_activity", organiser: org, slug: cat.slug, href: null };
  }
  return cat.kind === "event"
    ? { step: "outcome", outcome: "organiser_event", organiser: org, slug: cat.slug, href: organiserEventsHref(org) }
    : { step: "outcome", outcome: "organiser_activity", organiser: org, slug: cat.slug, href: organiserActivitiesHref(org) };
}

/** A key that changes whenever the visible step changes, so the heading can take focus exactly then. */
export function stepKey(s: OwnershipStep): string {
  return s.step === "outcome" ? `outcome:${s.outcome}:${s.organiser === "independent" ? "i" : `${s.organiser.kind}:${s.organiser.id}`}` : s.step;
}

/* ── the gentle "start a hub?" suggestion ───────────────────────────────────────────────────────────────────────────────────── */

/**
 * RULE (documented, tested): suggest a free hub once a member has sent THREE OR MORE independent events that they have not withdrawn
 * (counted from their own submission list, which holds 100 at most), and only when we KNOW they do not already help run a hub. If the
 * hub list could not be loaded (null) we say nothing. It is only ever a suggestion: it blocks nothing and changes nothing.
 * `justSubmitted` adds the one they have just sent (the success page loads before it exists).
 */
export const HUB_SUGGESTION_THRESHOLD = 3;
export function shouldSuggestHub(input: { statuses: readonly string[]; managesHub: boolean | null; justSubmitted?: boolean }): boolean {
  if (input.managesHub !== false) return false;
  const count = input.statuses.filter((s) => s !== "withdrawn").length + (input.justSubmitted ? 1 : 0);
  return count >= HUB_SUGGESTION_THRESHOLD;
}
