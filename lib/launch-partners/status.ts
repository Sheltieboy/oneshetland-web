/**
 * Launch partners — where each one stands, and what Darren should do next.
 *
 * STORED on a campaign: only the editorial stage (candidate / preparing / ready_to_invite / sent / archived) and a few
 * timestamps. EVERYTHING ELSE is derived here from facts that already live elsewhere (invitations, claims, plan
 * grants, products) — so the pipeline can never disagree with the real state of the business.
 *
 * Pure: no database, no framework.
 */

export type Stage = "candidate" | "preparing" | "ready_to_invite" | "sent" | "archived";

export type PipelineStatus =
  | "candidate" | "preparing" | "ready_to_invite" | "sent" | "viewed" | "claim_submitted" | "claimed" | "setting_up" | "ready_to_go_live" | "live" | "archived";

/** The facts the status is derived from — the shape of one row from admin_launch_partner_list. */
export interface PipelineRow {
  id: string;
  business_id: string;
  slug: string;
  stage: Stage;
  is_test: boolean;
  positioning: string | null;
  name: string;
  category: string | null;
  locality: string | null;
  is_active: boolean;
  is_claimed: boolean;
  has_owner: boolean;
  tier: string | null;
  plan_live: boolean;
  grant: { tier: string; expires_at: string } | null;
  invite: { status: "none" | "open" | "expired" | "revoked" | "claim pending" | "claimed"; created_at: string | null; expires_at: string | null };
  claim: { status: string; created_at: string } | null;
  product_count: number;
  active_product_count: number;
  import_batch_count: number;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  setup_ready_at: string | null;
  live_at: string | null;
  has_preview: boolean;
  has_page_draft: boolean;
  has_email_draft: boolean;
  has_contact_email: boolean;
  last_activity: string | null;
}

export const STATUS_ORDER: PipelineStatus[] = [
  "candidate", "preparing", "ready_to_invite", "sent", "viewed", "claim_submitted", "claimed", "setting_up", "ready_to_go_live", "live",
];

export const STATUS_LABEL: Record<PipelineStatus, string> = {
  candidate: "Candidate", preparing: "Preparing", ready_to_invite: "Ready to invite", sent: "Sent", viewed: "Viewed",
  claim_submitted: "Claim submitted", claimed: "Claimed", setting_up: "Setting up", ready_to_go_live: "Ready to go live", live: "Live", archived: "Archived",
};

/** A short phrase for the pipeline tabs. */
export const TAB_LABEL: Record<PipelineStatus, string> = { ...STATUS_LABEL, candidate: "Candidates" };

/** Colour family for a status pill (mapped to the admin pill tones in the UI). */
export const STATUS_TONE: Record<PipelineStatus, "gray" | "amber" | "blue" | "green" | "red"> = {
  candidate: "gray", preparing: "amber", ready_to_invite: "blue", sent: "blue", viewed: "blue", claim_submitted: "amber",
  claimed: "green", setting_up: "green", ready_to_go_live: "green", live: "green", archived: "gray",
};

export const inviteUsable = (r: PipelineRow) => r.invite.status === "open" || r.invite.status === "claim pending" || r.invite.status === "claimed";

/** Has an invited claim been approved (so the person now owns the business)? */
export const isClaimed = (r: PipelineRow): boolean => r.claim?.status === "approved" && r.has_owner;

export function derivePipelineStatus(r: PipelineRow): PipelineStatus {
  if (r.stage === "archived") return "archived";
  if (r.live_at) return "live";
  if (r.setup_ready_at && isClaimed(r)) return "ready_to_go_live";
  if (isClaimed(r)) {
    const started = !!r.grant || r.product_count > 0 || r.import_batch_count > 0;
    return started ? "setting_up" : "claimed";
  }
  if (r.claim?.status === "pending") return "claim_submitted";
  if (r.first_viewed_at && r.invite.status !== "revoked") return "viewed";
  if (r.stage === "sent" || r.sent_at) return "sent";
  if (r.stage === "ready_to_invite") return "ready_to_invite";
  if (r.stage === "preparing") return "preparing";
  return "candidate";
}

