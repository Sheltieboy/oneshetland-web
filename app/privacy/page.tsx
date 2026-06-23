import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Privacy Policy · OneShetland" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <p>This policy explains how OneShetland handles your personal data. The data controller is Darren Fullerton Consultancy Ltd, trading as OneShetland (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It applies to the OneShetland website and app — one account across both.</p>

      <L h="What we collect">
        <p>Account details (name, email, optional phone); profile details you choose to add; content you post (listings, memories, reviews, applications); transaction records; approximate location when you use location features (e.g. NFC stamps, nearby drivers); and device tokens for push notifications if you enable them. Card and bank details are handled by Stripe — we never see or store full card numbers.</p>
      </L>

      <L h="How we use it">
        <p>To run your account and provide the features you use; to process payments and payouts; to match deliveries, jobs and shifts; to send service messages; and — only if you opt in — occasional news and offers. We keep a record of the terms/privacy version you accepted, as part of our compliance commitments.</p>
      </L>

      <L h="Lawful basis">
        <p>We rely on: performance of a contract (running your account and transactions); legitimate interests (keeping the platform safe and improving it); consent (marketing and push notifications, which you can withdraw anytime); and legal obligation (tax, fraud prevention, Gift Aid records).</p>
      </L>

      <L h="Who we share it with">
        <p>Service providers who help us run OneShetland: <strong>Supabase</strong> (database/hosting), <strong>Stripe</strong> (payments &amp; payouts), <strong>Google Maps</strong> (maps &amp; place search), and <strong>Expo</strong> (push notifications). When you transact with a business, hub or driver, the necessary details are shared with them to fulfil it. We don&rsquo;t sell your data.</p>
      </L>

      <L h="Marketing &amp; notifications">
        <p>Marketing emails are opt-in and every message has an unsubscribe link. Push notifications are controlled per-category in your notification settings, with quiet hours — you decide what you receive.</p>
      </L>

      <L h="Retention">
        <p>We keep your data for as long as your account is active, then only as long as needed for legal, tax and accounting purposes. Compliance and financial records are kept for the period the law requires.</p>
      </L>

      <L h="Your rights">
        <p>Under UK GDPR you can access, correct, delete or port your data, object to or restrict processing, and withdraw consent. To exercise any of these, contact <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>. You can also complain to the Information Commissioner&rsquo;s Office (ico.org.uk).</p>
      </L>

      <L h="Children">
        <p>OneShetland is for users aged 18 and over; we don&rsquo;t knowingly collect data from children.</p>
      </L>

      <L h="Changes">
        <p>We may update this policy; we&rsquo;ll notify you of significant changes in-app or by email.</p>
      </L>
    </LegalLayout>
  );
}
