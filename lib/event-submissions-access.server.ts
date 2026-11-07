import "server-only";
/**
 * event-submissions-access.server.ts — the one gate for every community-event screen (the form, My submissions, the contributor page).
 * Same rule as the hidden front door: open only when the server-only switch EVENT_FRONT_DOOR is "on", or for a signed-in administrator
 * previewing it, or for an allowlisted tester during controlled acceptance testing. Everyone else gets a 404, so the feature does not exist for them.
 */
import { notFound, redirect } from "next/navigation";
import { getAccount, type Account } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-data.server";
import { frontDoorAccess, myEventsEntryVisible, myEventsProps } from "@/lib/event-front-door";
import { createClient } from "@/lib/supabase/server";
import { isSubmissionTester, type Sb } from "@/lib/event-submissions-client";

export type FeatureGate = { access: "open" | "staff_preview" | "tester"; account: Account | null };

/**
 * 404 unless the feature is on, or the viewer is an admin, or the viewer is an allowlisted tester. Does not require sign-in.
 * The tester check is one cheap call, made only for a signed-in non-admin when the public flag is off, and a missing function counts as "not a tester".
 */
export async function gateFeature(): Promise<FeatureGate> {
  const { access, account } = await resolveAccess();
  if (access === "hidden") notFound();
  return { access, account };
}

/** The one place the gate's inputs are gathered and the rule applied (shared by gateFeature and myEventsEntry, so they can never disagree). */
async function resolveAccess(): Promise<{ access: "open" | "staff_preview" | "tester" | "hidden"; account: Account | null; inputs: { flag: string | undefined; isStaff: boolean; isTester: boolean } }> {
  const flag = process.env.EVENT_FRONT_DOOR;
  const isStaff = flag === "on" ? false : await isAdmin();
  const account = await getAccount();
  const isTester = flag === "on" || isStaff || !account ? false : await isSubmissionTester(await serverSb());
  return { access: frontDoorAccess({ flag, isStaff, isTester }), account, inputs: { flag, isStaff, isTester } };
}

/**
 * For the account area: props to spread onto the sidebar / overview so "My events & submissions" appears exactly when the page itself would open
 * (flag on, or admin, or allowlisted tester) and only for a signed-in person. Never throws and never 404s: any failure means no link.
 */
export async function myEventsEntry(): Promise<{ myEvents?: true }> {
  try {
    const { account, inputs } = await resolveAccess();
    return myEventsProps(!!account && myEventsEntryVisible(inputs));
  } catch { return {}; }
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
