import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { openPrivatePreview, claimView } from "@/lib/launch-preview/invite.server";
import { readDirectoryFacts } from "@/lib/launch-preview/directory";
import { PreviewPage, type Viewer } from "@/components/launch-preview/PreviewPage";

export const dynamic = "force-dynamic";

/** Never indexed, whatever happens (the response headers say so too — see next.config.ts). */
export const metadata: Metadata = {
  title: "Private preview",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: "no-referrer",
};

/**
 * /launch/{slug} — a private Launch Partner Preview.
 *
 * The invitation arrives as ?invite=<token>; proxy.ts moves it into an HttpOnly cookie and redirects here, so this
 * page never sees it in the address. openPrivatePreview asks the database whether that token is valid for this slug
 * and this business. No valid invitation = no content: no cookie, a wrong, revoked or expired token and an unknown
 * slug all produce the same ordinary 404.
 *
 * The preview itself is the same for everyone who holds the invitation. What changes is the CTA, according to where
 * THEY stand: not signed in, ready to claim, claim sent, owner, or the listing/invitation is already taken.
 */
export default async function LaunchPreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const open = await openPrivatePreview(slug);
  if (!open) notFound();

  const account = await getAccount();
  const view = account ? await claimView(slug, open.token) : null;
  const viewer: Viewer = !account ? { kind: "visitor" } : view ? { kind: view.state, businessId: view.business_id } : { kind: "visitor" };

  const facts = await readDirectoryFacts(open.cfg);
  return <PreviewPage cfg={open.cfg} facts={facts} viewer={viewer} />;
}
