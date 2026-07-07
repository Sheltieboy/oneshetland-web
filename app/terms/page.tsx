import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Terms of Service · OneShetland" };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 2026">
      <p>These terms govern your use of OneShetland (the &ldquo;Service&rdquo;), a Shetland community platform operated by Darren Fullerton Consultancy Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), trading as OneShetland. OneShetland brings together a local business directory, events and what&rsquo;s-on, Fetch deliveries, bookings, jobs and shifts, community hubs, memories, boats and local payments. By creating an account or using the Service you agree to these terms. You have one OneShetland account across the app and website.</p>

      <L h="1. Accepting these terms">
        <p>By creating an account, signing in or otherwise using the Service you confirm you have read, understood and agree to these terms and to our <a href="/privacy" className="font-semibold text-ink underline">Privacy policy</a> and <a href="/community-guidelines" className="font-semibold text-ink underline">Community guidelines</a>. If you don&rsquo;t agree, please don&rsquo;t use the Service. When you accept these terms we keep a record of the version and date.</p>
      </L>

      <L h="2. Eligibility">
        <p>You must be 18 or over to create an account and use the Service. By using OneShetland you confirm that you are at least 18 years old. We may suspend or remove accounts where we have reason to believe a user is under 18.</p>
      </L>

      <L h="3. Your account">
        <p>You&rsquo;re responsible for keeping your login secure and for all activity under your account. Provide accurate information and keep it up to date. Don&rsquo;t share your account or impersonate anyone else. Tell us promptly if you think your account has been compromised.</p>
      </L>

      <L h="4. What OneShetland is">
        <p>OneShetland is a community platform connecting Shetland residents, businesses, community groups (&ldquo;hubs&rdquo;) and drivers. We provide the platform; we are not the seller of goods, the provider of services, or the employer of drivers. Transactions — deliveries, bookings, tickets, jobs and shifts, purchases — are between you and the relevant business, hub, driver or other user.</p>
      </L>

      <L h="5. Acceptable use">
        <p>Use OneShetland lawfully and respectfully. You must not:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>do anything unlawful, fraudulent, abusive, threatening, harassing or harmful;</li>
          <li>post or share content that is objectionable — hateful, defamatory, obscene, sexually explicit, violent, or that demeans or targets any person or group;</li>
          <li>harass, bully, threaten, stalk or impersonate other users, drivers, businesses or staff;</li>
          <li>post other people&rsquo;s personal information without consent, or spam, scam or mislead;</li>
          <li>attempt to disrupt the Service or gain unauthorised access to it or to other accounts.</li>
        </ul>
        <p>See our <a href="/community-guidelines" className="font-semibold text-ink underline">Community guidelines</a> for the full picture. We may suspend or remove accounts that breach these terms.</p>
      </L>

      <L h="6. User-generated content — our zero-tolerance policy">
        <p>Parts of OneShetland let you post content — listings, reviews, events, memories, photos, messages, comments, hub posts and profile information (&ldquo;user content&rdquo;). You keep ownership of your user content and grant us a worldwide, royalty-free licence to host, store and display it within the Service so we can run the platform. You&rsquo;re responsible for what you post and must have the rights to share it.</p>
        <div className="rounded-card border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">
          <p className="font-semibold">There is zero tolerance for objectionable content and abusive behaviour on OneShetland.</p>
          <p className="mt-1">Objectionable content and abusive users are not welcome here. If you post objectionable content — including content that is hateful, harassing, threatening, defamatory, obscene, sexually explicit or otherwise abusive — or behave abusively towards other users, your content will be removed and your account may be suspended or permanently removed.</p>
        </div>
        <p className="font-semibold text-ink">Reporting and blocking.</p>
        <p>Every piece of user content and every user profile can be reported and blocked from within the app. To report content or a user, use the &ldquo;Report&rdquo; option on the post, message or profile; to block someone, use &ldquo;Block&rdquo; on their profile — blocking hides their content from you and prevents them contacting you.</p>
        <p className="font-semibold text-ink">Our commitment.</p>
        <p>We review every report and act on objectionable content and abusive users — by removing the content and/or removing the user — within 24 hours of the report being made. You can also email us at <a href="mailto:support@oneshetland.com" className="font-semibold text-ink underline">support@oneshetland.com</a>. We may remove content or accounts at our discretion to keep the community safe.</p>
      </L>

      <L h="7. Payments, fees and refunds">
        <p>Payments are processed securely by Stripe; we never store your full card details. By saving a card you authorise charges for the things you buy (deliveries, tickets, memberships, bookings, donations, subscriptions and purchases). OneShetland charges service fees — for example a per-delivery service fee, a booking fee on tickets, and business subscription fees. Applicable fees are shown before you pay. Businesses and hubs receive their funds through their connected Stripe account.</p>
        <p>Business plans and add-ons are recurring monthly subscriptions that renew automatically until cancelled. You can cancel any time from your business dashboard; access continues until the end of the paid period. Fees already paid are non-refundable except where required by law.</p>
        <p>Tickets, memberships, bookings, donations and shop/class purchases are sold by the relevant business or hub, not by us. Refunds, cancellations and fulfilment are the responsibility of that business or hub — contact them first. We can help mediate but are not a party to the sale.</p>
      </L>

      <L h="8. Fetch deliveries">
        <p>Fetch connects you with independent local drivers, who are self-employed community members, not our employees or agents. Items are carried at your own risk and we cannot guarantee their condition in transit. Do not request the carriage of prohibited items (see our <a href="/restricted-goods" className="font-semibold text-ink underline">Restricted goods</a> policy). Your card is pre-authorised when a driver accepts and charged on delivery, including any waiting fee shown in the app.</p>
      </L>

      <L h="9. Third-party services">
        <p>The Service relies on third parties including Stripe (payments), Supabase (hosting and data) and mapping providers. Your use of those features is also subject to their terms. We&rsquo;re not responsible for third-party services we don&rsquo;t control, though we choose our providers carefully.</p>
      </L>

      <L h="10. Liability">
        <p>The Service is provided &ldquo;as is&rdquo;. To the extent permitted by law, we are not liable for the acts of businesses, hubs, drivers or other users, for items carried via Fetch, or for indirect or consequential loss. Nothing here limits liability that cannot be excluded by law (including for death or personal injury caused by negligence, or for fraud).</p>
      </L>

      <L h="11. Termination and deleting your account">
        <p>You can stop using OneShetland at any time. You can delete your account from within the app at <span className="font-semibold text-ink">Account → Delete account</span>, or see our <a href="/delete-account" className="font-semibold text-ink underline">Delete your account</a> page. Deleting your account removes your profile and personal content; some records (such as anonymised order and payment records) are retained where the law requires. We may suspend or terminate your account if you breach these terms or to protect the community.</p>
      </L>

      <L h="12. Changes and governing law">
        <p>We may update these terms; significant changes will be notified in-app or by email. These terms are governed by the laws of Scotland and subject to the exclusive jurisdiction of the Scottish courts.</p>
      </L>

      <L h="13. Contact">
        <p>Questions about these terms? Email <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>. To report content or abuse, use the in-app Report option or email <a href="mailto:support@oneshetland.com" className="font-semibold text-ink underline">support@oneshetland.com</a>.</p>
      </L>
    </LegalLayout>
  );
}
