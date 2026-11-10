"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-data.server";
import { createClient } from "@/lib/supabase/server";
import { STEPS, TEST_EDITION_SLUG, TEST_ORG, adminError, buildTestPlan, isStepKey, type StepKey, type StepResult } from "../helpers";

/**
 * "Create private test organisation": builds a ZZ TEST organiser + Edition through the REAL paths (RPCs for creation, verification, marking, entitlement and
 * publication; ordinary RLS-checked inserts for content). Runs as the signed-in administrator, never a service key. Idempotent: each step checks the current
 * state and is skipped when already done, so running it again repairs a partial failure. Pass `only` to run a single step.
 */
export type TestOrgRun = { ok: boolean; steps: StepResult[]; error?: string };

type Sb = Awaited<ReturnType<typeof createClient>>;
type Ctx = { sb: Sb; plan: ReturnType<typeof buildTestPlan>; orgId: string | null; org: { status: string; is_test: boolean } | null; editionId: string | null; edition: { status: string; is_test: boolean } | null };

const msg = (e: { message?: string } | null | undefined) => adminError(e?.message ?? "");

async function load(ctx: Ctx) {
  const { data: o } = await ctx.sb.from("edition_organisers").select("id, status, is_test").eq("slug", TEST_ORG.slug).maybeSingle();
  ctx.orgId = (o as { id: string } | null)?.id ?? null; ctx.org = o as Ctx["org"];
  const { data: e } = await ctx.sb.from("editions").select("id, status, is_test").eq("slug", TEST_EDITION_SLUG).maybeSingle();
  ctx.editionId = (e as { id: string } | null)?.id ?? null; ctx.edition = e as Ctx["edition"];
}

/** Insert only the rows whose natural key is not already there. */
async function insertMissing(ctx: Ctx, table: string, scope: [string, string], key: string, rows: Record<string, unknown>[]): Promise<{ done: boolean; detail: string; error?: string }> {
  const { data, error } = await ctx.sb.from(table).select(key).eq(scope[0], scope[1]);
  if (error) return { done: false, detail: "", error: msg(error) };
  const have = new Set(((data ?? []) as unknown as Record<string, string>[]).map((r) => r[key]));
  const todo = rows.filter((r) => !have.has(r[key] as string));
  if (!todo.length) return { done: false, detail: "already present" };
  const { error: e2 } = await ctx.sb.from(table).insert(todo.map((r) => ({ ...r, [scope[0]]: scope[1] })));
  if (e2) return { done: false, detail: "", error: msg(e2) };
  return { done: true, detail: `added ${todo.length}` };
}

