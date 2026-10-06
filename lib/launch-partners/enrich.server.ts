/**
 * enrich.server.ts — build (or rebuild) a campaign's PRIVATE draft from the business's own website, with Peerie Bot.
 *
 * What this can change: the campaign's preview_config, page_config and (only if empty) positioning — through the SAME
 * admin function an administrator's own edits use — and one append-only provenance row. It has no code path to the Directory:
 * no local_businesses write, no product/service/offer/pass write, no claim, invitation, grant, plan, image upload or
 * publication. (A test scans this file for any of them.)
 *
 * Safeguards, in order: the caller is an administrator (the action checks, and every database function checks again);
 * an invitation that has been EMAILED freezes the draft; a draft that has been edited is replaced only with an explicit
 * confirmation that the server demands; the website is read with the SSRF-safe, robots-respecting fetcher; the model is
 * called only after enough readable text exists and an AI-quota slot is claimed (fail closed); the model's answer is
 * evidence-checked before it is used; any failure is recorded and changes nothing.
 */
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimAiQuota } from "@/lib/ai-guard.server";
import { fetchImage } from "@/lib/product-import/image-fetch";
import { directoryRecords, enrichmentRuns, getCampaign, recordEnrichmentRun, updateCampaign } from "./campaigns.server";
import { canonical, applyProposal, hasDraftContent, PROPOSAL_SCHEMA, type VerifiedProposal } from "./enrich-core";
import { runEnrichment, QuotaError, type RunDeps, type FailCode } from "./enrich-run";
import { fetchRobots, fetchSourceText } from "./source-fetch";
import { fixtureDeps } from "./enrich-fixture";
import { normaliseSourceUrl } from "./source-url";
import { parsePageDraft, parsePreviewConfig } from "./validate";

/** One place to change the model. Fast on purpose: the call runs inside a web request. */
export const ENRICH_MODEL = process.env.LAUNCH_ENRICH_MODEL?.trim() || "claude-haiku-4-5-20251001";
const fixtureEnabled = (): boolean => process.env.LAUNCH_ENRICH_FIXTURE === "1" && process.env.NODE_ENV !== "production";

export type EnrichResult =
  | { ok: true; runNo: number; host: string; counts: { products: number; groups: number; pictures: number; dropped: number; pages: number }; flags: string[]; warning?: string }
  | { ok: false; code: FailCode | "needs_source" | "would_overwrite" | "sent" | "archived" | "not_found" | "not_configured" | "invalid_draft" | "unexpected"; error: string };

export const OVERWRITE_MESSAGE = "This draft has been edited, or already holds content. Rebuilding it from the website replaces the wording, pictures, example items and sources Peerie Bot owns. Confirm that you want to replace them.";

const sha = (v: unknown) => createHash("sha256").update(canonical(v)).digest("hex");
const hashDraft = (preview: unknown, page: unknown) => sha({ preview, page });

function realDeps(supabase: SupabaseClient, apiKey: string): RunDeps {
  return {
    robots: (origin) => fetchRobots(origin),
    fetchPage: async (url) => { const r = await fetchSourceText(url); return { finalUrl: r.finalUrl, text: r.text }; },
    verifyImage: async (url) => { const im = await fetchImage(url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 6_000 }); return { mime: im.mime, bytes: im.bytes.byteLength, sha256: im.sha256 }; },
    claimQuota: async () => {
      const refused = await claimAiQuota(supabase, "enrich-launch-partner");
      if (refused) throw new QuotaError(((await refused.json().catch(() => null)) as { error?: string } | null)?.error ?? "Peerie Bot is unavailable right now — try again shortly.");
    },
    propose: async (system, user) => {
      const anthropic = new Anthropic({ apiKey, timeout: 28_000, maxRetries: 0 });
      const msg = await anthropic.messages.create({
        model: ENRICH_MODEL, max_tokens: 3000, system,
        tools: [{ name: "propose_launch_draft", description: "Return the evidence-backed draft for the launch page.", input_schema: PROPOSAL_SCHEMA as never }],
        tool_choice: { type: "tool", name: "propose_launch_draft" },
        messages: [{ role: "user", content: user }],
      });
      const tool = msg.content.find((c) => c.type === "tool_use");
      if (!tool || tool.type !== "tool_use") throw new Error("no tool output");
      return tool.input;
    },
  };
}

/** What is stored as the run's `proposal`: the verified draft in plain data (no byte buffers, no tokens). */
function proposalRecord(v: VerifiedProposal) {
  return {
    description: v.description ?? null, tagline: v.tagline ?? null, category_label: v.categoryLabel ?? null, category: v.category ?? null, tags: v.tags, positioning: v.positioning ?? null, emphasis: v.emphasis ?? null,
    story: v.story ?? null, groups: v.groups, products: v.products.map((p) => ({ title: p.title, price: p.price, blurb: p.blurb, image: p.image.url, page: p.pageUrl })),
    hero: v.hero?.url ?? null, gallery: v.gallery.map((g) => g.url), check: v.check,
  };
}

