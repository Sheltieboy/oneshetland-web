import Link from "next/link";

/**
 * One calm page for every dead invitation — no cookie, the wrong token, revoked, superseded, expired,
 * declined, or a slug that never existed. It deliberately does not say which, takes no input, and
 * offers no way to try again, so it reveals nothing about whether an invitation exists.
 */
export default function ClaimNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-5 sm:py-24">
      <section className="rounded-[1.5rem] border border-line bg-white p-6 shadow-soft sm:p-9">
        <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
          This invitation link is no longer active
        </h1>
        <div className="mt-4 space-y-3 text-ink-soft">
          <p>It may have run out, or been replaced by a newer one.</p>
          <p>
            Nothing has been lost. If you were expecting to find your organisation here,{" "}
            <Link href="/support" className="font-semibold text-ink underline underline-offset-2">get in touch</Link> and we
            will sort it out.
          </p>
          <p className="pt-2">
            <Link href="/" className="font-semibold text-ink underline underline-offset-2">Go to OneShetland →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
