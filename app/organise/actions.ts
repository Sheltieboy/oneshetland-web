"use server";

/**
 * Organiser mutations. Every action runs as the signed-in user through the anon-key server client, so row-level security, column grants and the
 * database triggers are always enforced; there is no service key anywhere in this file. Each action:
 *   1. resolves the organiser (and Edition) from the SLUGS in the URL on the server and checks the caller's role (organiser_id is never taken from the client),
 *   2. validates input with the shared pure validators,
 *   3. performs the write, mapping database refusals through friendlyError,
 *   4. revalidates the affected routes.
 */
import { isDemoMode, DEMO_BLOCKED } from "@/lib/editions/demo-mode";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, friendlyError } from "@/lib/editions/rules";
import { inviteFields, isPartnerAction, noteField, type FindActivity, type FindBusiness, type FindHub } from "@/lib/editions/partners";
import type { OrgRole } from "@/lib/editions/types";
import {
  editionFields, editionSlug, inviteInput, isOrgRole, isUuid, organiserProfile, pageFields, seriesName, sessionFields, sponsorFields,
  updateFields, venueFields,
} from "@/lib/editions/validate";

type Fail = { ok: false; error: string };
type Ok<T = object> = { ok: true } & T;
type Result<T = object> = Ok<T> | Fail;
type Input = Record<string, unknown>;

const NO_PERMISSION = "You do not have permission to do that.";
const bad = (error: string): Fail => ({ ok: false, error });
const isSlugArg = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;

