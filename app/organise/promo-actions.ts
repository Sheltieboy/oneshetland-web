"use server";

/**
 * Promotion actions. As the signed-in user through the anon key: the database functions check the role, the Edition's state, availability, lead time, fairness and notice again;
 * nothing here can write a booking or a right directly. Dates are passed explicitly (whole London days); the database never guesses "today" for us.
 */
import { revalidatePath } from "next/cache";
import { isDemoMode, DEMO_BLOCKED } from "@/lib/editions/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { can, friendlyError } from "@/lib/editions/rules";
import type { OrgRole } from "@/lib/editions/types";
import { isUuid } from "@/lib/editions/validate";
import { isIsoDay } from "@/lib/editions/promo";

type Fail = { ok: false; error: string };
type Result = { ok: true } | Fail;
const bad = (error: string): Fail => ({ ok: false, error });
const NO = "Only an owner or administrator can schedule promotion.";
const isSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;
const fail = (e: { message?: string; hint?: string | null }) => bad(friendlyError(e.message, e.hint));

async function ctx(slug: string, edSlug: string) {
  if (!isSlug(slug) || !isSlug(edSlug)) return bad("That Edition could not be found.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return bad("Please sign in again to continue.");
  const { data: org } = await sb.from("edition_organisers").select("id, slug").eq("slug", slug).maybeSingle();
  if (!org) return bad("That organiser could not be found.");
  const { data: role } = await sb.rpc("edition_org_role", { p_org: org.id });
  if (!can(role as OrgRole | null, "admin")) return bad(NO);
  const { data: ed } = await sb.from("editions").select("id, slug").eq("organiser_id", org.id).eq("slug", edSlug).maybeSingle();
  if (!ed) return bad("That Edition could not be found.");
  return { sb, edition: ed as { id: string; slug: string }, slug, edSlug };
}
const refresh = (slug: string, edSlug: string) => { revalidatePath(`/organise/${slug}/editions/${edSlug}`, "layout"); revalidatePath("/editions", "layout"); };

/** Schedule one right (a single run, or the homepage days of a campaign whose discovery days are already booked). */
export async function bookPromotion(slug: string, edSlug: string, rightId: string, start: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, edSlug); if ("ok" in c) return c;
  if (!isUuid(rightId) || !isIsoDay(start)) return bad("Choose a start date.");
  const { error } = await c.sb.rpc("edition_promo_book", { p_right: rightId, p_start: start });
  if (error) return fail(error);
  refresh(slug, edSlug); return { ok: true };
}
/** Schedule a campaign: the discovery days and the homepage days inside them, together or not at all. */
export async function bookCampaign(slug: string, edSlug: string, groupId: string, discoveryStart: string, homepageStart: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, edSlug); if ("ok" in c) return c;
  if (!isUuid(groupId) || !isIsoDay(discoveryStart) || !isIsoDay(homepageStart)) return bad("Choose both start dates.");
  const { error } = await c.sb.rpc("edition_promo_book_campaign", { p_edition: c.edition.id, p_group: groupId, p_discovery_start: discoveryStart, p_homepage_start: homepageStart });
  if (error) return fail(error);
  refresh(slug, edSlug); return { ok: true };
}
export async function cancelPromotion(slug: string, edSlug: string, bookingId: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, edSlug); if ("ok" in c) return c;
  if (!isUuid(bookingId)) return bad("That booking could not be found.");
  const { error } = await c.sb.rpc("edition_promo_cancel", { p_booking: bookingId });
  if (error) return fail(error);
  refresh(slug, edSlug); return { ok: true };
}
export async function reschedulePromotion(slug: string, edSlug: string, bookingId: string, start: string): Promise<Result> {
  if (isDemoMode()) return bad(DEMO_BLOCKED);
  const c = await ctx(slug, edSlug); if ("ok" in c) return c;
  if (!isUuid(bookingId) || !isIsoDay(start)) return bad("Choose a new start date.");
  const { error } = await c.sb.rpc("edition_promo_reschedule", { p_booking: bookingId, p_start: start });
  if (error) return fail(error);
  refresh(slug, edSlug); return { ok: true };
}
