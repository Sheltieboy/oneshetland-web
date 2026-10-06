/**
 * The Launch workflow — where one campaign stands and what to do next, for the sticky rail (desktop) and bar (mobile).
 *
 * It holds NO state of its own. Every step is a pure reading of facts the page already has: the pipeline row (stage,
 * invitation, claim, plan grant, timestamps), the claim mode on the preview, and the SAVED email draft. The headline status
 * is the page's own derivePipelineStatus; "email is ready" is the page's own checkEmail. Nothing is stored, nothing is written.
 *
 * Steps (the order Darren works in):
 *   prepare → review preview → review business page → mark ready → generate invitation → open claiming → review email →
 *   send → wait for response → approve claim → grant Launch Partner → ready to go live → live
 *
 * "Review preview" and "Review business page" are jump-only: the database does not record that a person reviewed them
 * (and this file must not invent that fact), so they never block and are never "current"; marking the partner ready is
 * the decision that follows them.
 *
 * Pure: no database, no framework.
 */
import { checkEmail } from "./email.ts";
import { derivePipelineStatus, inviteUsable, isClaimed, STATUS_LABEL, STATUS_TONE, type PipelineRow, type PipelineStatus } from "./status.ts";

export type StepId =
  | "prepare" | "review_preview" | "review_page" | "mark_ready" | "generate_invite" | "open_claiming" | "review_email"
  | "send" | "wait" | "approve_claim" | "grant" | "owner_review" | "go_live" | "live";

export type StepState = "complete" | "current" | "future" | "attention";

/** Where a step leads: a section on this page, or an existing screen. */
export type StepTarget = { kind: "section"; id: "preview" | "page" | "invitation" | "email" | "grant" | "status" } | { kind: "href"; href: string };

/** The only two actions the rail performs itself — the same server actions the page's own buttons call. Everything else is a jump. */
export type DirectAction = "mark_ready" | "open_claiming";

export interface WorkflowStep {
  id: StepId;
  label: string;
  state: StepState;
  /** Prerequisites are met, so the step can be opened / acted on. A step that is not available is shown as disabled. */
  available: boolean;
  target: StepTarget;
  /** A short line for the current / attention step only. */
  note?: string;
  /** The button label when this step is the current one ("Mark ready to invite", "Go to Email"…). */
  cta?: string;
  action?: DirectAction;
}

export interface Workflow {
  status: PipelineStatus;
  statusLabel: string;
  statusTone: "gray" | "amber" | "blue" | "green" | "red";
  steps: WorkflowStep[];
  /** The step Darren should act on now (an attention step wins), or null when archived / live / only waiting remains with nothing to do. */
  current: WorkflowStep | null;
  /** One line for the bar: "Next: Mark ready to invite" / "Waiting for the recipient" / "Live". */
  headline: string;
}

export interface WorkflowInput {
  row: PipelineRow;
  claimMode: "live" | "holding";
  /** The SAVED email draft (the same values the Email section's readiness check reads). */
  email: { subject: string | null; body: string | null; opening: string | null; contactEmail: string | null };
  /**
   * The business's most recent launch-grant RECORD (from the same grant table the Launch partner access screen manages), or null if it
   * never had one. It is what lets an expired or removed grant read as "needs attention" instead of "never granted". Nothing is stored here.
   */
  lastGrant?: { status: "active" | "expired" | "revoked" | "superseded" | "replaced_by_subscription"; expires_at: string } | null;
  /**
   * What the OWNER has really done with their launch setup, read from the campaign's own records (the append-only profile versions and
   * the approval columns): they edited their page; they approved it; a published version exists. Not a checkbox anyone ticks.
   */
  owner?: { edited: boolean; approved: boolean; published: boolean };
}

/** Steps that are a state, not a task: nothing to click while they are current. */
const WAITING = new Set<StepId>(["wait", "owner_review", "go_live", "live"]);
const section = (id: Extract<StepTarget, { kind: "section" }>["id"]): StepTarget => ({ kind: "section", id });
const CLAIMS_PENDING = "/admin/claims?status=pending";