async function organiserCtx(slug: string, min: OrgRole) {
  if (!isSlugArg(slug)) return bad("That organiser could not be found.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return bad("Please sign in again to continue.");
  const { data: org } = await sb.from("edition_organisers").select("id, slug, status").eq("slug", slug).maybeSingle();
  if (!org) return bad("That organiser could not be found.");
  const { data: role } = await sb.rpc("edition_org_role", { p_org: org.id });
  if (!can(role as OrgRole | null, min)) return bad(NO_PERMISSION);
  return { sb, userId: user.id, org: org as { id: string; slug: string; status: string }, role: role as OrgRole };
}

async function editionCtx(slug: string, editionSlugArg: string, min: OrgRole) {
  const c = await organiserCtx(slug, min);
  if ("ok" in c) return c;
  if (!isSlugArg(editionSlugArg)) return bad("That Edition could not be found.");
  const { data: ed } = await c.sb.from("editions").select("id, slug, status, starts_on, ends_on").eq("organiser_id", c.org.id).eq("slug", editionSlugArg).maybeSingle();
  if (!ed) return bad("That Edition could not be found.");
  return { ...c, edition: ed as { id: string; slug: string; status: string; starts_on: string; ends_on: string } };
}

const base = (slug: string) => `/organise/${slug}`;
const edBase = (slug: string, ed: string) => `/organise/${slug}/editions/${ed}`;
function revalidateEdition(slug: string, ed: string, sub?: string) {
  revalidatePath(edBase(slug, ed));
  if (sub) revalidatePath(`${edBase(slug, ed)}/${sub}`);
  revalidatePath(base(slug));
  revalidatePath(`/editions/${ed}`, "layout");
}

/* ── Organiser profile (the Editions profile is created automatically from the Business or Hub: see lib/editions/ensure-organiser.server.ts) ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function updateOrganiserProfile(slug: string, input: Input): Promise<Result> {
  const c = await organiserCtx(slug, "admin");
  if ("ok" in c) return c;
  const v = organiserProfile(input);
  if (!v.ok) return bad(v.error);
  // The name follows the Business or Hub and is not writable here; only the presentation fields are saved.
  const { name: _followsParent, ...own } = v.value;
  void _followsParent;
  const { data, error } = await c.sb.from("edition_organisers").update(own).eq("id", c.org.id).select("id");
  if (error) return bad(friendlyError(error.message));
  if (!data?.length) return bad(NO_PERMISSION);
  revalidatePath(base(slug), "layout");
  revalidatePath(`/organisers/${slug}`);
  return { ok: true };
}

/* ── Team ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function inviteMember(slug: string, input: Input): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await organiserCtx(slug, "owner");
  if ("ok" in c) return c;
  const v = inviteInput(input);
  if (!v.ok) return bad(v.error);
  const { error } = await c.sb.rpc("invite_edition_member", { p_org: c.org.id, p_email: v.value.email, p_role: v.value.role });
  if (error) return bad(/duplicate|unique/i.test(error.message) ? "That person already has a pending invitation." : friendlyError(error.message));
  revalidatePath(`${base(slug)}/team`);
  return { ok: true };
}

export async function revokeInvite(slug: string, inviteId: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await organiserCtx(slug, "owner");
  if ("ok" in c) return c;
  if (!isUuid(inviteId)) return bad("That invitation could not be found.");
  // The invitation must belong to this organiser (the RPC also checks ownership of the invitation's own organiser).
  const { data: inv } = await c.sb.from("edition_organiser_invites").select("id").eq("id", inviteId).eq("organiser_id", c.org.id).maybeSingle();
  if (!inv) return bad("That invitation could not be found.");
  const { error } = await c.sb.rpc("revoke_edition_invite", { p_invite: inviteId });
  if (error) return bad(friendlyError(error.message));
  revalidatePath(`${base(slug)}/team`);
  return { ok: true };
}

export async function acceptInvite(inviteId: string): Promise<Result<{ slug: string | null }>> {
  if (!isUuid(inviteId)) return bad("That invitation could not be found.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return bad("Please sign in again to continue.");
  const { data: orgId, error } = await sb.rpc("accept_edition_invite", { p_invite: inviteId });
  if (error) return bad(/not available/i.test(error.message) ? "This invitation has expired or was sent to a different email address." : friendlyError(error.message));
  const { data: org } = typeof orgId === "string" ? await sb.from("edition_organisers").select("slug").eq("id", orgId).maybeSingle() : { data: null };
  revalidatePath("/organise");
  return { ok: true, slug: (org as { slug?: string } | null)?.slug ?? null };
}

export async function setMemberRole(slug: string, userId: string, role: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await organiserCtx(slug, "owner");
  if ("ok" in c) return c;
  if (!isUuid(userId) || !isOrgRole(role)) return bad("Choose a valid role.");
  const { error } = await c.sb.rpc("set_edition_member_role", { p_org: c.org.id, p_user: userId, p_role: role });
  if (error) return bad(friendlyError(error.message));
  revalidatePath(`${base(slug)}/team`);
  return { ok: true };
}

/** An owner may remove anyone; any member may remove themselves (leave). The database refuses to remove the last owner. */
export async function removeMember(slug: string, userId: string): Promise<Result<{ left: boolean }>> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await organiserCtx(slug, "editor");
  if ("ok" in c) return c;
  if (!isUuid(userId)) return bad("That person could not be found.");
  const self = userId === c.userId;
  if (!self && !can(c.role, "owner")) return bad(NO_PERMISSION);
  const { error } = await c.sb.rpc("remove_edition_member", { p_org: c.org.id, p_user: userId });
  if (error) return bad(friendlyError(error.message));
  revalidatePath(`${base(slug)}/team`);
  revalidatePath("/organise");
  return { ok: true, left: self };
}

/* ── Editions ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/** input.new_series_name creates a series (admin+) and attaches the Edition to it. */
export async function createEdition(slug: string, input: Input): Promise<Result<{ edition: string }>> {
  const c = await organiserCtx(slug, "admin");
  if ("ok" in c) return c;
  const f = editionFields(input);
  if (!f.ok) return bad(f.error);
  const s = editionSlug(input.slug, f.value.title);
  if (!s.ok) return bad(s.error);
  let seriesId = f.value.series_id;
  const newSeries = typeof input.new_series_name === "string" ? input.new_series_name.trim() : "";
  if (newSeries) {
    const n = seriesName(newSeries);
    if (!n.ok) return bad(n.error);
    const { data, error } = await c.sb.from("edition_series").insert({ organiser_id: c.org.id, name: n.value }).select("id").single();
    if (error || !data) return bad(friendlyError(error?.message));
    seriesId = data.id as string;
  } else if (seriesId) {
    const { data } = await c.sb.from("edition_series").select("id").eq("id", seriesId).eq("organiser_id", c.org.id).maybeSingle();
    if (!data) return bad("That series belongs to another organiser.");
  }
  const { error } = await c.sb.from("editions").insert({ ...f.value, series_id: seriesId, slug: s.value, organiser_id: c.org.id });
  if (error) return bad(/duplicate|unique/i.test(error.message) ? "That web address is already used by another Edition. Choose a different one." : friendlyError(error.message));
  revalidatePath(base(slug));
  return { ok: true, edition: s.value };
}

