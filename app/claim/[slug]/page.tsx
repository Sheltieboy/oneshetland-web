import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAccount } from "@/lib/auth";
import { claimView, openInvitation, recordFetch } from "@/lib/assisted/invites.server";
import { InvitationPage } from "@/components/assisted/InvitationPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "An invitation from OneShetland",
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: "no-referrer",
};

/**
 * /claim/{slug} — the optional invitation to take over a listing or Hub OneShetland made for an
 * organisation.
 *
 * THE TOKEN IS NEVER IN THE ADDRESS HERE. The link we send is /claim/{slug}?invite=<token>; proxy.ts
 * moves the token into an HttpOnly cookie scoped to this one path and redirects to this clean
 * address, so it is not in the address bar, the history, a Referer, analytics, or the sign-in
 * `next=` parameter. Everything below reads the cookie on the server.
 *
 * NOTHING HERE CONSUMES THE INVITATION. Rendering the page counts a FETCH — which may well be an
 * email security scanner prefetching the link rather than a person — and that is all. The invitation
 * binds to somebody only when they are signed in and deliberately send a request, and even then an
 * administrator decides.
 *
 * SIGNED OUT IS A FIRST-CLASS STATE. Somebody should be able to read what we made for them, follow a
 * link to the public page, and say "no thanks", without being made to register.
 */
export default async function ClaimInvitation({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const open = await openInvitation(slug);
  // Every failure — no cookie, wrong token, revoked, superseded, expired, declined — is this one
  // calm page, which distinguishes nothing.
  if (!open) notFound();

  await recordFetch(slug, open.token);

  const account = await getAccount();
  const state = account ? (await claimView(slug, open.token))?.state ?? "open" : null;

  // After signing in, come back HERE. The address carries no token, so the `next=` parameter is safe.
  const signInHref = `/sign-in?next=${encodeURIComponent(`/claim/${slug}`)}`;
  const managePath = state === "owner"
    ? (open.view.kind === "hub"
        ? `/hubs/${open.view.subject.slug ?? ""}/manage`
        : `/business/${open.view.subject.slug ?? ""}/manage`)
    : null;

  return (
    <>
      <InvitationPage
        slug={slug}
        view={open.view}
        state={state}
        signedIn={!!account}
        signInHref={signInHref}
        email={account?.email ?? null}
        defaultName={account?.profile?.full_name ?? ""}
        defaultPhone={account?.profile?.phone ?? ""}
        managePath={managePath}
      />
      <p className="mx-auto max-w-2xl px-4 pb-10 text-center text-xs text-ink-soft sm:px-5">
        This invitation was sent by OneShetland. It is private to whoever received it.{" "}
        <Link href="/privacy" className="underline underline-offset-2">How we handle your details</Link>.
      </p>
    </>
  );
}
