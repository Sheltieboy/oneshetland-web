import { LegalLayout, L } from "@/components/site/LegalLayout";
import { getAccount } from "@/lib/auth";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delete your account" };

export default async function DeleteAccountPage() {
  const account = await getAccount();
  return (
    <LegalLayout title="Delete your account" updated="July 2026">
      <p>You can delete your OneShetland account and personal data at any time — right here on the web, or from inside the app. This page explains how, what we remove, and what we have to keep. You have one account across the app and website.</p>

      <L h="Delete your account now">
        <p>Signed in? You can delete your account straight from this page:</p>
        <div className="not-prose my-4"><DeleteAccountForm isLoggedIn={!!account} /></div>
        <p>Your account and personal data are deleted straight away, subject to the limited records we&rsquo;re required to keep (see below). This action can&rsquo;t be undone. You can also do this from the app under <span className="font-semibold text-ink">Account → Delete account</span>.</p>
      </L>

      <L h="What we delete">
        <p>When you delete your account we permanently remove:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>your profile and account details (name, contact details, location area, login);</li>
          <li>content you&rsquo;ve posted — listings, reviews, events, memories, photos, messages, comments and hub posts;</li>
          <li>your saved cards and connection to Stripe (card details are held by Stripe, not us);</li>
          <li>your preferences, saved items, follows and notification settings;</li>
          <li>your driver profile, if you&rsquo;re a Fetch driver.</li>
        </ul>
      </L>

      <L h="What we keep, and why">
        <p>For legal, accounting and fraud-prevention reasons we retain a limited set of records after deletion, in <span className="font-semibold text-ink">anonymised</span> form wherever possible:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><span className="font-semibold text-ink">Order and payment records</span> for deliveries, bookings, tickets and purchases — kept as anonymised transaction records for tax and accounting (UK law generally requires financial records to be kept for around six years). These are detached from your identity.</li>
          <li><span className="font-semibold text-ink">Compliance and safety records</span> — for example a record that an account was removed for breaching our terms — kept where needed to protect the community.</li>
        </ul>
        <p>Payment data held by Stripe is governed by Stripe&rsquo;s own retention rules. We never store your full card details.</p>
      </L>

      <L h="Can&rsquo;t access the app?">
        <p>If you can&rsquo;t sign in or no longer have the app installed, you can still ask us to delete your account. Email <a href="mailto:support@oneshetland.com" className="font-semibold text-ink underline">support@oneshetland.com</a> from the email address linked to your account, with the subject &ldquo;<span className="font-semibold text-ink">Delete my account</span>&rdquo;. Tell us the name and email (and, if you can, the phone number) on the account so we can verify it&rsquo;s you.</p>
        <p>We&rsquo;ll confirm and complete your request within 30 days, and usually much sooner. We may need to verify your identity before deleting an account to protect against fraudulent requests.</p>
      </L>

      <L h="Questions">
        <p>If you&rsquo;re unsure about anything, email <a href="mailto:support@oneshetland.com" className="font-semibold text-ink underline">support@oneshetland.com</a>. For more on how we handle your data, see our <a href="/privacy" className="font-semibold text-ink underline">Privacy policy</a>.</p>
      </L>
    </LegalLayout>
  );
}
