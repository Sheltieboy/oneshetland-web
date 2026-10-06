"use server";

import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import {
  candidateFor, createCampaignWithDraft, directoryRecords, getCampaign, importExistingPreviews, listInvites, markSent, searchCandidates, setStage, updateCampaign,
  type CampaignDetail, type CandidateRow, type ImportOutcome,
} from "@/lib/launch-partners/campaigns.server";
import { buildPageSkeleton, buildPreviewSkeleton, slugFromName, type DirectoryRecord } from "@/lib/launch-partners/draft";
import { parsePageDraft, parsePreviewConfig } from "@/lib/launch-partners/validate";
import { prepareEligibility } from "@/lib/launch-partners/eligibility";
import { enrichCampaign, type EnrichResult } from "@/lib/launch-partners/enrich.server";
import { normaliseSourceUrl } from "@/lib/launch-partners/source-url";
import { checkEmail, defaultEmailDraft } from "@/lib/launch-partners/email";
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

/**
 * "Prepare preview": a PRIVATE campaign for an existing Directory business, whatever its listing state (unclaimed, Free, not
 * publicly listed, sparse — those are the businesses a preview is most useful for). The skeleton comes from what the
 * Directory already holds. When that is thin, the screen then asks enrichCampaignAction to build the rest from the
 * business's own website; this action itself makes no outside request and calls no model. It reads the Directory and
 * writes only the campaign.
 */
export async function prepareCampaignAction(input: { businessId: string; positioning?: string; sourceUrl?: string }): Promise<Result<{ id: string; enrich: boolean; host: string | null }>> {
  await requireAdmin();
  try {
    const cand = await candidateFor(input.businessId);
    if (!cand) return { ok: false, error: "That business was not found." };
    prepareEligibility(cand); // always ok — the listing state never blocks a private draft (kept as the single place that says so)
    // Read with the administrator's own session through a read-only admin function: it works whether or not the listing is public.
    const rec = (await directoryRecords([input.businessId]))[0] as DirectoryRecord | undefined;
    if (!rec) return { ok: false, error: "That business's Directory record could not be read just now. Please try again." };

    const supplied = input.sourceUrl?.trim() ? normaliseSourceUrl(input.sourceUrl) : null;
    if (supplied && !supplied.ok) return { ok: false, error: supplied.error };
    if (cand.route === "needs_source" && !supplied) return { ok: false, error: "We don't have enough public information to build this automatically. Add the business's website and try again." };
    const useSource = cand.route !== "existing_content" ? (supplied?.ok ? supplied : normaliseSourceUrl(rec.website)) : null;

    const slug = slugFromName(rec.name);
    // The website a draft is built from is recorded on the PRIVATE preview only; the Directory record is never written.
    const forSkeleton: DirectoryRecord = { ...rec, website: rec.website || (useSource?.ok ? useSource.url : null) };
    const preview = parsePreviewConfig(buildPreviewSkeleton(forSkeleton, slug), slug);
    const page = parsePageDraft(buildPageSkeleton(rec));
    if (!preview.ok) return { ok: false, error: preview.error };
    if (!page.ok) return { ok: false, error: page.error };
    const id = await createCampaignWithDraft({ businessName: rec.name, opening: null, businessId: rec.id, slug, positioning: input.positioning?.trim() || null, preview: preview.value, page: page.value, isTest: /^zz\b/i.test(rec.name.trim()) });
    return { ok: true, id, enrich: !!useSource?.ok, host: useSource?.ok ? useSource.host : null };
  } catch (e) { return fail(e); }
}

/**
 * Peerie Bot builds (or rebuilds) the campaign's PRIVATE draft from the business's own website. Administrators only.
 * It can change only this campaign's private preview and page drafts (and positioning if empty). A draft that has been
 * edited or already holds content is replaced only when `overwrite` is true — the server demands it, whatever the screen did.
 */
