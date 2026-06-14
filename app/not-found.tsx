import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="eyebrow text-teal">Lost at sea</p>
      <h1 className="mt-3 font-display text-6xl font-bold text-navy">404</h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">
        We couldn&apos;t find that page — it may have drifted, or not been built
        yet. Let&apos;s get you back ashore.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-pill bg-navy px-6 py-3 font-semibold text-paper transition hover:bg-navy-dark"
      >
        Back to home
      </Link>
    </section>
  );
}
