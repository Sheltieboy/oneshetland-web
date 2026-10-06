/**
 * Replacing a private invitation — the decision and the guard, kept pure so they can be tested without a browser.
 *
 * Generating a new invitation revokes the current one. If the current one has already been EMAILED, the recipient holds that
 * link, so replacing it breaks their link: that needs an explicit, visible confirmation, and the server independently refuses
 * unless it is told the replacement was confirmed (issueInvitationAction's `replaceSent`). This module only decides what the
 * screen asks and what it tells the server; it never grants anything the server does not also check.
 */

export interface ReplacementPlan {
  /** What to ask the administrator first, or null when nothing needs confirming (never issued / nothing to revoke). */
  confirm: null | { title: string; body: string; confirmLabel: string; cancelLabel: string; danger: true; emailed: boolean };
  /** The flag sent to the server. True ONLY for an invitation that has been emailed, and only meaningful once confirmed. */
  replaceSent: boolean;
}

export function replacementPlan(i: { emailed: boolean; usable: boolean }): ReplacementPlan {
  if (i.emailed) return {
    replaceSent: true,
    confirm: {
      emailed: true, danger: true, cancelLabel: "Cancel — keep the current invitation", confirmLabel: "Revoke the emailed link and replace it",
      title: "This invitation has already been emailed",
      body: "The link you emailed will stop working as soon as you replace it, and the person who received it will see an invalid link. You would then have to send them the new link yourself. Nothing is sent automatically.",
    },
  };
  if (i.usable) return {
    replaceSent: false,
    confirm: {
      emailed: false, danger: true, cancelLabel: "Cancel", confirmLabel: "Generate new invitation",
      title: "Replace the current invitation?",
      body: "Generating a new one revokes the current link at once, so only one invitation is ever valid. It has not been emailed.",
    },
  };
  return { replaceSent: false, confirm: null };
}

export const TIMEOUT_MS = 45_000;

export type GuardedResult<T> = { ok: true; value: T } | { ok: false; error: string; kind: "rejected" | "timeout" };

/**
 * Run a server action so the screen can NEVER be left waiting. A request that is refused, lost, answered with an error page
 * (for instance a tab left open across a deploy, whose action no longer exists) or never answered becomes a plain error.
 */
export async function runGuarded<T>(fn: () => Promise<T>, ms: number = TIMEOUT_MS): Promise<GuardedResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<GuardedResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, kind: "timeout", error: "No answer came back from the server. Nothing is shown as changed — refresh the page and check the Invitation status before trying again." }), ms);
  });
  try {
    return await Promise.race([fn().then((value): GuardedResult<T> => ({ ok: true, value })), timeout]);
  } catch {
    return { ok: false, kind: "rejected", error: "The request didn’t go through. This page may be out of date (for example after an update) — it has been refreshed. Nothing was changed; try again." };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
