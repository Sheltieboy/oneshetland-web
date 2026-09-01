import Link from "next/link";
import { BIZ } from "@/lib/business-data";

/**
 * What an owner sees when they open something their plan does not include.
 *
 * The old behaviour was a redirect straight to Billing: you clicked Offers and
 * arrived at a price list, with nothing anywhere saying what an offer is or why
 * you had been moved. This says what the thing does, which plan includes it,
 * and offers a way to the plans — in that order, because an owner cannot judge
 * a price for something nobody has described.
 *
 * Factual, and once. No urgency, no exclamation marks, no comparison table, no
 * "unlock". If somebody does not want offers, the honest answer is that they
 * read a paragraph and leave.
 */
export function CapabilityPaywall({
  capability, plan, what, gets, billingHref, backHref, backLabel, children,
}: {
  capability: string;
  plan: "Pro" | "Premium";
  /** One sentence: what this actually does for the business. */
  what: string;
  /** Two or three concrete things, not adjectives. */
  gets: string[];
  billingHref: string;
  backHref: string;
  backLabel: string;
  /** Anything still permitted without the plan — see the Offers/Loyalty pages. */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-paper p-6 shadow-soft">
        <p className="eyebrow text-ink-muted">{capability}</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">
          {capability} {capability.endsWith("s") ? "are" : "is"} included with {plan}
        </h2>
        <p className="mt-2 max-w-prose text-ink-soft">{what}</p>
        <ul className="mt-4 space-y-1.5">
          {gets.map((g) => (
            <li key={g} className="flex gap-2 text-sm text-ink-soft">
              <span aria-hidden style={{ color: BIZ }}>·</span>{g}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href={billingHref}
            className="rounded-pill px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:brightness-110"
            style={{ background: BIZ }}
          >
            See plans
          </Link>
          <Link href={backHref} className="text-sm font-semibold text-ink-soft hover:text-ink">
            {backLabel}
          </Link>
        </div>
      </section>
      {children}
    </div>
  );
}

/**
 * The same explanation, one line, at the control that is actually blocked —
 * for capabilities an owner may set up before paying. It sits beside the switch
 * rather than replacing the page, because everything else on that page works.
 */
export function PlanNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-xl border border-line bg-sand/40 px-3 py-2 text-sm text-ink-soft">
      {children}
    </p>
  );
}
