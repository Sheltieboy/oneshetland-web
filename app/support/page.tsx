import Link from "next/link";
import { L } from "@/components/site/LegalLayout";

export const metadata = {
  title: "Support",
  description: "Get help with OneShetland — payments and refunds, your account, and support for businesses and organisations.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/" className="text-sm font-semibold text-ink-soft hover:text-ink">← OneShetland</Link>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink">Support</h1>
      <p className="mt-3 text-lg text-ink-soft">Need help with OneShetland? We&rsquo;re here to help.</p>

      <div className="mt-8 space-y-8 text-ink-soft">
        <L h="Contact OneShetland">
          <p>
            The quickest way to reach us for anything below is email:{" "}
            <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.
            Tell us what you were trying to do and, if you have one, your account email — it helps us find things faster.
          </p>
        </L>

        <L h="Payments &amp; refunds">
          <p>
            Had a problem with a payment, refund, Wallet transaction, ticket, booking, pass or membership purchase?
            Email <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a> with
            what happened and, where you have them, the date and amount — we&rsquo;ll look into it.
          </p>
          <p>
            What&rsquo;s covered and how refunds work is set out in our{" "}
            <Link href="/terms" className="font-semibold text-ink underline">Terms of Service</Link> (see &ldquo;Payments, fees and refunds&rdquo;),
            and businesses selling on OneShetland also follow our{" "}
            <Link href="/selling-policy" className="font-semibold text-ink underline">Selling policy</Link>.
          </p>
        </L>

        <L h="Account &amp; login help">
          <p>
            Trouble signing in? Use <Link href="/forgot-password" className="font-semibold text-ink underline">Forgot password</Link> from
            the <Link href="/sign-in" className="font-semibold text-ink underline">sign-in page</Link> to reset it. Still stuck, or need help
            with something else on your account — changing your email, or deleting your account — email{" "}
            <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a> from the address
            on your account so we can verify it&rsquo;s you.
          </p>
        </L>

        <L h="Businesses &amp; organisations">
          <p>
            Running a business, hub, event or listing on OneShetland and need help with your account, payouts, or getting set up?
            See <Link href="/business" className="font-semibold text-ink underline">For businesses</Link>, or email us directly at{" "}
            <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a> and we&rsquo;ll help
            you sort it.
          </p>
        </L>

        <L h="Useful links">
          <ul className="ml-5 list-disc space-y-1">
            <li><Link href="/terms" className="font-semibold text-ink underline">Terms of Service</Link></li>
            <li><Link href="/privacy" className="font-semibold text-ink underline">Privacy Policy</Link></li>
            <li><Link href="/selling-policy" className="font-semibold text-ink underline">Selling policy</Link></li>
            <li><Link href="/legal" className="font-semibold text-ink underline">Legal</Link> — everything legal about OneShetland, in one place</li>
          </ul>
        </L>
      </div>
    </div>
  );
}
