import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Terms of Service · OneShetland" };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 2026">
      <p>These terms govern your use of OneShetland (the &ldquo;Service&rdquo;), a platform operated by Darren Fullerton Consultancy Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;), trading as OneShetland. By creating an account or using the Service you agree to these terms. OneShetland is one account across the app and website.</p>

      <L h="1. Your account">
        <p>You must be 18 or over to create an account. You&rsquo;re responsible for keeping your login secure and for activity under your account. Provide accurate information and keep it up to date.</p>
      </L>

      <L h="2. What OneShetland is">
        <p>OneShetland is a community platform connecting Shetland residents, businesses, community groups (&ldquo;hubs&rdquo;) and drivers. We provide the platform; we are not the seller of goods, the provider of services, or the employer of drivers. Transactions are between you and the relevant business, hub or driver.</p>
      </L>

      <L h="3. Payments and fees">
        <p>Payments are processed securely by Stripe; we never store your full card details. By saving a card you authorise charges for the things you buy (deliveries, tickets, memberships, donations, subscriptions and purchases).</p>
        <p>OneShetland charges service fees — for example a per-delivery service fee, a booking fee on tickets, and business subscription fees. Applicable fees are shown before you pay. Businesses and hubs receive their funds through their connected Stripe account.</p>
      </L>

      <L h="4. Business subscriptions">
        <p>Business plans (Pro, Premium and optional add-ons) are recurring monthly subscriptions that renew automatically until cancelled. You can cancel any time from your business dashboard; access continues until the end of the paid period. Fees already paid are non-refundable except where required by law.</p>
      </L>

      <L h="5. Fetch deliveries">
        <p>Fetch connects you with independent local drivers. Drivers are self-employed community members, not our employees or agents. Items are carried at your own risk and we cannot guarantee their condition in transit. Do not request the carriage of prohibited items (see our <a href="/restricted-goods" className="font-semibold text-ink underline">Restricted goods</a> policy). Your card is pre-authorised when a driver accepts and charged on delivery, including any waiting fee shown in the app.</p>
      </L>

      <L h="6. Tickets, memberships, donations and purchases">
        <p>Tickets, memberships, donations and shop/class purchases are sold by the relevant business or hub, not by us. Refunds, cancellations and fulfilment are the responsibility of that business or hub. Contact them first; we can help mediate but are not a party to the sale.</p>
      </L>

      <L h="7. Acceptable use">
        <p>Don&rsquo;t misuse the Service: no unlawful, fraudulent, abusive or harmful activity; no posting of others&rsquo; personal information; no attempts to disrupt or gain unauthorised access. See our <a href="/community-guidelines" className="font-semibold text-ink underline">Community guidelines</a>. We may suspend or remove accounts that breach these terms.</p>
      </L>

      <L h="8. Content you post">
        <p>You keep ownership of content you post (listings, memories, photos, reviews). You grant us a licence to host and display it within the Service. You&rsquo;re responsible for that content and must have the rights to share it. When you accept these terms we keep a record of the version and date.</p>
      </L>

      <L h="9. Liability">
        <p>The Service is provided &ldquo;as is&rdquo;. To the extent permitted by law, we are not liable for the acts of businesses, hubs or drivers, for items carried via Fetch, or for indirect or consequential loss. Nothing here limits liability that cannot be excluded by law (including for death or personal injury caused by negligence, or for fraud).</p>
      </L>

      <L h="10. Changes and governing law">
        <p>We may update these terms; significant changes will be notified in-app or by email. These terms are governed by the laws of Scotland and subject to the exclusive jurisdiction of the Scottish courts.</p>
      </L>
    </LegalLayout>
  );
}