export async function updateEdition(slug: string, editionSlugArg: string, input: Input): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (c.edition.status === "suspended") return bad(friendlyError("suspended by OneShetland"));
  const f = editionFields(input);
  if (!f.ok) return bad(f.error);
  if (f.value.series_id) {
    const { data } = await c.sb.from("edition_series").select("id").eq("id", f.value.series_id).eq("organiser_id", c.org.id).maybeSingle();
    if (!data) return bad("That series belongs to another organiser.");
  }
  const { data, error } = await c.sb.from("editions").update(f.value).eq("id", c.edition.id).select("id");
  if (error) return bad(friendlyError(error.message));
  if (!data?.length) return bad(NO_PERMISSION);
  revalidateEdition(slug, editionSlugArg, "details");
  return { ok: true };
}

export async function setEditionStatus(slug: string, editionSlugArg: string, to: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "admin");
  if ("ok" in c) return c;
  if (to !== "draft" && to !== "published" && to !== "archived") return bad("That status is not available.");
  const { error } = await c.sb.rpc("edition_set_status", { p_edition: c.edition.id, p_to: to });
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg);
  revalidatePath("/editions");
  return { ok: true };
}

/** Send an Edition to OneShetland for review. The database re-checks the required items and refuses with a plain list of what is missing. */
export async function submitEditionForReview(slug: string, editionSlugArg: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await editionCtx(slug, editionSlugArg, "admin");
  if ("ok" in c) return c;
  const { error } = await c.sb.rpc("edition_submit_for_review", { p_edition: c.edition.id });
  if (error) return bad(/finish these first: (.+)/i.test(error.message) ? `Finish these first: ${error.message.replace(/^.*finish these first:\s*/i, "")}.` : friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg);
  return { ok: true };
}

/** Take an Edition back from review (a first submission or a resubmission). */
export async function withdrawEditionSubmission(slug: string, editionSlugArg: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await editionCtx(slug, editionSlugArg, "admin");
  if ("ok" in c) return c;
  const { error } = await c.sb.rpc("edition_withdraw_submission", { p_edition: c.edition.id });
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg);
  return { ok: true };
}

export async function deleteEdition(slug: string, editionSlugArg: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "admin");
  if ("ok" in c) return c;
  if (c.edition.status !== "draft") return bad("Only a draft Edition can be deleted. Archive it instead.");
  const { data, error } = await c.sb.from("editions").delete().eq("id", c.edition.id).eq("status", "draft").select("id");
  if (error) return bad(friendlyError(error.message));
  if (!data?.length) return bad(NO_PERMISSION);
  revalidatePath(base(slug));
  return { ok: true };
}

