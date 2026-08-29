import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 2026">
      <p>This policy explains how OneShetland handles your personal data. The data controller is Darren Fullerton Consultancy Ltd, trading as OneShetland (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It applies to the OneShetland website and app — one account across both.</p>

      <L h="What we collect">
        <p>Account details (name, email, optional phone); profile details you choose to add; content you post (listings, events, stories, reviews, photos, voice recordings, applications); transaction records including wallet top-ups, payments, loyalty stamps, points and reward redemptions; approximate location when you use location features (e.g. NFC stamps, nearby drivers); device tokens for push notifications if you enable them; and — only if you consent — anonymised usage analytics (see below). Card and bank details are handled by Stripe — we never see or store full card numbers.</p>
      </L>

      <L h="How we use it">
        <p>To run your account and provide the features you use; to process payments, wallet transactions and payouts; to operate loyalty stamps, points and rewards with participating businesses; to match deliveries, jobs and shifts; to send service messages; and — only if you opt in — occasional news and offers. We keep a record of the terms/privacy version you accepted, as part of our compliance commitments.</p>
      </L>

      <L h="Analytics &amp; cookies">
        <p>We run our own privacy-respecting analytics — <strong>there are no third-party advertising trackers on OneShetland</strong>, and nothing here is used to build an advertising profile of you.</p>

        <p><strong>Our analytics is opt-in.</strong> On the website it only runs <em>if you accept it</em> in the consent banner. Until you accept, <strong>no analytics identifier is created at all</strong> — nothing is stored in your browser and nothing is sent. If you decline, it stays off. When you do accept, it records product events (like &ldquo;viewed an event&rdquo;) against a random identifier, not your name. We also count clicks on our social-media short links (oneshetland.com/go/&hellip;) anonymously — no cookie is set and no profile is built.</p>

        <p><strong>Storage we need to run the site.</strong> Separately from analytics, your browser stores a few things so OneShetland works: your sign-in session; your answer to the analytics banner (so we stop asking); and things you set up yourself, such as a shopping basket or a saved preference. None of this is used for advertising profiling.</p>

        <p><strong>Payments (Stripe).</strong> Card payments are handled by <a href="https://stripe.com/gb" target="_blank" rel="noreferrer" className="font-semibold text-ink underline">Stripe</a>. Stripe&rsquo;s payment scripts load <strong>only on pages where you are actually paying or managing a saved card</strong> — not on ordinary content pages like the homepage, Directory or What&rsquo;s On. On those payment pages, Stripe may collect transactional information and device-identifying information using cookies and similar technologies. Stripe uses this to process the payment, to authenticate you, for fraud and loss prevention, and to analyse the performance of its own services.</p>

        <p>The Stripe cookies we currently see in our integration are:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><code>__stripe_mid</code> — set by Stripe, for fraud prevention. Lasts approximately one year.</li>
          <li><code>__stripe_sid</code> — set by Stripe, for fraud prevention. Lasts approximately 30 minutes.</li>
        </ul>
        <p>Those are the ones we observe today; Stripe may use others as its own services change, and Stripe describes its own use in full at the links below. These are payment-security cookies, not advertising cookies, and they are <strong>separate from your analytics choice</strong> — the analytics banner controls our optional analytics, and does not switch off the storage needed to sign you in or to take a payment securely.</p>

        <p>For Stripe&rsquo;s own explanation, see the{" "}
          <a href="https://stripe.com/legal/privacy-center" target="_blank" rel="noreferrer" className="font-semibold text-ink underline">Stripe Privacy Centre</a>{" "}and{" "}
          <a href="https://stripe.com/cookie-settings" target="_blank" rel="noreferrer" className="font-semibold text-ink underline">Stripe&rsquo;s cookie information</a>.{" "}
          <strong>OneShetland never receives or stores your full card details.</strong></p>
      </L>

      <L h="AI features (Peerie Bot)">
        <p>Some features are assisted by AI — for example Peerie Bot turning a plain-English description into an event listing, drafting content, or transcribing a voice recording you upload to Aald Memories. To provide these, the text or audio you submit is processed by our AI providers (<strong>Anthropic</strong> for text, <strong>OpenAI</strong> for audio transcription) on our instructions. We don&rsquo;t permit these providers to use your content to train their models. AI features only process what you choose to give them.</p>
      </L>

      <L h="Business listings">
        <p>The Directory includes listings for Shetland businesses compiled from publicly available sources (such as OpenStreetMap and businesses&rsquo; own public listings), so the Directory is useful to the community from day one. Where a listing relates to a sole trader, that information can be personal data — we publish it on the basis of legitimate interests. If a listing is about your business you can claim it for free and correct it, or ask us to amend or remove it at <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.</p>
      </L>

      <L h="Lawful basis">
        <p>We rely on: performance of a contract (running your account and transactions); legitimate interests (keeping the platform safe and improving it, and publishing business directory information); consent (marketing, push notifications and website analytics, each of which you can withdraw anytime); and legal obligation (tax, fraud prevention, Gift Aid records).</p>
      </L>

      <L h="Who we share it with">
        <p>Service providers who help us run OneShetland: <strong>Supabase</strong> (database &amp; hosting), <strong>Netlify</strong> (website hosting), <strong>Stripe</strong> (payments &amp; payouts), <strong>Postmark</strong> (email delivery), <strong>Expo</strong> (push notifications), <strong>Google Maps</strong> (maps &amp; place search), <strong>Anthropic</strong> and <strong>OpenAI</strong> (AI features, as described above). When you transact with a business, hub or driver, the necessary details are shared with them to fulfil it. Content you choose to publish publicly (for example an event) may also be featured on OneShetland&rsquo;s official social media pages to promote it to the community. We don&rsquo;t sell your data.</p>
      </L>

      <L h="International transfers">
        <p>Some providers process data outside the UK (for example in the EU or US). Where they do, transfers are protected by appropriate safeguards such as the UK&rsquo;s data-bridge arrangements or standard contractual clauses.</p>
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
