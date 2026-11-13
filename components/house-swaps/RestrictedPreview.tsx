import Link from "next/link";
import { signInHref } from "@/lib/house-swaps";
import { Panel, SwapsHeader, btnPrimary } from "./Shell";

/** Shown INSTEAD of the House Swaps pages while the service is in private preview and this visitor has not been invited. No data, no counts. */
export function RestrictedPreview({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <SwapsHeader title="House Swaps is in a private preview" />
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Panel>
          <p className="text-base leading-relaxed text-ink-soft">
            House Swaps is a free noticeboard for social-housing tenants. A small group of invited reviewers is trying it out before it opens to everyone.
          </p>
          {signedIn ? (
            <p className="mt-4 text-base leading-relaxed text-ink" role="status">
              Your account hasn&apos;t been given access yet. If you were invited, check you are signed in with the email address the invitation was sent to, and that you have confirmed it.
            </p>
          ) : (
            <>
              <Link href={signInHref("/house-swaps")} className={`${btnPrimary} mt-5`}>Sign in or create your account</Link>
              <p className="mt-3 text-sm text-ink-muted">Use the email address you were invited with.</p>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
