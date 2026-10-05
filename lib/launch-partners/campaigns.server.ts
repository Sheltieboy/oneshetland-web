/**
 * Launch-partner campaigns — SERVER-ONLY reads and writes.
 *
 * Every call goes through a database function that checks the caller is an administrator (or, for the one draft
 * reader, the approved owner). This file adds no authority of its own: it does not use the service role, it
 * cannot read the tables directly (they grant nothing to any client role), and it contains no way to send email.
 */
import { createClient } from "@/lib/supabase/server";
import type { PipelineRow } from "./status";
import type { PreviewConfig } from "../launch-preview/types";
import type { PageDraft } from "../business-page/types";
import { launchPreviewOptions } from "../launch-preview/registry";
import { getPreviewConfig } from "../launch-preview/registry";
import { buildPageDraft, POSITIONING_BY_SLUG } from "./draft";
import { parsePageDraft, parsePreviewConfig } from "./validate";

export interface CandidateRow {
  business_id: string; name: string; category: string | null; address?: string | null; locality: string | null;
  is_active: boolean; is_claimed: boolean; has_owner?: boolean; owner_name: string | null; tier: string | null; plan_live: boolean;
  product_count: number; service_count: number; offer_count: number; pass_count: number;
  has_campaign: boolean; campaign_id: string | null; campaign_slug: string | null; campaign_stage: string | null;
}

export interface CampaignEvent { id: string; kind: string; detail: Record<string, unknown>; actor_label: string | null; created_at: string }

