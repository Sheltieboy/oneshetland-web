import Link from "next/link";

/**
 * Shared wrapper for policy/legal pages. Renders a consistent header, a
 * "draft — review before launch" notice, and prose styling. Content is passed
 * as children (server-rendered markup).
 */
export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/" className="text-sm font-semibold text-ink-soft hover:text-ink">← OneShetland</Link>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated {updated}</p>

      <div className="mt-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚠️ <span className="font-semibold">Draft.</span> These terms are a starting point and should be reviewed by a solicitor before launch. Operated by Darren Fullerton Consultancy Ltd, trading as OneShetland.
      </div>

      <div className="legal mt-8 space-y-6 text-ink-soft">{children}</div>

      <div className="mt-12 border-t border-line pt-6 text-sm text-ink-muted">
        <p>Questions? Contact <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.</p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/community-guidelines" className="hover:text-ink">Community guidelines</Link>
          <Link href="/driver-agreement" className="hover:text-ink">Driver agreement</Link>
          <Link href="/restricted-goods" className="hover:text-ink">Restricted goods</Link>
        </nav>
      </div>
    </div>
  );
}

/** Section heading + body helper for consistent spacing. */
export function L({ h, children }: { h: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-ink">{h}</h2>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
