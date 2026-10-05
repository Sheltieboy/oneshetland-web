"use server";

import { requireAdmin } from "@/lib/admin-data.server";
import { publicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  createCampaign, getCampaign, importExistingPreviews, listInvites, markSent, searchCandidates, setStage, updateCampaign,
  type CampaignDetail, type CandidateRow, type ImportOutcome,
} from "@/lib/launch-partners/campaigns.server";
import { buildPageSkeleton, buildPreviewSkeleton, slugFromName, type DirectoryRecord } from "@/lib/launch-partners/draft";
import { parsePageDraft, parsePreviewConfig } from "@/lib/launch-partners/validate";
import { checkEmail } from "@/lib/launch-partners/email";
import type { PreviewConfig } from "@/lib/launch-preview/types";

/**
 * Admin actions for launch partners. Every one begins with requireAdmin(), and every database function it calls
 * checks the caller is an administrator again. NOTHING here sends an email; issuing an invitation only creates the
 * private link, which is handed back to the administrator to send themselves.
 */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message.replace(/^.*?:\s*(?=This business|That preview|Only an)/, "") : "Something went wrong." });

export async function searchCandidatesAction(q: string): Promise<Result<{ rows: CandidateRow[] }>> {
  await requireAdmin();
  try { return { ok: true, rows: await searchCandidates(q) }; } catch (e) { return fail(e); }
}

/** "Prepare preview": a campaign for an existing Directory business, drafted from what the Directory already holds. */
export async function prepareCampaignAction(input: { businessId: string; positioning?: string }): Promise<Result<{ id: string }>> {
  await requireAdmin();
  try {
    const { data } = await publicClient().from("local_businesses_public")
      .select("id, name, category, description, address, locality, logo_url, cover_url, website, tags").eq("id", input.businessId).maybeSingle();
    if (!data) return { ok: false, error: "That business isn't in the public Directory, so there's nothing to draft from." };
    const rec = data as DirectoryRecord;
    const slug = slugFromName(rec.name);
    const preview = parsePreviewConfig(buildPreviewSkeleton(rec, slug), slug);
    const page = parsePageDraft(buildPageSkeleton(rec));
    if (!preview.ok) return { ok: false, error: preview.error };
    if (!page.ok) return { ok: false, error: page.error };
    const id = await createCampaign({ businessId: rec.id, slug, positioning: input.positioning?.trim() || null, preview: preview.value, page: page.value, isTest: /^zz\b/i.test(rec.name.trim()) });
    return { ok: true, id };
  } catch (e) { return fail(e); }
}

/** Bring the six researched previews in as drafts. Idempotent; creates nothing public and issues nothing. */
export async function importExistingAction(): Promise<Result<{ outcome: ImportOutcome }>> {
  await requireAdmin();
  try { return { ok: true, outcome: await importExistingPreviews() }; } catch (e) { return fail(e); }
}

export async function savePositioningAction(id: string, positioning: string): Promise<Result> {
  await requireAdmin();
  try { await updateCampaign(id, { positioning: positioning.trim() || null }); return { ok: true }; } catch (e) { return fail(e); }
}

/** Save the Launch Preview. The business and the name are fixed by the campaign; claiming mode is not editable here. */
export async function savePreviewAction(id: string, config: PreviewConfig): Promise<Result> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    const current = (c.preview_config ?? {}) as Partial<PreviewConfig>;
    const parsed = parsePreviewConfig({ ...config, slug: c.slug, directoryBusinessId: c.business_id, claim: current.claim ?? "holding" }, c.slug);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    await updateCampaign(id, { preview_config: parsed.value });
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function savePageDraftAction(id: string, draft: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = parsePageDraft(draft);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try { await updateCampaign(id, { page_config: parsed.value }); return { ok: true }; } catch (e) { return fail(e); }
}

export async function saveEmailAction(id: string, f: { contactName: string; contactEmail: string; subject: string; body: string; notes?: string }): Promise<Result<{ problems: string[] }>> {
  await requireAdmin();
  // Drafts may be saved half-written; only a real invitation link is refused outright.
  if (/[?&]invite=[A-Za-z0-9_-]{20,}/.test(f.body) || /\b[0-9a-f]{64}\b/.test(f.body)) return { ok: false, error: "That draft contains what looks like a real invitation link. Use the placeholder; paste the real link only when you send." };
  const check = checkEmail({ subject: f.subject, body: f.body, contactEmail: f.contactEmail });
  try {
    await updateCampaign(id, {
      contact_name: f.contactName.trim() || null, contact_email: f.contactEmail.trim() || null,
      email_subject: f.subject.trim() || null, email_body: f.body.trim() || null, ...(f.notes !== undefined ? { notes: f.notes.trim() || null } : {}),
    });
    return { ok: true, problems: check.problems };
  } catch (e) { return fail(e); }
}

export async function setStageAction(id: string, stage: "candidate" | "preparing" | "ready_to_invite" | "archived", note?: string): Promise<Result> {
  await requireAdmin();
  try { await setStage(id, stage, note); return { ok: true }; } catch (e) { return fail(e); }
}

/** Record that YOU sent the invitation yourself. The app sends nothing. */
export async function markSentAction(id: string, note?: string): Promise<Result> {
  await requireAdmin();
  try { await markSent(id, note); return { ok: true }; } catch (e) { return fail(e); }
}

/**
 * Create the private invitation link. It is returned to the administrator ONCE (the database keeps only a hash) and
 * is never stored, logged or emailed. Real campaigns must be "ready to invite" first; a test fixture may be issued any time.
 */
export async function issueInvitationAction(id: string, days: number): Promise<Result<{ path: string; expiresAt: string }>> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    if (!c.is_test && c.stage !== "ready_to_invite" && c.stage !== "sent") return { ok: false, error: "Mark the campaign Ready to invite before generating its private invitation." };
    const d = Math.min(120, Math.max(1, Math.floor(days || 30)));
    const sb = await createClient();
    const { data, error } = await sb.rpc("admin_issue_launch_invite", { p_slug: c.slug, p_business_id: c.business_id, p_expires_at: new Date(Date.now() + d * 86_400_000).toISOString() });
    if (error) return { ok: false, error: error.message };
    const r = data as { token: string; expires_at: string };
    // A path, not a full address: the browser adds its own origin when it shows the link to the administrator.
    return { ok: true, path: `/launch/${c.slug}?invite=${r.token}`, expiresAt: r.expires_at };
  } catch (e) { return fail(e); }
}

export async function revokeInvitationAction(id: string): Promise<Result> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    const sb = await createClient();
    const { error } = await sb.rpc("admin_revoke_launch_invite", { p_slug: c.slug, p_reason: "revoked from the launch-partner screen" });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return fail(e); }
}

/** Open or close the claim button on the private preview. It can only be opened while a live invitation exists. */
export async function setClaimModeAction(id: string, mode: "live" | "holding"): Promise<Result> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    if (mode === "live") {
      const invs = await listInvites();
      if (!invs.some((i) => i.slug === c.slug && !i.revoked_at && i.status !== "expired")) return { ok: false, error: "Generate a private invitation first — claiming opens only for someone holding one." };
    }
    const parsed = parsePreviewConfig({ ...(c.preview_config as object), claim: mode }, c.slug);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    await updateCampaign(id, { preview_config: parsed.value });
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function loadCampaignAction(id: string): Promise<Result<{ campaign: CampaignDetail }>> {
  await requireAdmin();
  try { const c = await getCampaign(id); return c ? { ok: true, campaign: c } : { ok: false, error: "Not found." }; } catch (e) { return fail(e); }
}
