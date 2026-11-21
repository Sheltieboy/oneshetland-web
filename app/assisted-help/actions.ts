"use server";
/**
 * The OWNER's side of "keep helping me".
 *
 * Deliberately NOT in the admin action file and deliberately NOT behind requireAdmin: this is the
 * owner acting on their own record. The database function checks that the caller really is the owner,
 * so there is no way to grant somebody else's permission from here.
 */
import { revalidatePath } from "next/cache";
import { grantSupportAsOwner, revokeSupport, supportState } from "@/lib/assisted/invites.server";
import type { AssistedKind } from "@/lib/assisted/shape";

export async function ownerSupportStateAction(input: { kind: AssistedKind; id: string }) {
  return supportState(input.kind, input.id);
}

export async function ownerGrantSupportAction(input: { kind: AssistedKind; id: string; days: number; note: string | null }) {
  const r = await grantSupportAsOwner(input.kind, input.id, input.days, input.note);
  if (r.ok) revalidatePath(input.kind === "hub" ? "/hubs" : "/business");
  return r;
}

export async function ownerEndSupportAction(input: { kind: AssistedKind; id: string }) {
  const r = await revokeSupport(input.kind, input.id, "ended by the owner");
  if (r.ok) revalidatePath(input.kind === "hub" ? "/hubs" : "/business");
  return r;
}
