import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { openPrivatePreview, claimView } from "@/lib/launch-preview/invite.server";
import { readDirectoryFacts } from "@/lib/launch-preview/directory";
import { ClaimFlow } from "@/components/launch-preview/ClaimFlow";
import { InviteInactive } from "@/components/launch-preview/InviteInactive";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Claim your business",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: "no-referrer",
};

/**
 * /launch/{slug}/claim — confirm the business and send the claim.
 *
 * Same door as the preview: no valid invitation cookie, no page — the same calm "no longer active" page as every other dead link (app/launch/not-found.tsx).
 * Signed out, the person goes through the
 * ordinary sign-in / create-account flow and comes straight back here — the address they return to carries no token,
 * because the invitation is in the cookie.
 */
export default async function LaunchClaim({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const open = await openPrivatePreview(slug);
  if (!open || open.review) notFound();                                  // not a valid invitation (or a local review): the generic page
  // A VALID invitation whose claiming is not open yet: say so plainly rather than a 404. The holder can already see that on the preview.
  if (open.cfg.claim === "holding") return <InviteInactive variant="not_open" />;

  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(`/launch/${slug}/claim`)}`);

  const view = await claimView(slug, open.token);
  if (!view) notFound();
  const facts = await readDirectoryFacts(open.cfg);

  return (
    <ClaimFlow
      slug={slug} businessId={view.business_id} businessName={facts.name || view.business_name} locality={facts.locality ?? open.cfg.business.locality}
      state={view.state} email={account.email} defaultName={account.profile?.full_name ?? ""} defaultPhone={account.profile?.phone ?? ""}
    />
  );
}
