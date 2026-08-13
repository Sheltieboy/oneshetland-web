import Link from "next/link";

/**
 * The soft-launch notice.
 *
 * WHY IT READS THE WAY IT DOES — worth keeping in mind before editing the copy.
 *
 * The instinct with a soft launch is to hedge everything: "there may be bugs,
 * please bear with us". That reads as "we don't know what state this is in",
 * and it makes people nervous about exactly the things they should feel safest
 * about — their card, their bank details, their business.
 *
 * So this notice does one job: it separates two things that are genuinely
 * separate. The FEATURES are new and might misbehave. The MONEY and the DATA
 * do not depend on the features being perfect, because they aren't handled by
 * this code — Stripe holds the card details, and the database enforces who can
 * see what regardless of what any page does.
 *
 * Every claim below is specific and checkable. Vagueness is what costs trust;
 * precision is what earns it. Don't soften these into generalities, and don't
 * add a claim here that isn't true of the actual system.
 */

type Variant = "full" | "compact" | "business";

export function SoftLaunchNotice({
  variant = "full",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p className={`text-sm text-ink-muted ${className}`}>
        <span className="font-semibold text-ink">OneShetland is in soft launch.</span>{" "}
        It&apos;s new, so you may hit a rough edge — but your card details never reach us
        and your data is locked down at the database, not by the page you&apos;re looking
        at.{" "}
        <Link href="/soft-launch" className="font-semibold text-navy underline underline-offset-2">
          How that works
        </Link>
      </p>
    );
  }

  return (
    <section
      className={`rounded-card border border-line bg-paper p-5 shadow-soft sm:p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-base"
        >
          🌱
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink">
            OneShetland is in soft launch
          </h2>

          <p className="mt-2 text-ink-soft">
            It&apos;s open and it&apos;s real — but it&apos;s new. I&apos;ve tested
            everything I can think of, and I&apos;ll still have missed things. You might
            find a page that errors, a button that does nothing, or something that looks
            squint on your phone. If you do, tell me and I&apos;ll fix it.
          </p>

          <p className="mt-4 font-semibold text-ink">
            What that doesn&apos;t affect is your money or your information.
          </p>
          <p className="mt-1 text-ink-soft">
            Those don&apos;t rely on my code being perfect, because they aren&apos;t
            handled by my code:
          </p>

          <ul className="mt-3 space-y-2.5 text-ink-soft">
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span>
                <strong className="font-semibold text-ink">
                  Your card details never reach OneShetland.
                </strong>{" "}
                You type them straight into Stripe, who handle payments for millions of
                businesses worldwide. All I ever see is the last four digits and the
                expiry — the same as a shop receipt.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span>
                <strong className="font-semibold text-ink">
                  Bank details for payouts go straight to Stripe too.
                </strong>{" "}
                They run their own identity checks and hold the account number. I never
                see it.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span>
                <strong className="font-semibold text-ink">
                  Who can see your information is enforced by the database itself
                </strong>{" "}
                — not by the page you&apos;re looking at. So even a page with a bug in it
                can&apos;t show someone else your private details. That rule is applied
                underneath everything, on every table.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span>
                <strong className="font-semibold text-ink">
                  You can delete your account and everything in it yourself
                </strong>
                , whenever you like, from your account settings. You don&apos;t have to
                ask me.
              </span>
            </li>
          </ul>

          {variant === "business" && (
            <>
              <p className="mt-5 font-semibold text-ink">
                And adding your business doesn&apos;t tie you to anything.
              </p>
              <ul className="mt-3 space-y-2.5 text-ink-soft">
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-local" />
                  <span>
                    Being listed is <strong className="font-semibold text-ink">free</strong>,
                    and nothing starts charging you unless you choose to add something paid.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-local" />
                  <span>
                    Your listing stays yours. Edit it, hide it or remove it at any time —
                    no notice period, no phone call to cancel.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-local" />
                  <span>
                    You don&apos;t need to add a card or a bank account to be listed. Those
                    are only for if you want to sell or get paid through OneShetland.
                  </span>
                </li>
              </ul>
            </>
          )}

          <p className="mt-5 rounded-xl bg-sand px-4 py-3 text-ink-soft">
            <strong className="font-semibold text-ink">
              If something does go wrong with a payment, I&apos;ll sort it.
            </strong>{" "}
            Refund first, work out what happened afterwards. You won&apos;t be left arguing
            with a form.
          </p>

          <p className="mt-4 text-sm text-ink-muted">
            Darren Fullerton · Hamnavoe, Burra ·{" "}
            <Link href="/soft-launch" className="font-semibold text-navy underline underline-offset-2">
              Read the full detail
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
