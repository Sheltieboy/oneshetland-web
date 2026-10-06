/**
 * The two things the Launch workflow rail does by itself. Both are the page's OWN server actions, called the same way the
 * page's own buttons call them (guarded, so a failed request is an error and never a dead button):
 *   mark_ready     → setStageAction(id, "ready_to_invite")   (what Status → "Mark ready to invite" does)
 *   open_claiming  → setClaimModeAction(id, "live")           (what Invitation → "Open claiming" does)
 * Everything else — generating an invitation (its replace-an-emailed-link warning and in-memory link), the email and its
 * send, claims, grants — is deliberately a jump to the section that owns it, so none of those safeguards is duplicated.
 */
import { setClaimModeAction, setStageAction } from "@/app/admin/launch-partners/actions";
import { runGuarded } from "./invitation-replace";
import type { DirectAction } from "./workflow";

export async function runWorkflowAction(id: string, action: DirectAction): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await runGuarded(() => (action === "mark_ready" ? setStageAction(id, "ready_to_invite") : setClaimModeAction(id, "live")));
  if (!g.ok) return { ok: false, error: g.error };
  return g.value.ok ? { ok: true } : { ok: false, error: (g.value as { error: string }).error };
}