/* ── Pages ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function savePage(slug: string, editionSlugArg: string, pageId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (pageId !== null && !isUuid(pageId)) return bad("That page could not be found.");
  const v = pageFields(input);
  if (!v.ok) return bad(v.error);
  // Only one page may be the home page: step the current one aside first, and put it back if the save fails.
  let displaced: string | null = null;
  if (v.value.is_home) {
    const { data: cur } = await c.sb.from("edition_pages").select("id").eq("edition_id", c.edition.id).eq("is_home", true);
    const other = ((cur ?? []) as { id: string }[]).find((r) => r.id !== pageId);
    if (other) {
      const { error } = await c.sb.from("edition_pages").update({ is_home: false }).eq("id", other.id).eq("edition_id", c.edition.id);
      if (error) return bad(friendlyError(error.message));
      displaced = other.id;
    }
  }
  const restore = async () => { if (displaced) await c.sb.from("edition_pages").update({ is_home: true }).eq("id", displaced).eq("edition_id", c.edition.id); };
  if (pageId) {
    const { data, error } = await c.sb.from("edition_pages").update(v.value).eq("id", pageId).eq("edition_id", c.edition.id).select("id");
    if (error || !data?.length) { await restore(); return bad(error ? (/duplicate|unique/i.test(error.message) ? "Another page already uses that address." : friendlyError(error.message)) : NO_PERMISSION); }
    revalidateEdition(slug, editionSlugArg, "pages");
    return { ok: true, id: pageId };
  }
  const { data, error } = await c.sb.from("edition_pages").insert({ ...v.value, edition_id: c.edition.id }).select("id").single();
  if (error || !data) { await restore(); return bad(/duplicate|unique/i.test(error?.message ?? "") ? "Another page already uses that address." : friendlyError(error?.message)); }
  revalidateEdition(slug, editionSlugArg, "pages");
  return { ok: true, id: data.id as string };
}

export async function deletePage(slug: string, editionSlugArg: string, pageId: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(pageId)) return bad("That page could not be found.");
  const { error } = await c.sb.from("edition_pages").delete().eq("id", pageId).eq("edition_id", c.edition.id);
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg, "pages");
  return { ok: true };
}

/** Move a page up or down in the navigation by rewriting positions 0..n-1 in the new order. */
export async function movePage(slug: string, editionSlugArg: string, pageId: string, direction: "up" | "down"): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(pageId) || (direction !== "up" && direction !== "down")) return bad("That page could not be found.");
  const { data } = await c.sb.from("edition_pages").select("id, position").eq("edition_id", c.edition.id).order("position").order("created_at");
  const rows = (data ?? []) as { id: string; position: number }[];
  const i = rows.findIndex((r) => r.id === pageId), j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (let k = 0; k < rows.length; k++) {
    const { error } = await c.sb.from("edition_pages").update({ position: k }).eq("id", rows[k].id).eq("edition_id", c.edition.id);
    if (error) return bad(friendlyError(error.message));
  }
  revalidateEdition(slug, editionSlugArg, "pages");
  return { ok: true };
}

/* ── Venues and sessions ───────────────────────────────────────────────────────────────────────────────────────── */

export async function saveVenue(slug: string, venueId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await organiserCtx(slug, "editor");
  if ("ok" in c) return c;
  if (venueId !== null && !isUuid(venueId)) return bad("That venue could not be found.");
  const v = venueFields(input);
  if (!v.ok) return bad(v.error);
  if (venueId) {
    const { data, error } = await c.sb.from("edition_venues").update(v.value).eq("id", venueId).eq("organiser_id", c.org.id).select("id");
    if (error) return bad(friendlyError(error.message));
    if (!data?.length) return bad(NO_PERMISSION);
  } else {
    const { data, error } = await c.sb.from("edition_venues").insert({ ...v.value, organiser_id: c.org.id }).select("id").single();
    if (error || !data) return bad(friendlyError(error?.message));
    venueId = data.id as string;
  }
  revalidatePath(`${base(slug)}/editions`, "layout");
  return { ok: true, id: venueId };
}

export async function deleteVenue(slug: string, venueId: string): Promise<Result> {
  const c = await organiserCtx(slug, "editor");
  if ("ok" in c) return c;
  if (!isUuid(venueId)) return bad("That venue could not be found.");
  const { error } = await c.sb.from("edition_venues").delete().eq("id", venueId).eq("organiser_id", c.org.id);
  if (error) return bad(/foreign key|violates/i.test(error.message) ? "That venue is still used by a session. Change those sessions first." : friendlyError(error.message));
  revalidatePath(`${base(slug)}/editions`, "layout");
  return { ok: true };
}