type Out = { done: boolean; detail?: string; error?: string };
const RUN: Record<StepKey, (c: Ctx) => Promise<Out>> = {
  organiser: async (c) => {
    if (c.orgId) return { done: false, detail: "organiser exists" };
    const o = c.plan.organiser;
    const { data, error } = await c.sb.rpc("create_edition_organiser", { p_name: o.name, p_slug: o.slug, p_tagline: o.tagline, p_description: o.description });
    if (error) return { done: false, error: msg(error) };
    c.orgId = data as string; c.org = { status: "pending", is_test: false };
    return { done: true };
  },
  request_verification: async (c) => {
    if (!c.orgId || !c.org) return { done: false, error: "Needs the organiser first." };
    if (c.org.status === "verified") return { done: false, detail: "already verified" };
    const { count } = await c.sb.from("edition_organiser_verifications").select("id", { count: "exact", head: true }).eq("organiser_id", c.orgId);
    if ((count ?? 0) > 0 && c.org.status === "pending") return { done: false, detail: "request already on file" };
    const { error } = await c.sb.rpc("request_edition_organiser_verification", { p_org: c.orgId, p_evidence: c.plan.evidence });
    return error ? { done: false, error: msg(error) } : { done: true };
  },
  verify: async (c) => {
    if (!c.orgId || !c.org) return { done: false, error: "Needs the organiser first." };
    if (c.org.status === "verified") return { done: false, detail: "already verified" };
    if (c.org.status === "suspended") return { done: false, error: "The organiser is suspended; reinstate it from its page first." };
    const { error } = await c.sb.rpc("admin_decide_edition_organiser", { p_org: c.orgId, p_decision: "verify", p_note: c.plan.verifyNote });
    if (!error) c.org.status = "verified";
    return error ? { done: false, error: msg(error) } : { done: true };
  },
  mark_org_test: async (c) => {
    if (!c.orgId || !c.org) return { done: false, error: "Needs the organiser first." };
    if (c.org.is_test) return { done: false, detail: "already marked" };
    const { error } = await c.sb.rpc("admin_mark_edition_test", { p_org: c.orgId, p_edition: null });
    if (!error) c.org.is_test = true;
    return error ? { done: false, error: msg(error) } : { done: true };
  },
  edition: async (c) => {
    if (!c.orgId) return { done: false, error: "Needs the organiser first." };
    if (c.editionId) return { done: false, detail: "edition exists" };
    const e = c.plan.edition;
    const { data, error } = await c.sb.from("editions").insert({ organiser_id: c.orgId, ...e }).select("id").single();
    if (error) return { done: false, error: msg(error) };
    c.editionId = (data as { id: string }).id; c.edition = { status: "draft", is_test: false };
    return { done: true };
  },
  mark_edition_test: async (c) => {
    if (!c.orgId || !c.editionId || !c.edition) return { done: false, error: "Needs the Edition first." };
    if (c.edition.is_test) return { done: false, detail: "already marked" };
    const { error } = await c.sb.rpc("admin_mark_edition_test", { p_org: c.orgId, p_edition: c.editionId });
    if (!error) c.edition.is_test = true;
    return error ? { done: false, error: msg(error) } : { done: true };
  },
  pages: async (c) => c.editionId ? insertMissing(c, "edition_pages", ["edition_id", c.editionId], "slug", c.plan.pages) : { done: false, error: "Needs the Edition first." },
  venue: async (c) => c.orgId ? insertMissing(c, "edition_venues", ["organiser_id", c.orgId], "name", [c.plan.venue]) : { done: false, error: "Needs the organiser first." },
  sessions: async (c) => {
    if (!c.editionId || !c.orgId) return { done: false, error: "Needs the Edition first." };
    const { data: v } = await c.sb.from("edition_venues").select("id").eq("organiser_id", c.orgId).eq("name", c.plan.venue.name).maybeSingle();
    const venueId = (v as { id: string } | null)?.id ?? null;
    return insertMissing(c, "edition_sessions", ["edition_id", c.editionId], "title", c.plan.sessions.map((s, i) => ({ ...s, venue_id: venueId, position: i })));
  },
  updates: async (c) => c.editionId
    ? insertMissing(c, "edition_updates", ["edition_id", c.editionId], "title", c.plan.updates.map((u) => ({ ...u, published_at: new Date().toISOString() })))
    : { done: false, error: "Needs the Edition first." },
  sponsors: async (c) => c.editionId ? insertMissing(c, "edition_sponsors", ["edition_id", c.editionId], "name", c.plan.sponsors) : { done: false, error: "Needs the Edition first." },
  grant: async (c) => {
    if (!c.editionId) return { done: false, error: "Needs the Edition first." };
    const { data: live } = await c.sb.rpc("edition_entitled", { p_edition: c.editionId, p_feature: "publish" });
    if (live === true) return { done: false, detail: "a live publish entitlement exists" };
    const g = c.plan.grant;
    const { error } = await c.sb.rpc("admin_grant_edition_entitlement", {
      p_edition: c.editionId, p_feature: g.feature, p_starts: new Date().toISOString(), p_ends: new Date(Date.now() + g.days * 86_400_000).toISOString(), p_reason: g.reason,
    });
    return error ? { done: false, error: msg(error) } : { done: true };
  },
  publish: async (c) => {
    if (!c.editionId || !c.edition) return { done: false, error: "Needs the Edition first." };
    if (c.edition.status === "published") return { done: false, detail: "already published" };
    if (c.edition.status !== "draft") return { done: false, error: `The Edition is ${c.edition.status}; restore it to draft first.` };
    const { error } = await c.sb.rpc("edition_set_status", { p_edition: c.editionId, p_to: "published" });
    if (!error) c.edition.status = "published";
    return error ? { done: false, error: msg(error) } : { done: true };
  },
};

export async function runTestOrganisationAction(only?: string): Promise<TestOrgRun> {
  await requireAdmin();
  if (only && !isStepKey(only)) return { ok: false, steps: [], error: "Unknown step." };
  const steps: StepResult[] = [];
  try {
    const ctx: Ctx = { sb: await createClient(), plan: buildTestPlan(), orgId: null, org: null, editionId: null, edition: null };
    await load(ctx);
    for (const s of STEPS) {
      if (only && s.key !== only) continue;
      let out: Out;
      try { out = await RUN[s.key](ctx); } catch (e) { out = { done: false, error: adminError(e instanceof Error ? e.message : "") }; }
      if (out.error) { steps.push({ key: s.key, label: s.label, status: "failed", detail: out.error }); break; }
      steps.push({ key: s.key, label: s.label, status: out.done ? "done" : "skipped", detail: out.detail });
    }
    revalidatePath("/admin/editions");
    revalidatePath("/admin/editions/test-organisation");
    return { ok: !steps.some((s) => s.status === "failed"), steps };
  } catch (e) {
    return { ok: false, steps, error: adminError(e instanceof Error ? e.message : "") };
  }
}