export function deriveWorkflow({ row, claimMode, email, lastGrant = null, owner = { edited: false, approved: false, published: false } }: WorkflowInput): Workflow {
  const status = derivePipelineStatus(row);
  const archived = status === "archived";
  const sent = !!row.sent_at || row.stage === "sent";
  const ready = row.stage === "ready_to_invite" || sent;
  const prepared = row.has_preview && row.has_page_draft;
  const usable = inviteUsable(row);
  const inviteGone = (row.invite.status === "expired" || row.invite.status === "revoked") && !!row.invite.created_at;
  const emailCheck = checkEmail({ subject: email.subject, body: email.body, opening: email.opening, contactEmail: email.contactEmail });
  const claim = row.claim;
  const claimPending = claim?.status === "pending";
  const claimApproved = isClaimed(row);
  const claimOther = !!claim && !claimPending && claim.status !== "approved";
  const afterClaim = !!claim || claimApproved || !!row.live_at;     // a response has arrived (merely opening the preview is not one)
  // A grant that is giving access now (the row's own active grant), or one that has become a paid subscription, completes the step.
  const grantDone = !!row.grant || lastGrant?.status === "replaced_by_subscription";
  const grantEnded = !grantDone && claimApproved && (lastGrant?.status === "expired" || lastGrant?.status === "revoked");
  const gatesOpen = (row.is_test || ready) && !archived;      // the server's own rule for generating an invitation

  const S = (s: Omit<WorkflowStep, "available"> & { available?: boolean }): WorkflowStep => ({ available: true, ...s });
  const done = (v: boolean): StepState => (v ? "complete" : "future");

  const steps: WorkflowStep[] = [
    S({ id: "prepare", label: "Prepare preview", state: prepared ? "complete" : "future", target: section(!row.has_preview ? "preview" : "page"), cta: "Go to Preview" }),
    S({ id: "review_preview", label: "Review preview", state: ready ? "complete" : "future", available: row.has_preview, target: section("preview") }),
    S({ id: "review_page", label: "Review business page", state: ready ? "complete" : "future", available: row.has_page_draft, target: section("page") }),
    S({ id: "mark_ready", label: "Mark ready to invite", state: done(ready), available: prepared || ready, target: section("status"),
       action: row.stage === "preparing" && row.has_preview ? "mark_ready" : undefined, cta: row.stage === "preparing" && row.has_preview ? "Mark ready to invite" : "Go to Status" }),
    S({ id: "generate_invite", label: "Generate invitation", state: usable || (sent && !inviteGone) ? "complete" : "future", available: gatesOpen, target: section("invitation"), cta: "Go to Invitation" }),
    S({ id: "open_claiming", label: "Open claiming", state: done(claimMode === "live" || afterClaim), available: usable, target: section("invitation"),
       action: usable && claimMode === "holding" ? "open_claiming" : undefined, cta: usable && claimMode === "holding" ? "Open claiming" : "Go to Invitation" }),
    S({ id: "review_email", label: "Review email", state: done(emailCheck.ok || sent), available: prepared, target: section("email"), cta: "Go to Email" }),
    S({ id: "send", label: "Send invitation", state: done(sent), available: usable && emailCheck.ok && !sent, target: section("email"), cta: "Go to Email" }),
    S({ id: "wait", label: "Wait for response", state: done(afterClaim), available: sent, target: section("status") }),
    S({ id: "approve_claim", label: "Approve claim", state: done(claimApproved), available: !!claim, target: { kind: "href", href: CLAIMS_PENDING }, cta: "Review claim" }),
    S({ id: "grant", label: "Grant Launch Partner", state: done(grantDone), available: claimApproved, target: section("grant"), cta: "Grant access" }),
    S({ id: "owner_review", label: "Owner review", state: done(owner.approved || owner.published || !!row.live_at), available: claimApproved && grantDone, target: section("status") }),
    S({ id: "go_live", label: "Ready to go live", state: done(!!row.setup_ready_at || !!row.live_at), available: claimApproved && grantDone && owner.approved, target: section("status") }),
    S({ id: "live", label: "Live", state: done(!!row.live_at), available: !!row.setup_ready_at || !!row.live_at, target: section("status") }),
  ];
  const by = (id: StepId) => steps.find((s) => s.id === id)!;
  const mark = (id: StepId, state: StepState, note?: string) => { const s = by(id); s.state = state; if (note) s.note = note; };

  if (archived) return { status, statusLabel: STATUS_LABEL[status], statusTone: STATUS_TONE[status], steps, current: null, headline: "Archived — nothing to do" };

  // ── attention: something that was fine, or is needed, is not (these outrank the ordinary next step) ──
  if (inviteGone) mark("generate_invite", "attention", `The invitation ${row.invite.status === "expired" ? "has expired" : "was revoked"} — generate a fresh one.`);
  if (sent && usable && claimMode === "holding" && !afterClaim) mark("open_claiming", "attention", "Claiming is closed, so the recipient cannot claim yet.");
  if (claimOther) mark("approve_claim", "attention", `The claim is ${claim!.status}.`);
  if (grantEnded) mark("grant", "attention", `Their launch-partner access has ${lastGrant!.status === "expired" ? "expired" : "been removed"} — grant it again if they should still have it.`);

  // ── current: attention first; otherwise the first thing still to do, in Darren's order ──
  let current: WorkflowStep | null = (["approve_claim", "grant", "generate_invite", "open_claiming"] as const).map(by).find((x) => x.state === "attention") ?? null;
  if (!current) {
    const gating: StepId[] = ["prepare", "mark_ready", "generate_invite", "open_claiming", "review_email", "send", "wait", "approve_claim", "grant", "owner_review", "go_live", "live"];
    for (const id of gating) {
      const x = by(id);
      if (x.state === "complete") continue;
      if (id === "mark_ready" && row.is_test) continue;              // a test fixture does not need the stage to generate an invitation
      if (id === "approve_claim" && !claim) continue;                 // nothing to decide until a claim exists
      if (id === "grant" && !claimApproved) continue;
      if (id === "owner_review" && !(claimApproved && grantDone)) continue;
      if (id === "go_live" && !(claimApproved && grantDone && owner.approved)) continue;
      if (id === "live" && !row.setup_ready_at) continue;
      current = x; break;
    }
  }
  if (current && current.state !== "attention") current.state = "current";

  // ── notes and calls to action for the one step that matters ──
  if (current) {
    switch (current.id) {
      case "prepare": current.note = !row.has_preview ? "Build the launch preview first." : "Add the business page draft."; break;
      case "mark_ready": current.note = "Preview and page are prepared. Review them, then mark ready."; break;
      case "generate_invite": if (current.state !== "attention") current.note = "Creates the private link. Sends nothing."; break;
      case "open_claiming": if (current.state !== "attention") current.note = "Lets the recipient claim from the preview."; break;
      case "review_email": current.note = emailCheck.problems[0] ?? "Check the saved email."; break;
      case "send": current.note = "Needs the link from when it was generated — generate again if the page was reloaded."; break;
      case "wait": current.note = row.first_viewed_at ? `Preview opened ${row.view_count} time${row.view_count === 1 ? "" : "s"}. Waiting for a claim.` : "Sent. Waiting for the recipient."; break;
      case "approve_claim": current.note = "A claim is waiting for your decision."; break;
      case "grant": if (current.state !== "attention") current.note = "Claim approved. Choose Pro or Premium and an end date — right on this page."; break;
      case "owner_review": current.note = owner.edited ? "The owner has started editing their page and hasn't approved it yet." : "Waiting for the owner to review the setup you prepared."; break;
      case "go_live": current.note = "The owner has approved their setup. Nothing is public until they choose to go live."; break;
      case "live": current.note = "Ready. Waiting for them to press Go live."; break;
    }
  }

  // The "wait" step has nothing to click: it is a state, not a task.
  const headline = current === null ? (row.live_at ? "Live" : "Nothing to do")
    : WAITING.has(current.id) && current.state !== "attention" ? (current.id === "wait" ? (row.first_viewed_at ? "Opened — waiting for a claim" : "Waiting for the recipient") : current.id === "owner_review" ? (owner.edited ? "Owner is editing — waiting for approval" : "Waiting for owner review") : current.id === "go_live" ? "Owner approved — waiting for them to go live" : "Waiting for them to go live")
    : current.state === "attention" ? `Needs attention: ${current.label}`
    : `Next: ${current.label}`;
  return { status, statusLabel: STATUS_LABEL[status], statusTone: STATUS_TONE[status], steps, current, headline };
}

/** True when the current step has nothing to click (the rail shows a status line, not a button). */
export const isWaitingStep = (w: Workflow): boolean => !!w.current && WAITING.has(w.current.id) && w.current.state !== "attention";