export async function saveSession(slug: string, editionSlugArg: string, sessionId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (sessionId !== null && !isUuid(sessionId)) return bad("That session could not be found.");
  const v = sessionFields(input, c.edition);
  if (!v.ok) return bad(v.error);
  if (v.value.venue_id) {
    const { data } = await c.sb.from("edition_venues").select("id").eq("id", v.value.venue_id).eq("organiser_id", c.org.id).maybeSingle();
    if (!data) return bad("That venue belongs to another organiser.");
  }
  if (sessionId) {
    const { data, error } = await c.sb.from("edition_sessions").update(v.value).eq("id", sessionId).eq("edition_id", c.edition.id).select("id");
    if (error) return bad(friendlyError(error.message));
    if (!data?.length) return bad(NO_PERMISSION);
  } else {
    const { data, error } = await c.sb.from("edition_sessions").insert({ ...v.value, edition_id: c.edition.id }).select("id").single();
    if (error || !data) return bad(friendlyError(error?.message));
    sessionId = data.id as string;
  }
  // the businesses named on this session (only partners of this Edition: the database refuses anything else). Omitted = leave as it is.
  if (Array.isArray(input.business_links)) {
    const ids = (input.business_links as unknown[]).filter((x): x is string => typeof x === "string" && isUuid(x));
    const { error } = await c.sb.rpc("edition_session_set_businesses", { p_session: sessionId, p_links: ids });
    if (error) return bad(friendlyError(error.message));
  }
  revalidateEdition(slug, editionSlugArg, "programme");
  return { ok: true, id: sessionId };
}

export async function deleteSession(slug: string, editionSlugArg: string, sessionId: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(sessionId)) return bad("That session could not be found.");
  const { error } = await c.sb.from("edition_sessions").delete().eq("id", sessionId).eq("edition_id", c.edition.id);
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg, "programme");
  return { ok: true };
}

/* ── Updates and sponsors ──────────────────────────────────────────────────────────────────────────────────────── */

export async function saveUpdate(slug: string, editionSlugArg: string, updateId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (updateId !== null && !isUuid(updateId)) return bad("That update could not be found.");
  let existing: string | null = null;
  if (updateId) {
    const { data } = await c.sb.from("edition_updates").select("published_at").eq("id", updateId).eq("edition_id", c.edition.id).maybeSingle();
    if (!data) return bad("That update could not be found.");
    existing = (data as { published_at: string | null }).published_at;
  }
  const v = updateFields(input, existing);
  if (!v.ok) return bad(v.error);
  if (updateId) {
    const { error } = await c.sb.from("edition_updates").update(v.value).eq("id", updateId).eq("edition_id", c.edition.id);
    if (error) return bad(friendlyError(error.message));
  } else {
    const { data, error } = await c.sb.from("edition_updates").insert({ ...v.value, edition_id: c.edition.id }).select("id").single();
    if (error || !data) return bad(friendlyError(error?.message));
    updateId = data.id as string;
  }
  revalidateEdition(slug, editionSlugArg, "updates");
  return { ok: true, id: updateId };
}

export async function deleteUpdate(slug: string, editionSlugArg: string, updateId: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(updateId)) return bad("That update could not be found.");
  const { error } = await c.sb.from("edition_updates").delete().eq("id", updateId).eq("edition_id", c.edition.id);
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg, "updates");
  return { ok: true };
}

export async function saveSponsor(slug: string, editionSlugArg: string, sponsorId: string | null, input: Input): Promise<Result<{ id: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (sponsorId !== null && !isUuid(sponsorId)) return bad("That sponsor could not be found.");
  const v = sponsorFields(input);
  if (!v.ok) return bad(v.error);
  if (sponsorId) {
    const { data, error } = await c.sb.from("edition_sponsors").update(v.value).eq("id", sponsorId).eq("edition_id", c.edition.id).select("id");
    if (error) return bad(friendlyError(error.message));
    if (!data?.length) return bad(NO_PERMISSION);
  } else {
    const { data, error } = await c.sb.from("edition_sponsors").insert({ ...v.value, edition_id: c.edition.id }).select("id").single();
    if (error || !data) return bad(friendlyError(error?.message));
    sponsorId = data.id as string;
  }
  revalidateEdition(slug, editionSlugArg, "sponsors");
  return { ok: true, id: sponsorId };
}

