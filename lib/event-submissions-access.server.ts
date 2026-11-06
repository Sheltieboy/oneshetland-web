import "server-only";
/**
 * event-submissions-access.server.ts — the one gate for every community-event screen (the form, My submissions, the contributor page).
 * Same rule as the hidden front door: open only when the server-only switch EVENT_FRONT_DOOR is "on", or for a signed-in administrator
 * previewing it. Everyone else gets a 404, so the feature does not exist for them.
 */
import { notFound, redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-data.server";
import { frontDoorAccess } from "@/lib/event-front-door";
import { createClient } from "@/lib/supabase/server";
import type { Sb } from "@/lib/event-submissions-client";

export type FeatureGate = { access: "open" | "staff_preview"; account: Account | null };

/** 404 unless the feature is on (or the viewer is an admin). Does not require sign-in. */
export async function gateFeature(): Promise<FeatureGate> {
  const flag = process.env.EVENT_FRONT_DOOR;
  const access = frontDoorAccess({ flag, isStaff: flag === "on" ? false : await isAdmin() });
  if (access === "hidden") notFound();
  return { access, account: await getAccount() };
}

/** As gateFeature, then send a signed-out person to sign in and straight back to `returnPath`. */
export async function gateFeatureSignedIn(returnPath: string): Promise<{ access: "open" | "staff_preview"; account: Account }> {
  const g = await gateFeature();
  if (!g.account) redirect(`/sign-in?next=${encodeURIComponent(returnPath)}`);
  return { access: g.access, account: g.account };
}

export async function serverSb(): Promise<Sb> {
  return (await createClient()) as unknown as Sb;
}
