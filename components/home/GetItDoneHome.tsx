import Link from "next/link";

/**
 * Homepage: Get it done. Static on purpose (no data fetch), so it adds nothing to the page's load time.
 * Honest by construction: no counts, no "trades are waiting", no promise that a job is answered.
 */
export function GetItDoneHome() {
  return (
    <section aria-labelledby="gid-home" className="mx-auto max-w-6xl px-5 py-8 sm:py-10" data-get-it-done-home>
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#e9f4ee] via-paper to-paper p-6 shadow-soft sm:p-10">
        <svg aria-hidden="true" viewBox="0 0 120 120" className="pointer-events-none absolute -right-4 -top-4 h-40 w-40 text-[#2a8b5c]/10 sm:h-56 sm:w-56">
          <path fill="currentColor" d="M84 8a28 28 0 0 0-26 38L14 90a10 10 0 0 0 14 14l44-44A28 28 0 0 0 112 36l-18 18-14-4-4-14 18-18A28 28 0 0 0 84 8Z" />
        </svg>
        <p className="eyebrow" style={{ color: "#2a8b5c" }}>Get it done</p>
        <h2 id="gid-home" className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">
          Need a hand getting something done?
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          From a leaky tap to a new fence, tell local tradespeople what you need doing.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/get-it-done" className="inline-flex min-h-[48px] items-center justify-center rounded-pill px-6 py-3 text-base font-bold text-white shadow-soft transition hover:opacity-90" style={{ background: "#2a8b5c" }}>
            Post a job
          </Link>
          <Link href="/get-it-done#for-trades" className="inline-flex min-h-[48px] items-center justify-center rounded-pill border border-navy px-6 py-3 text-base font-bold text-navy transition hover:bg-navy hover:text-paper">
            I&apos;m a tradesperson
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-muted">Free to post. You choose who receives your contact details.</p>
      </div>
    </section>
  );
}
