import type { EditionFlags } from "@/lib/editions/data.server";

/** What a programme card needs to render its "Add to my plan" button. signedIn=false renders a sign-in link instead. */
export type PlanCtx = { editionId: string; signedIn: boolean; sessions: Set<string>; events: Set<string>; nextPath: string };
export const planCtx = (editionId: string, flags: EditionFlags | null, nextPath: string): PlanCtx =>
  ({ editionId, signedIn: flags !== null, sessions: new Set(flags?.sessions ?? []), events: new Set(flags?.events ?? []), nextPath });