/** One plain sentence: the single most useful thing to do next. */
export function nextAction(r: PipelineRow, status: PipelineStatus = derivePipelineStatus(r)): string {
  switch (status) {
    case "candidate": return "Prepare the launch preview";
    case "preparing":
      if (!r.has_preview) return "Prepare the launch preview";
      if (!r.has_page_draft) return "Prepare the business page";
      return "Review the preview and business page, then mark it ready";
    case "ready_to_invite":
      if (!inviteUsable(r)) return "Generate the private invitation";
      if (!r.has_contact_email || !r.has_email_draft) return "Add a contact and write the email";
      return "Send the invitation yourself, then record it";
    case "sent": return r.invite.status === "expired" || r.invite.status === "revoked" ? "Generate a fresh invitation" : "Wait for them to open it";
    case "viewed": return "Wait for a claim — or follow up personally";
    case "claim_submitted": return "Review and decide on the claim";
    case "claimed": return r.grant ? "Wait for them to start adding products" : "Grant launch-partner Premium";
    case "setting_up": return r.grant ? "Let them add their catalogue and review the page" : "Grant launch-partner Premium";
    case "ready_to_go_live": return "Waiting for them to press Go live";
    case "live": return "Nothing — they're live";
    case "archived": return "Archived";
  }
}

/**
 * Where the "Next:" sentence should take Darren — a destination that already exists. Section links point into the
 * partner's editor; a claim goes to the existing Business claims screen, and a Premium grant to its existing
 * launch-partner access tab for that business.
 */
export function nextActionHref(r: PipelineRow, status: PipelineStatus = derivePipelineStatus(r)): string {
  const edit = `/admin/launch-partners/${r.id}`;
  switch (status) {
    case "candidate": return `${edit}#preview`;
    case "preparing": return `${edit}${!r.has_preview ? "#preview" : !r.has_page_draft ? "#page" : "#status"}`;
    case "ready_to_invite": return `${edit}${!inviteUsable(r) ? "#invitation" : !r.has_contact_email || !r.has_email_draft ? "#email" : "#status"}`;
    case "sent": return `${edit}${r.invite.status === "expired" || r.invite.status === "revoked" ? "#invitation" : "#status"}`;
    case "claim_submitted": return "/admin/claims?status=pending";
    case "claimed": return r.grant ? `${edit}#status` : `/admin/claims?status=launch&business=${r.business_id}`;
    case "setting_up": return r.grant ? `${edit}#status` : `/admin/claims?status=launch&business=${r.business_id}`;
    default: return `${edit}#status`;
  }
}

export interface PipelineCell { label: string; ok: boolean }

/** The at-a-glance columns: Preview / Invitation / Viewed / Claim / Plan / Products. */
export function pipelineCells(r: PipelineRow) {
  const inv = r.invite.status;
  return {
    preview: { label: r.has_preview ? "✓" : "—", ok: r.has_preview } satisfies PipelineCell,
    page: { label: r.has_page_draft ? "✓" : "—", ok: r.has_page_draft } satisfies PipelineCell,
    invitation: { label: inv === "none" ? "—" : inv === "claim pending" ? "used" : inv, ok: inviteUsable(r) } satisfies PipelineCell,
    viewed: { label: r.first_viewed_at ? (r.view_count > 1 ? `✓ ×${r.view_count}` : "✓") : "—", ok: !!r.first_viewed_at } satisfies PipelineCell,
    claim: { label: r.claim ? (r.claim.status === "approved" ? "approved" : r.claim.status) : "—", ok: r.claim?.status === "approved" } satisfies PipelineCell,
    plan: { label: r.grant ? `${r.grant.tier} (launch)` : r.plan_live ? (r.tier ?? "paid") : "—", ok: !!r.grant || r.plan_live } satisfies PipelineCell,
    email: { label: r.has_contact_email && r.has_email_draft ? "ready" : r.has_contact_email ? "contact" : r.has_email_draft ? "draft" : "—", ok: r.has_contact_email && r.has_email_draft } satisfies PipelineCell,
    products: { label: r.import_batch_count > 0 || r.product_count > 0 ? `${r.product_count} (${r.active_product_count} live)` : "—", ok: r.product_count > 0 } satisfies PipelineCell,
  };
}

/** Test fixtures are kept out of the normal pipeline and its counts; they have their own filter. */
export const isTestRow = (r: PipelineRow): boolean => r.is_test;
export const realRows = (rows: PipelineRow[]): PipelineRow[] => rows.filter((r) => !r.is_test);

export function countByStatus(rows: PipelineRow[]): Record<PipelineStatus, number> {
  const out = Object.fromEntries([...STATUS_ORDER, "archived"].map((s) => [s, 0])) as Record<PipelineStatus, number>;
  for (const r of rows) out[derivePipelineStatus(r)]++;
  return out;
}
