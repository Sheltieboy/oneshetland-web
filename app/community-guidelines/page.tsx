import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Community Guidelines" };

export default function CommunityGuidelinesPage() {
  return (
    <LegalLayout title="Community guidelines" updated="June 2026">
      <p>OneShetland is built for the islands, by the islands. These guidelines keep it a friendly, useful and safe place for everyone.</p>

      <L h="Be kind and respectful">
        <p>Treat others as you would on a Shetland doorstep. No harassment, hate speech, bullying or threats. Disagree without being disagreeable.</p>
      </L>

      <L h="Be honest">
        <p>Accurate listings, real reviews, genuine memories. Don&rsquo;t impersonate others, post misleading offers, or game leaderboards.</p>
      </L>

      <L h="Respect privacy">
        <p>Don&rsquo;t post other people&rsquo;s personal information — names, addresses, phone numbers, photos — without their consent. This applies to business alerts too: never include a customer&rsquo;s details in a broadcast.</p>
      </L>

      <L h="Keep it legal and safe">
        <p>No illegal goods or services, no fraud, and nothing that puts drivers or members at risk. Deliveries must follow our <a href="/restricted-goods" className="font-semibold text-ink underline">Restricted goods</a> policy.</p>
      </L>

      <L h="Trading fairly">
        <p>Businesses and hubs: honour your offers, deliver what people pay for, and respond to enquiries promptly. Sort refunds and cancellations fairly and quickly.</p>
      </L>

      <L h="Reporting &amp; enforcement">
        <p>If you see something that breaks these guidelines, contact <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>. We may remove content, or suspend or close accounts that break the rules — especially for safety or fraud.</p>
      </L>
    </LegalLayout>
  );
}