export async function enrichCampaign(id: string, opts: { sourceUrl?: string | null; overwrite?: boolean } = {}): Promise<EnrichResult> {
  const sb = await createClient();
  const c = await getCampaign(id);
  if (!c) return { ok: false, code: "not_found", error: "Not found." };
  if (c.sent_at) return { ok: false, code: "sent", error: "This invitation has been emailed, so its draft is no longer rebuilt automatically — the recipient may be looking at it." };
  if (c.stage === "archived") return { ok: false, code: "archived", error: "This launch partner is archived." };

  const rec = (await directoryRecords([c.business_id]))[0];
  if (!rec) return { ok: false, code: "not_found", error: "That business's Directory record could not be read just now. Please try again." };
  const runs = await enrichmentRuns(id);
  const lastApplied = runs.find((r) => r.status === "applied") ?? null;

  const src = normaliseSourceUrl(opts.sourceUrl?.trim() || lastApplied?.source_url || rec.website);
  if (!src.ok) return { ok: false, code: "needs_source", error: opts.sourceUrl?.trim() ? src.error : "We don't have enough public information to build this automatically. Add the business's website and try again." };

  const pv = parsePreviewConfig(c.preview_config, c.slug); const pg = parsePageDraft(c.page_config);
  if (!pv.ok || !pg.ok) return { ok: false, code: "invalid_draft", error: `The stored draft is not valid, so it was not rebuilt (${pv.ok ? (pg as { error: string }).error : pv.error}).` };

  // A draft a person has touched — or one that already holds content — is replaced only on an explicit, server-checked yes.
  const edited = lastApplied ? hashDraft(c.preview_config, c.page_config) !== lastApplied.applied_hash : hasDraftContent(pv.value, pg.value);
  if (edited && !opts.overwrite) return { ok: false, code: "would_overwrite", error: OVERWRITE_MESSAGE };

  const fixture = fixtureEnabled();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!fixture && !apiKey) return { ok: false, code: "not_configured", error: "Peerie Bot isn't switched on yet (missing API key)." };

  const mode = runs.length === 0 ? "first" : runs[0].status === "failed" ? "retry" : "regenerate";
  const deps: RunDeps = fixture ? { ...realDeps(sb as unknown as SupabaseClient, "fixture"), ...fixtureDeps() } : realDeps(sb as unknown as SupabaseClient, apiKey!);
  const base = { source_url: src.url, mode, overwrote_edits: !!(edited && opts.overwrite), model: fixture ? "fixture" : ENRICH_MODEL };

  const failed = async (code: string, message: string, pages: unknown[] = []) => {
    try { await recordEnrichmentRun(id, { ...base, status: "failed", pages, error_code: code, error_detail: message.slice(0, 600) }); } catch { /* the log is best-effort; the campaign is untouched either way */ }
  };

  try {
    const out = await runEnrichment({ businessName: c.name, startUrl: src.url, directory: { description: rec.description, category: rec.category, locality: rec.locality } }, deps);
    if (!out.ok) { await failed(out.code, out.message, out.bundle?.notes ?? []); return { ok: false, code: out.code, error: out.message }; }

    const dateIso = new Date().toISOString();
    const applied = applyProposal(
      { preview: pv.value, page: pg.value, positioning: c.positioning },
      out.verified.proposal,
      { businessName: c.name, startUrl: src.url, host: src.host, bundle: out.bundle, directoryCoverUrl: rec.cover_url, dateIso, runNo: (runs[0]?.run_no ?? 0) + 1 },
    );
    const pv2 = parsePreviewConfig(applied.preview, c.slug); const pg2 = parsePageDraft(applied.page);
    if (!pv2.ok || !pg2.ok) { const why = pv2.ok ? (pg2 as { error: string }).error : pv2.error; await failed("invalid_draft", why, out.bundle.notes); return { ok: false, code: "invalid_draft", error: `The draft Peerie Bot produced didn't pass validation, so nothing was changed (${why}). Try again.` }; }

    await updateCampaign(id, { preview_config: pv2.value, page_config: pg2.value, ...(c.positioning ? {} : applied.positioning ? { positioning: applied.positioning } : {}) });
    const after = await getCampaign(id);
    const appliedHash = hashDraft(after?.preview_config ?? pv2.value, after?.page_config ?? pg2.value);

    const p = out.verified.proposal;
    let warning: string | undefined; let runNo = (runs[0]?.run_no ?? 0) + 1;
    try {
      const r = await recordEnrichmentRun(id, {
        ...base, status: "applied", pages: out.bundle.notes,
        images: out.bundle.images.map((i) => ({ id: i.id, url: i.url, mime: i.mime, bytes: i.bytes })),
        proposal: proposalRecord(p), dropped: out.verified.dropped, flags: out.verified.flags, applied_hash: appliedHash,
      });
      runNo = r.run_no;
    } catch { warning = "The draft was built, but its provenance could not be logged just now."; }
    return { ok: true, runNo, host: src.host, counts: { products: p.products.length, groups: p.groups.length, pictures: (p.hero ? 1 : 0) + p.gallery.length, dropped: out.verified.dropped.length, pages: out.bundle.pages.length }, flags: out.verified.flags, warning };
  } catch (e) {
    await failed("unexpected", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "unexpected", error: "Something went wrong while building the draft. Nothing was changed — try again." };
  }
}

/** What the campaign page needs to show the Peerie Bot section: runs, whether the draft was edited since, and a default address. */
export async function enrichmentView(c: { id: string; business_id: string; preview_config: unknown; page_config: unknown }) {
  const [runs, rec] = await Promise.all([enrichmentRuns(c.id), directoryRecords([c.business_id]).then((r) => r[0] ?? null).catch(() => null)]);
  const applied = runs.find((r) => r.status === "applied") ?? null;
  const pv = parsePreviewConfig(c.preview_config, (c.preview_config as { slug?: string })?.slug ?? ""); const pg = parsePageDraft(c.page_config);
  const editedSince = !!applied && hashDraft(c.preview_config, c.page_config) !== applied.applied_hash;
  const hasContent = hasDraftContent(pv.ok ? pv.value : (c.preview_config as never), pg.ok ? pg.value : (c.page_config as never));
  return { runs, editedSince, hasContent, defaultUrl: applied?.source_url ?? rec?.website ?? "" };
}
