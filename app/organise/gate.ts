import { notFound, redirect } from "next/navigation";
import { getEditionsAccess, getManageBundle, requireOrganiser } from "@/lib/editions/data.server";
import { isLocalPath } from "@/lib/redirect";
import { can } from "@/lib/editions/rules";
import type { OrgRole } from "@/lib/editions/types";

/** Every organiser page: signed-out visitors go to sign-in (with a safe return path); anyone Editions is not enabled for gets a 404. */
export async function gate(returnPath: string) {
  const access = await getEditionsAccess();
  if (!access.signedIn) redirect(`/sign-in?next=${encodeURIComponent(isLocalPath(returnPath) ? returnPath : "/organise")}`);
  if (!access.allowed) notFound();
  return access;
}

export async function organiserPage(slug: string, returnPath: string, min: OrgRole = "editor") {
  await gate(returnPath);
  const ctx = await requireOrganiser(slug, { returnPath, min });
  // requireOrganiser only proves membership; the minimum role is enforced here (and again by the database on every write).
  if (!can(ctx.role, min)) notFound();
  return ctx;
}

export async function editionPage(slug: string, editionSlug: string, returnPath: string) {
  const ctx = await organiserPage(slug, returnPath);
  const bundle = await getManageBundle(ctx.organiser, editionSlug);
  if (!bundle) notFound();
  return { ...ctx, bundle };
}
