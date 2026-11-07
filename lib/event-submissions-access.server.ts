import "server-only";
/**
 * event-submissions-access.server.ts — the one gate for every community-event screen (the form, My submissions, the contributor page).
 * Same rule as the hidden front door: open only when the server-only switch EVENT_FRONT_DOOR is "on", or for a signed-in administrator
 * previewing it, or for an allowlisted tester during controlled acceptance testing. Everyone else gets a 404, so the feature does not exist for them.
 */
import { notFound, redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-data.server";
import { frontDoorAccess } from "@/lib/event-front-door";
import { createClient } from "@/lib/supabase/server";
import { isSubmissionTester, type Sb } from "@/lib/event-submissions-client";

export type FeatureGate = { access: "open" | "staff_preview" | "tester"; account: Account | null };

/**
 * 404 unless the feature is on, or the viewer is an admin, or the viewer is an allowlisted tester. Does not require sign-in.
 * The tester check is one cheap call, made only for a signed-in non-admin when the public flag is off, and a missing function counts as "not a tester".
 */
export async function gateFeature(): Promise<FeatureGate> {
  const flag = process.env.EVENT_FRONT_DOOR;
  const isStaff = flag === "on" ? false : await isAdmin();
  const account = await getAccount();
  const isTester = flag === "on" || isStaff || !account ? false : await isSubmissionTester(await serverSb());
  const access = frontDoorAccess({ flag, isStaff, isTester });
  if (access === "hidden") notFound();
  return { access, account };
}

/** As gateFeature, then send a signed-out person to sign in and straight back to `returnPath`. */
export async function gateFeatureSignedIn(returnPath: string): Promise<{ access: "open" | "staff_preview" | "tester"; account: Account }> {
  const g = await gateFeature();
  if (!g.account) redirect(`/sign-in?next=${encodeURIComponent(returnPath)}`);
  return { access: g.access, account: g.account };
}

export async function serverSb(): Promise<Sb> {
  return (await createClient()) as unknown as Sb;
}
