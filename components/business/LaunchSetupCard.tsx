import Link from "next/link";
import type { OwnerLaunch } from "@/lib/launch-partners/owner-setup";
import { BIZ } from "@/lib/business-data";

/**
 * The launch-partner task, at the top of the owner's dashboard. It says what is waiting for THEM and where it is, and shows progress
 * read from the real records (claim, grant, versions) — never typed in. Calm once they have approved.
 */
export function LaunchSetupCard({ launch, href, publicHref, hideCta = false }: { launch: OwnerLaunch; href: string; /** Where the public page is (used once they are live). */ publicHref?: string; /** On the setup page itself the card is a progress summary: no button back to where you already are. */ hideCta?: boolean }) {
  const done = launch.state === "live";
  const calm = done;
  const target = launch.state === "approved" ? `${href}#go-live` : done ? (publicHref ?? href) : href;
  return (
    <section aria-labelledby="launch-setup-h" data-launch-card={launch.state} className={"rounded-card border-2 p-5 shadow-soft sm:p-6 " + (calm ? "border-emerald-300 bg-emerald-50" : "border-violet-300 bg-violet-50")}>
      <p className="eyebrow" style={{ color: BIZ }}>Launch partner</p>
      <h2 id="launch-setup-h" className="mt-1 font-display text-2xl font-bold text-ink">{launch.title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{launch.body}</p>
      <ol className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2" aria-label="Your launch progress">
        {launch.steps.map((s) => (
          <li key={s.label} aria-current={s.state === "current" ? "step" : undefined} className={"flex items-center gap-2 " + (s.state === "todo" ? "text-ink-muted" : s.state === "current" ? "font-bold text-ink" : "text-ink")}>
            <span aria-hidden="true" className={"w-4 shrink-0 text-center font-bold " + (s.state === "done" ? "text-emerald-600" : s.state === "current" ? "text-violet-700" : "text-ink-faint")}>{s.state === "done" ? "✓" : s.state === "current" ? "→" : "○"}</span>
            <span className="sr-only">{s.state === "done" ? "Done: " : s.state === "current" ? "Next: " : "Later: "}</span>{s.label}
          </li>
        ))}
      </ol>
      {!hideCta && <Link href={target} className={"mt-5 inline-block rounded-pill px-6 py-3 text-sm font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 " + (calm ? "border border-line-strong text-ink-soft hover:bg-sand" : "text-white hover:brightness-95")} style={calm ? undefined : { background: BIZ }}>{launch.cta}</Link>}
      {!hideCta && done && <Link href={href} className="mt-5 ml-3 inline-block rounded-pill px-4 py-3 text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink">Edit my launch page</Link>}
    </section>
  );
}