export interface CampaignDetail extends PipelineRow {
  preview_config: PreviewConfig | Record<string, never>;
  page_config: PageDraft | Record<string, never>;
  contact_name: string | null;
  contact_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  notes: string | null;
  events: CampaignEvent[];
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const sb = await createClient();
  const { data, error } = await sb.rpc(fn, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

/** The database nests the business facts; the pipeline logic reads them flat. One place converts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the database row is untyped JSON
export function normaliseRow<T extends object>(raw: Record<string, any>): PipelineRow & T {
  const b = raw.business ?? {};
  return {
    ...raw,
    name: b.name ?? raw.name, category: b.category ?? raw.category ?? null, locality: b.locality ?? raw.locality ?? null,
    is_active: !!(b.is_active ?? raw.is_active), is_claimed: !!(b.is_claimed ?? raw.is_claimed), has_owner: !!(b.has_owner ?? raw.has_owner),
    grant: raw.grant ?? null, claim: raw.claim ?? null,
    invite: raw.invitation ?? raw.invite ?? { status: "none", created_at: null, expires_at: null },
  } as PipelineRow & T;
}

export const listCampaigns = async (): Promise<PipelineRow[]> => ((await rpc<Record<string, unknown>[] | null>("admin_launch_partner_list")) ?? []).map((r) => normaliseRow(r));
export const getCampaign = async (id: string): Promise<CampaignDetail | null> => {
  const r = await rpc<Record<string, unknown> | null>("admin_launch_partner_get", { p_id: id });
  return r ? normaliseRow<CampaignDetail>(r) : null;
};
export const searchCandidates = async (q: string): Promise<CandidateRow[]> => (await rpc<CandidateRow[] | null>("admin_launch_partner_candidates", { p_query: q })) ?? [];

export const createCampaign = (a: { businessId: string; slug: string; positioning?: string | null; preview?: PreviewConfig | null; page?: PageDraft | null; isTest?: boolean }) =>
  rpc<string>("admin_launch_partner_create", {
    p_business_id: a.businessId, p_slug: a.slug, p_positioning: a.positioning ?? null,
    p_preview: a.preview ?? {}, p_page: a.page ?? {}, p_is_test: a.isTest ?? false,
  });

export const updateCampaign = (id: string, patch: Record<string, unknown>) => rpc<unknown>("admin_launch_partner_update", { p_id: id, p_patch: patch });
export const setStage = (id: string, stage: string, note?: string) => rpc<void>("admin_launch_partner_set_stage", { p_id: id, p_stage: stage, p_note: note ?? null });
export const markSent = (id: string, note?: string) => rpc<void>("admin_launch_partner_mark_sent", { p_id: id, p_note: note ?? null });

/** The private Business Page draft — admin, or the owner after an APPROVED launch-partner claim. Null for everyone else. */
export async function readPageDraft(businessId: string): Promise<{ campaignId: string; slug: string; stage: string; draft: PageDraft } | null> {
  const r = await rpc<{ campaign_id: string; slug: string; stage: string; page_config: unknown } | null>("launch_partner_page_draft", { p_business_id: businessId });
  if (!r) return null;
  const parsed = parsePageDraft(r.page_config);
  return parsed.ok ? { campaignId: r.campaign_id, slug: r.slug, stage: r.stage, draft: parsed.value } : null;
}

/** The Launch Preview stored for a campaign, if the invitation token is valid for it. Null → fall back to the code configs. */
export async function readStoredPreview(slug: string, token: string): Promise<PreviewConfig | null> {
  try {
    const raw = await rpc<unknown>("launch_invite_preview_config", { p_slug: slug, p_token: token });
    if (!raw) return null;
    const parsed = parsePreviewConfig(raw, slug);
    // A stored campaign is claim-CLOSED unless an admin deliberately opened it: an omitted setting never means "open".
    return parsed.ok ? { ...parsed.value, claim: parsed.value.claim === "live" ? "live" : "holding" } : null;
  } catch { return null; }
}

/** Record that a valid private preview was opened. Best effort: a failure must never break the page. */
export async function recordPreviewView(slug: string, token: string): Promise<void> {
  try { await rpc<boolean>("launch_invite_record_view", { p_slug: slug, p_token: token }); } catch { /* tracking is optional */ }
}

export interface ImportOutcome { created: { slug: string; name: string }[]; skipped: { slug: string; reason: string }[] }

/**
 * Bring the researched code configs in as campaign DRAFTS. Idempotent: a business that already has a record is
 * skipped, never overwritten. Creates records only — no invitation, no email, no change to any listing.
 */
export async function importExistingPreviews(): Promise<ImportOutcome> {
  const existing = await listCampaigns();
  const have = new Set(existing.map((c) => c.business_id));
  const out: ImportOutcome = { created: [], skipped: [] };
  for (const o of launchPreviewOptions()) {
    const cfg = getPreviewConfig(o.slug);
    if (!cfg?.directoryBusinessId) continue;
    if (cfg.slug === "zz-test-acceptance") { out.skipped.push({ slug: o.slug, reason: "test fixture" }); continue; }
    if (have.has(cfg.directoryBusinessId)) { out.skipped.push({ slug: o.slug, reason: "already exists" }); continue; }
    const preview = parsePreviewConfig(cfg, cfg.slug);
    const page = parsePageDraft(buildPageDraft(cfg));
    if (!preview.ok || !page.ok) { out.skipped.push({ slug: o.slug, reason: `invalid: ${preview.ok ? (page as { error: string }).error : preview.error}` }); continue; }
    // Imported campaigns always start with claiming closed, whatever the source config says.
    await createCampaign({ businessId: cfg.directoryBusinessId, slug: cfg.slug, positioning: POSITIONING_BY_SLUG[cfg.slug] ?? cfg.positioning ?? null, preview: { ...preview.value, claim: "holding" }, page: page.value });
    out.created.push({ slug: cfg.slug, name: cfg.businessName });
  }
  return out;
}

export interface InviteSummaryRow {
  slug: string; business_id: string; business_name: string; created_at: string; expires_at: string | null;
  revoked_at: string | null; revoked_reason: string | null; status: string; claimant_name: string | null; claimant_email: string | null; claim_status: string | null;
}
export const listInvites = async (): Promise<InviteSummaryRow[]> => (await rpc<InviteSummaryRow[] | null>("admin_list_launch_invites")) ?? [];