export async function enrichCampaignAction(id: string, opts: { sourceUrl?: string; overwrite?: boolean } = {}): Promise<Result<{ result: Extract<EnrichResult, { ok: true }> }> & { code?: string }> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Not found." };
  try {
    const r = await enrichCampaign(id, { sourceUrl: opts.sourceUrl, overwrite: opts.overwrite === true });
    return r.ok ? { ok: true, result: r } : { ok: false, error: r.error, code: r.code };
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

export async function saveEmailAction(id: string, f: { contactName: string; contactEmail: string; subject: string; opening: string; body: string; notes?: string }): Promise<Result<{ problems: string[] }>> {
  await requireAdmin();
  // Drafts may be saved half-written; only a real invitation link is refused outright.
  const secret = /[?&]invite=[A-Za-z0-9_-]{20,}/;
  if (secret.test(f.body) || secret.test(f.opening) || /\b[0-9a-f]{64}\b/.test(`${f.body} ${f.opening}`)) return { ok: false, error: "That draft contains what looks like a real invitation link. Leave the call-to-action token; the link is inserted when you generate the invitation." };
  const check = checkEmail({ subject: f.subject, body: f.body, opening: f.opening, contactEmail: f.contactEmail });
  try {
    await updateCampaign(id, {
      contact_name: f.contactName.trim() || null, contact_email: f.contactEmail.trim() || null,
      email_subject: f.subject.trim() || null, email_opening: f.opening.trim() || null, email_body: f.body.trim() || null, ...(f.notes !== undefined ? { notes: f.notes.trim() || null } : {}),
    });
    return { ok: true, problems: check.problems };
  } catch (e) { return fail(e); }
}

/**
 * Replace the saved draft (subject, personalised opening, body) with the standard template for this business. This is
 * the ONLY way, after creation, that the draft is regenerated — it is never done automatically — and the editor asks
 * for confirmation first. The opening comes from the campaign's researched config where one exists, otherwise a prompt.
 */
export async function resetEmailToDefaultAction(id: string): Promise<Result<{ subject: string; opening: string; body: string }>> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    if (c.sent_at) return { ok: false, error: "This email has been recorded as sent; its draft is no longer changed." };
    const researched = (c.preview_config as { outreachOpening?: unknown })?.outreachOpening;
    const d = defaultEmailDraft({ businessName: c.name, opening: typeof researched === "string" ? researched : null });
    await updateCampaign(id, { email_subject: d.subject, email_opening: d.opening, email_body: d.body });
    return { ok: true, ...d };
  } catch (e) { return fail(e); }
}

/**
 * SEND the invitation email — by asking the Supabase Edge Function `send-launch-invitation` to do it.
 *
 * The web app has NO mail transport and NO provider key: the function (in Supabase, with the key as a Supabase secret) is
 * the only code that can reach the mail provider. It runs as the calling administrator, re-reads the saved draft,
 * recipient and invitation from the database, re-checks every gate, reserves the send in the database so it cannot happen
 * twice, sends, and records it as sent — and only then reports success. This action just carries three things to it:
 * the campaign id, the private link's token (shown once, never stored), and what the administrator confirmed
 * (recipient and subject). Nothing else — there is no field for a recipient, subject or body to send.
 */
export async function sendInvitationEmailAction(id: string, invitePath: string, confirmation: { confirm: boolean; recipient: string; subject: string }): Promise<Result<{ messageId: string; recipient: string; recorded: boolean }>> {
  await requireAdmin();
  try {
    const m = /^\/launch\/([a-z0-9-]+)\?invite=([A-Za-z0-9_-]{40,128})$/.exec(invitePath);
    if (!m || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "The private link is only available right after you generate the invitation. Generate a new invitation to send it." };
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { ok: false, error: "Please sign in again." };
    const { data, error } = await sb.functions.invoke("send-launch-invitation", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { campaign_id: id, invite_token: m[2], confirm: { confirm: confirmation.confirm === true, recipient: confirmation.recipient, subject: confirmation.subject } },
    });
    // A non-2xx answer (not signed in, not an admin, rate-limited, unexpected) says nothing about the email — and the
    // function only reports success after the send is recorded — so it can never be mistaken for "sent".
    if (error) return { ok: false, error: "The email could not be sent just now, and nothing was recorded as sent. Please try again in a moment." };
    const r = data as { ok?: boolean; messageId?: string; recipient?: string; recorded?: boolean; message?: string } | null;
    if (r?.ok === true && r.messageId && r.recipient) return { ok: true, messageId: r.messageId, recipient: r.recipient, recorded: r.recorded !== false };
    return { ok: false, error: r?.message || "The email could not be sent, and nothing was recorded as sent." };
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
export async function issueInvitationAction(id: string, days: number, opts: { replaceSent?: boolean } = {}): Promise<Result<{ path: string; expiresAt: string }>> {
  await requireAdmin();
  try {
    const c = await getCampaign(id);
    if (!c) return { ok: false, error: "Not found." };
    // A new invitation revokes the previous one. If that one has already been EMAILED, replacing it breaks the link the
    // recipient holds — so that must be an explicit, separate decision, never a side effect of pressing Generate.
    if (c.sent_at && !opts.replaceSent) return { ok: false, error: "This invitation has already been emailed. Replacing it makes the link they received stop working — confirm that you really want to replace it." };
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
