"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { adminError, isUuid } from "../helpers";
import { DECISIONS, decisionNoteProblem, type Decision } from "./review";

/** One decision on one Edition. Approving also records the organiser's identity check (the database does both in one step). */
export type Result = { ok: true } | { ok: false; error: string };

export async function reviewEditionAction(input: { editionId: string; decision: string; note?: string }): Promise<Result> {
  await requireAdmin();
  if (!isUuid(input.editionId)) return { ok: false, error: "Unknown Edition." };
  if (!(DECISIONS as string[]).includes(input.decision)) return { ok: false, error: "Choose a decision." };
  const decision = input.decision as Decision;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
  // The reserved-name rule needs facts only the database holds, so only the note rules every decision shares are checked here; the database refuses the rest and its words are shown.
  const problem = decision === "approve" ? null : decisionNoteProblem(decision, note);
  if (problem) return { ok: false, error: problem };
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("admin_review_edition", { p_edition: input.editionId, p_decision: decision, p_note: note || null });
    if (error) return { ok: false, error: adminError(error.message) };
    revalidatePath("/admin/editions/approvals");
    revalidatePath(`/admin/editions/approvals/${input.editionId}`);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) { return { ok: false, error: adminError(e instanceof Error ? e.message : "") }; }
}
