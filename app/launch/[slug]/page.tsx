import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewConfig } from "@/lib/launch-preview/registry";
import { inviteTableFromEnv, verifyInvite } from "@/lib/launch-preview/invite";
import { readDirectoryFacts } from "@/lib/launch-preview/directory";
import { PreviewPage } from "@/components/launch-preview/PreviewPage";

export const dynamic = "force-dynamic";

/** Never indexed, whatever happens (the response headers say so too — see next.config.ts). */
export const metadata: Metadata = {
  title: "Private preview",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: "no-referrer",
};

/**
 * /launch/{slug}?invite={token} — a private Launch Partner Preview.
 *
 * No valid invitation = no content: a wrong token, a missing token, an expired or revoked one, and an unknown slug all
 * produce the same ordinary 404, so nothing reveals that a preview exists. The token is checked on the server against
 * stored hashes (lib/launch-preview/invite.ts); it is never put in the page.
 */
export default async function LaunchPreview({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const token = Array.isArray(sp.invite) ? sp.invite[0] : sp.invite;
  const cfg = getPreviewConfig(slug);
  const allowed = verifyInvite(inviteTableFromEnv(), slug, token);
  if (!cfg || !allowed) notFound();

  const facts = await readDirectoryFacts(cfg);
  return <PreviewPage cfg={cfg} facts={facts} />;
}
