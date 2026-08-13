import Link from "next/link";

export const metadata = {
  title: "Soft launch — what that means for you",
  description:
    "OneShetland is new. Here's exactly what might go wrong, what can't, and how your money and information are looked after.",
};

/**
 * ⚠️ SET THIS BEFORE GOING LIVE.
 * Every "tell me" route on this page points at it. An address that bounces is
 * worse than no address at all — it turns an honest page into a broken promise.
 */
const CONTACT_EMAIL = "hello@oneshetland.com";

const NAVY = "#032f4c";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-lg text-ink-soft">{children}</div>
    </section>
  );
}

function Point({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <li className="rounded-card border border-line bg-paper p-5 shadow-soft">
      <h3 className="font-display text-lg font-bold text-ink">{heading}</h3>
      <p className="mt-1.5 text-ink-soft">{children}</p>
    </li>
  );
}

export default function SoftLaunchPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">OneShetland</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-ink sm:text-5xl">
        We&apos;re in soft launch
      </h1>
      <p className="mt-4 text-xl text-ink-soft">
        Which is a polite way of saying: this is real, it&apos;s open, and it&apos;s new. Here
        is exactly what that means — including the parts I&apos;d rather not have to write.
      </p>

      <Section title="What a soft launch actually means here">
        <p>
          OneShetland has been built over the past few months and tested as thoroughly as one
          person can test something this size. It is now open to everybody rather than to a
          handful of people I know.
        </p>
        <p>
          I haven&apos;t bought billboards or done a big launch, because I&apos;d rather find
          the rough edges with fifty people than with five thousand. If you&apos;re reading
          this, you&apos;re early — and early means you&apos;ll see things that later users
          won&apos;t.
        </p>
      </Section>

      <Section title="What might go wrong">
        <p>Being straight with you, because a vague warning is no warning at all:</p>
        <ul className="mt-2 space-y-2 text-ink-soft">
          <li>• A page might throw an error, especially somewhere I haven&apos;t been myself.</li>
          <li>• A button might not do what it says, or might do nothing at all.</li>
          <li>• Something might look squint on your particular phone.</li>
          <li>• A listing might be out of date, incomplete, or in the wrong category.</li>
          <li>• An email might arrive late, twice, or not at all.</li>
          <li>
            • A feature might behave oddly in a situation I never thought to try — the second
            time you do something, on a slow connection, halfway through a ferry crossing.
          </li>
        </ul>
        <p className="mt-3">
          None of that is fine, and I want to hear about all of it. But it&apos;s the honest
          shape of a new thing.
        </p>
      </Section>

      <Section title="What can't go wrong — and why">
        <p>
          Here&apos;s the important bit, and the reason I can say it with a straight face:{" "}
          <strong className="font-semibold text-ink">
            your money and your information don&apos;t depend on my code being perfect.
          </strong>{" "}
          They&apos;re not handled by the part of the system that might have a bug in it.
        </p>
      </Section>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        <Point heading="Your card details never reach me">
          When you add a card, you&apos;re typing it into Stripe — the company that processes
          payments for millions of businesses worldwide. It goes from your browser to them. It
          never passes through OneShetland, and it isn&apos;t stored here. All I can see is the
          last four digits and the expiry date, the same as on a shop receipt.
        </Point>
        <Point heading="Your bank details never reach me either">
          If you connect a bank account to get paid, Stripe run that too, including the identity
          checks the law requires of anyone receiving money. Your account number goes to them. I
          see whether you&apos;re verified — nothing more.
        </Point>
        <Point heading="Nothing is charged without you choosing it">
          Adding a card doesn&apos;t start a subscription and doesn&apos;t authorise anything.
          It sits there unused until you buy something specific. You can remove it in one click.
        </Point>
        <Point heading="Your data is protected underneath the website">
          Who is allowed to see what is enforced by the database itself, on every single table —
          not by the page you happen to be looking at. That matters: it means even a page with a
          bug in it cannot show someone else your private details, because the rule is applied
          below the level where the bug would be.
        </Point>
        <Point heading="You can delete everything yourself">
          Not by emailing me and waiting. There&apos;s a{" "}
          <Link
            href="/delete-account"
            className="font-semibold text-navy underline underline-offset-2"
          >
            delete account
          </Link>{" "}
          button in your settings that removes your account and your data. It&apos;s your
          information, and you shouldn&apos;t have to ask permission to take it back.
        </Point>
        <Point heading="You're not being tracked">
          There are no advertising trackers on OneShetland — no Google Analytics, no Facebook
          pixel, nothing sold on to anybody. The only measurement is my own, it asks your
          permission first, and it deliberately strips out anything personal. See the{" "}
          <Link href="/privacy" className="font-semibold text-navy underline underline-offset-2">
            privacy policy
          </Link>
          .
        </Point>
      </ul>

      <Section title="If something does go wrong with money">
        <p
          className="rounded-card border-l-4 bg-sand px-5 py-4 text-ink"
          style={{ borderLeftColor: NAVY }}
        >
          <strong className="font-semibold">I&apos;ll refund it first and investigate after.</strong>{" "}
          You will not be put through a claims process, asked for evidence, or left arguing with
          a form while you&apos;re out of pocket. If a payment goes wrong on a platform this new,
          that&apos;s my problem to fix, not yours to prove.
        </p>
      </Section>

      <Section title="If you're thinking about adding your business">
        <p>
          Fair question to ask what you&apos;re signing up to. The short answer is: very little,
          deliberately.
        </p>
        <ul className="mt-2 space-y-2 text-ink-soft">
          <li>
            • <strong className="font-semibold text-ink">Being listed is free</strong>, and stays
            free. The paid extras are opt-in and clearly priced.
          </li>
          <li>
            • <strong className="font-semibold text-ink">Your listing stays yours.</strong> Edit
            it, hide it or delete it whenever you like — no notice period, no cancellation phone
            call, no talking to anybody.
          </li>
          <li>
            • <strong className="font-semibold text-ink">You don&apos;t need to add a card or a
            bank account</strong> to be listed. Those only come into it if you decide to sell or
            take payments through OneShetland.
          </li>
          <li>
            • <strong className="font-semibold text-ink">Your customer information is yours.</strong>{" "}
            It isn&apos;t sold, shared, or used to market to your customers on anyone else&apos;s
            behalf.
          </li>
        </ul>
        <p className="mt-3">
          If your business is already in the directory, that&apos;s because it was gathered from
          public sources so the directory wasn&apos;t empty on day one. Claiming it means you
          take control of it — and if you&apos;d rather it wasn&apos;t there at all, tell me and
          I&apos;ll remove it. No argument.
        </p>
      </Section>

      <Section title="Tell me when something's wrong">
        <p>
          Genuinely — this is the most useful thing you can do right now, and it&apos;s worth
          more to me than a compliment. If something breaks, looks wrong, or just annoys you,
          email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-navy underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          Tell me roughly what you were doing and what happened. A screenshot helps. You
          won&apos;t get an automated reply — you&apos;ll get me.
        </p>
      </Section>

      <div className="mt-12 rounded-card border border-line bg-paper p-6 shadow-soft">
        <p className="text-lg text-ink-soft">
          OneShetland is built and run by one person, here in Shetland. That&apos;s the reason
          there might be a bug — and also the reason there&apos;s somebody who&apos;ll actually
          answer when you find one.
        </p>
        <p className="mt-3 font-display text-lg font-bold text-ink">Darren Fullerton</p>
        <p className="text-sm text-ink-muted">Roadside, Hamnavoe, Burra, Shetland</p>
      </div>

      <p className="mt-8 text-center text-sm text-ink-faint">
        <Link href="/terms" className="font-semibold hover:text-ink">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="font-semibold hover:text-ink">
          Privacy
        </Link>
        {" · "}
        <Link href="/community-guidelines" className="font-semibold hover:text-ink">
          Community guidelines
        </Link>
      </p>
    </div>
  );
}
