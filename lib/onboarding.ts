/**
 * lib/onboarding.ts — the join wizard's shape and progress rules.
 *
 * Deliberately client-safe: types, constants and pure functions only. The
 * server-side read lives in onboarding.server.ts (it uses the SSR Supabase
 * client, which cannot be imported into a client component).
 *
 * DESIGN NOTE — why there is no `onboarding_completed` column.
 * Progress is DERIVED from data the user actually has (a display name, a saved
 * card, a connected payout account). Nothing to migrate, nothing to keep in
 * sync, and no way for the flag and the reality to disagree. A user who added
 * a card in the app shows up here as already done, without any backfill.
 *
 * The only stored bit is "I don't want to be asked again", which is a cookie —
 * a preference, not a fact about the account.
 */

export type StepId = "you" | "audience" | "card" | "payouts" | "business";

export type StepState = {
  id: StepId;
  /** Shown in the progress rail. */
  label: string;
  /** Optional steps can be skipped without leaving anything half-built. */
  optional: boolean;
  /** True when the underlying data already exists. */
  done: boolean;
};

/** Everything the wizard needs to decide what to show. Read once, server-side. */
export type OnboardingState = {
  userId: string;
  email: string | null;
  fullName: string;
  displayName: string;
  locationArea: string;
  avatarUrl: string;
  gamesHandle: string;
  hasCard: boolean;
  payoutsConnected: boolean;
  payoutsPending: boolean;
  /** Businesses this person already owns — changes the last step's wording. */
  ownedBusinesses: { id: string; name: string; slug: string | null }[];
};

export const SKIP_COOKIE = "os_welcome_skipped";

/** Step definitions in order, with completion derived from real data. */
export function steps(s: OnboardingState): StepState[] {
  return [
    {
      id: "you",
      label: "You",
      optional: false,
      // Keyed on display_name ALONE, deliberately. Sign-up always sets
      // full_name, so counting that as "done" made every new account skip this
      // step and land on the card — which is both the wrong first impression
      // and the reason nobody would ever pick an area or a games alias.
      // display_name is what this step actually collects, so it's what decides
      // whether the step is finished.
      done: Boolean(s.displayName.trim()),
    },
    { id: "audience", label: "Your Shetland", optional: true, done: false },
    { id: "card", label: "Paying", optional: true, done: s.hasCard },
    {
      id: "payouts",
      label: "Getting paid",
      optional: true,
      done: s.payoutsConnected || s.payoutsPending,
    },
    {
      id: "business",
      label: "Your business",
      optional: true,
      done: s.ownedBusinesses.length > 0,
    },
  ];
}

/**
 * Where to drop someone in. First not-done step, so a returning user resumes
 * rather than re-reading what they've already finished. "audience" is never
 * `done` (it's a preference with no wrong answer), so it's excluded from the
 * resume scan — otherwise everyone would always land on it.
 */
export function firstIncomplete(s: OnboardingState): StepId {
  const found = steps(s).find((st) => st.id !== "audience" && !st.done);
  return found?.id ?? "business";
}

/** Handle rules, matched to the app's own validation so the two never disagree. */
export const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
export const HANDLE_HINT = "3–20 letters, numbers or underscores";

/** Areas, mirrored from ProfileEditForm so the wizard offers the same list. */
export const AREAS = [
  "Lerwick", "Scalloway", "Brae", "Aith", "Walls", "Sandness", "Sandwick", "Bigton", "Cunningsburgh",
  "Bixter", "Whiteness", "Weisdale", "Tingwall", "Nesting", "Vidlin", "Voe", "Mossbank", "Toft",
  "Hillswick", "North Roe", "Yell", "Unst", "Fetlar", "Whalsay", "Out Skerries", "Bressay", "Burra",
  "Trondra", "Foula", "Fair Isle", "Papa Stour",
] as const;