export async function deleteSponsor(slug: string, editionSlugArg: string, sponsorId: string): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(sponsorId)) return bad("That sponsor could not be found.");
  const { error } = await c.sb.from("edition_sponsors").delete().eq("id", sponsorId).eq("edition_id", c.edition.id);
  if (error) return bad(friendlyError(error.message));
  revalidateEdition(slug, editionSlugArg, "sponsors");
  return { ok: true };
}

/* ── Partners (R2) ───────────────────────────────────────────────────────────────────────────────────────────────── */
// Every partnership write is a database function that checks, from who started the link, which side may act. Nothing here edits a business,
// event, activity or offer; the Edition only ever holds a reference that the owner can withdraw.

function revalidatePartners(slug: string, ed: string) {
  revalidateEdition(slug, ed, "partners");
  revalidatePath(`/editions/${ed}`, "layout");
  revalidatePath("/account/editions");
}

export async function findBusinesses(slug: string, editionSlugArg: string, q: string): Promise<Result<{ rows: FindBusiness[] }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  const text = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (text.length < 2) return { ok: true, rows: [] };
  const { data, error } = await c.sb.rpc("edition_find_businesses", { p_edition: c.edition.id, p_q: text });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, rows: (data ?? []) as FindBusiness[] };
}

export async function findHubs(slug: string, editionSlugArg: string, q: string): Promise<Result<{ rows: FindHub[] }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  const text = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (text.length < 2) return { ok: true, rows: [] };
  const { data, error } = await c.sb.rpc("edition_find_hubs", { p_edition: c.edition.id, p_q: text });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, rows: (data ?? []) as FindHub[] };
}

export async function findActivities(slug: string, editionSlugArg: string, q: string): Promise<Result<{ rows: FindActivity[] }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  const text = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (text.length < 2) return { ok: true, rows: [] };
  const { data, error } = await c.sb.rpc("edition_find_activities", { p_edition: c.edition.id, p_q: text });
  if (error) return bad(friendlyError(error.message));
  return { ok: true, rows: (data ?? []) as FindActivity[] };
}

export async function invitePartner(slug: string, editionSlugArg: string, input: Input): Promise<Result<{ id: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  const v = inviteFields(input);
  if (!v.ok) return bad(v.error);
  const { data, error } = await c.sb.rpc("edition_invite_partner", { p_edition: c.edition.id, p_kind: v.value.kind, p_subject: v.value.subject, p_label: v.value.label, p_message: v.value.message });
  if (error) return bad(friendlyError(error.message));
  revalidatePartners(slug, editionSlugArg);
  return { ok: true, id: String(data) };
}

export async function partnerAction(slug: string, editionSlugArg: string, linkId: string, action: string, note?: string): Promise<Result<{ state: string }>> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(linkId) || !isPartnerAction(action)) return bad("That request could not be found.");
  if (action === "withdraw") return bad(NO_PERMISSION); // only the owner of the business, event or activity can step back
  const n = noteField(note ?? "");
  if (!n.ok) return bad(n.error);
  // the link must belong to THIS Edition: never trust a link id from the client on its own
  const { data: own } = await c.sb.from("edition_links").select("id").eq("id", linkId).eq("edition_id", c.edition.id).maybeSingle();
  if (!own) return bad("That request could not be found.");
  const { data, error } = await c.sb.rpc("edition_link_act", { p_link: linkId, p_action: action, p_note: n.value });
  if (error) return bad(friendlyError(error.message));
  revalidatePartners(slug, editionSlugArg);
  return { ok: true, state: String(data) };
}

export async function setPartnerDisplay(slug: string, editionSlugArg: string, linkId: string, label: string, position: number): Promise<Result> {
  const c = await editionCtx(slug, editionSlugArg, "editor");
  if ("ok" in c) return c;
  if (!isUuid(linkId)) return bad("That partner could not be found.");
  const l = typeof label === "string" ? label.trim() : "";
  if (l.length > 60) return bad("The heading must be 60 characters or fewer.");
  const { error } = await c.sb.rpc("edition_link_set_display", { p_link: linkId, p_label: l || null, p_position: Number.isFinite(position) ? Math.max(0, Math.min(999, Math.round(position))) : 0 });
  if (error) return bad(friendlyError(error.message));
  revalidatePartners(slug, editionSlugArg);
  return { ok: true };
}
