/**
 * The two Editions launch switches, as the administrator reads them. Pure: no network, no React.
 *
 * These used to be ONE setting. `editions.enabled` meant both "visitors may discover published Editions" and "any signed-in user may start
 * Editions for their Business or Hub", so opening Editions to the public also opened organiser registration to the whole membership on the same
 * day. They are now separate, and the database is still the authority for both (editions_enabled / editions_signup_open, each failing closed).
 *
 * Neither switch is a commerce setting, so neither goes through the commerce validator; admin_set_editions_switch takes these two keys and no
 * others. Nothing here decides access — it reads the answer and says plainly what turning it on would do.
 */
export const PUBLIC_KEY = "editions.enabled";
export const SIGNUP_KEY = "editions.signup_open";
export const SWITCH_KEYS = [PUBLIC_KEY, SIGNUP_KEY] as const;
export type SwitchKey = (typeof SWITCH_KEYS)[number];

export type SwitchDef = {
  key: SwitchKey; label: string; help: string;
  /** What becomes true the moment it is switched on. Shown as a list, so nobody has to guess. */ turningOn: string[];
  /** What stays true while it is off, so "off" is never mistaken for "broken". */ whileOff: string;
};

export const SWITCHES: SwitchDef[] = [
  {
    key: PUBLIC_KEY,
    label: "Editions are visible to the public",
    help: "Whether visitors can discover and open published Editions. This does not publish anything by itself: an Edition is public only when it is also approved, entitled, published by its organiser, run by a verified organiser whose Business or Hub is active, and not a test.",
    turningOn: [
      "Every Edition that already meets all those conditions becomes visible to visitors, at once.",
      "Editions appears in the public navigation on the website.",
      "Edition pages become indexable and enter the sitemap.",
    ],
    whileOff: "Organisers and OneShetland staff can still open their own Editions by direct link, with a banner saying they are not public yet.",
  },
  {
    key: SIGNUP_KEY,
    label: "New organisers may start Editions",
    help: "Whether someone who does not already run Editions can start them for a Business or Hub they control. It never affects the people already running one.",
    turningOn: [
      "Any signed-in person who owns a Business, or owns or sits on the committee of a Hub, can start Editions for it.",
      "Each new organiser still has to have its first Edition approved by OneShetland before anything can go public.",
    ],
    whileOff: "Everyone who already runs an Edition keeps full access to it, and OneShetland staff can still set one up for a launch partner.",
  },
];

/** `true` only when the stored value is exactly "true" — the same rule the database applies, so the screen and the database never disagree. */
export const isOn = (config: Record<string, string | undefined>, key: SwitchKey): boolean => (config[key] ?? "").trim().toLowerCase() === "true";

export function validateSwitch(key: unknown, on: unknown): { ok: true; key: SwitchKey; value: "true" | "false" } | { ok: false; error: string } {
  const k = String(key ?? "");
  if (!(SWITCH_KEYS as readonly string[]).includes(k)) return { ok: false, error: "That is not a launch switch." };
  if (typeof on !== "boolean") return { ok: false, error: "Choose on or off." };
  return { ok: true, key: k as SwitchKey, value: on ? "true" : "false" };
}

/**
 * The sentence under the pair. Launch order matters: new organiser access without public visibility is a sensible way to onboard partners
 * quietly, but public visibility with registration closed is the normal launch state and should not read as a mistake.
 */
export function summary(publicOn: boolean, signupOn: boolean): string {
  if (publicOn && signupOn) return "Editions is fully open: visitors can discover published Editions, and anyone eligible can start their own.";
  if (publicOn) return "Published Editions are visible to visitors. New organisers cannot start Editions yet, so only the organisers you already have can add to them.";
  if (signupOn) return "Eligible people can start Editions and work on them privately, but nothing is visible to visitors yet.";
  return "Editions is closed. Nothing is visible to visitors, and nobody new can start one. Existing organisers and OneShetland staff can still work on theirs.";
}
