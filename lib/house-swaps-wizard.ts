/**
 * house-swaps-wizard.ts — the three steps of the advert form: titles, which fields belong to which step, and per-step validation (pure).
 * The server (and validateAdvert) still check everything at the end; this only lets the form say what is missing step by step.
 */
import { validateAdvert, type AdvertErrors, type AdvertForm } from "./house-swaps.ts";

export const WIZARD_STEPS = [
  { n: 1, short: "Your home", title: "Your current home", hint: "Tell people what you have. A broad area is all we need: never an address." },
  { n: 2, short: "What you want", title: "What you're looking for", hint: "Everything here is optional. The more open you are, the more adverts could suit you." },
  { n: 3, short: "Finish", title: "Finish your advert", hint: "A few words, photos and a last check. Then it goes to our team for a quick look." },
] as const;
export type WizardStep = 1 | 2 | 3;

/** Which error keys belong on which step. */
export const STEP_FIELDS: Record<WizardStep, (keyof AdvertErrors)[]> = {
  1: ["have_area_id", "have_bedrooms", "have_type"],
  2: ["want_area_ids", "want_bedrooms"],
  3: ["headline", "description", "want_notes", "acknowledged"],
};

export function validateStep(step: WizardStep, f: AdvertForm): { ok: boolean; errors: AdvertErrors } {
  const all = validateAdvert(f).errors;
  const errors: AdvertErrors = {};
  for (const k of STEP_FIELDS[step]) if (all[k]) errors[k] = all[k];
  return { ok: Object.keys(errors).length === 0, errors };
}

/** The earliest step that has an error (used when the server sends field errors back). */
export function firstStepWithError(errors: AdvertErrors): WizardStep | null {
  for (const s of [1, 2, 3] as WizardStep[]) if (STEP_FIELDS[s].some((k) => errors[k])) return s;
  return null;
}

export const clampStep = (n: number): WizardStep => (n <= 1 ? 1 : n >= 3 ? 3 : (n as WizardStep));
