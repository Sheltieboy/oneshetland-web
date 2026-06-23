import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Driver Agreement · OneShetland" };

export default function DriverAgreementPage() {
  return (
    <LegalLayout title="Fetch driver agreement" updated="June 2026">
      <p>This agreement sets out the terms for driving with Fetch, OneShetland&rsquo;s community delivery service operated by Darren Fullerton Consultancy Ltd, trading as OneShetland. By applying to drive, you accept these terms.</p>

      <L h="1. Your status">
        <p>You are an independent, self-employed individual — not an employee, worker or agent of OneShetland. You decide when, whether and where you drive. You&rsquo;re responsible for your own tax and National Insurance.</p>
      </L>

      <L h="2. Eligibility">
        <p>You confirm that you hold a valid UK driving licence, have a roadworthy vehicle, and hold appropriate motor insurance that covers carrying goods for delivery (&ldquo;hire and reward&rdquo; / business use as relevant). You must keep these valid for as long as you drive, and provide proof on request. You must be legally entitled to work in the UK.</p>
      </L>

      <L h="3. How it works">
        <p>You create runs and accept delivery requests in the app. When you accept, the customer&rsquo;s card is pre-authorised. You collect the item, mark it collected, deliver it, and mark it delivered — at which point payment is captured.</p>
      </L>

      <L h="4. Payment">
        <p>You receive the delivery fee for each completed delivery, less OneShetland&rsquo;s service fee (currently £1.50 per delivery) and card-processing costs. Payouts are made to your connected Stripe account, typically within a few working days. You&rsquo;re responsible for declaring this income.</p>
      </L>

      <L h="5. What you can carry">
        <p>Only goods permitted under our <a href="/restricted-goods" className="font-semibold text-ink underline">Restricted goods</a> policy. Never carry alcohol, tobacco, vapes, prescription-only medicines outside the proper process, cash, hazardous items, or passengers. If you&rsquo;re unsure, don&rsquo;t carry it.</p>
      </L>

      <L h="6. Conduct &amp; safety">
        <p>Drive safely and legally — never use the app while driving. Be courteous to customers and shops. Handle items with care. Follow all road traffic and food-safety rules where relevant. Your safety comes first; don&rsquo;t take a delivery you&rsquo;re not comfortable with.</p>
      </L>

      <L h="7. Liability">
        <p>You are responsible for the items in your care between collection and delivery, and for your own conduct and driving. OneShetland is a platform connecting you with customers and is not liable for your acts or omissions. Nothing here excludes liability that cannot be excluded by law.</p>
      </L>

      <L h="8. Suspension">
        <p>We may suspend or remove driver access for safety concerns, repeated complaints, fraud, or breach of this agreement or the law.</p>
      </L>

      <L h="9. Governing law">
        <p>This agreement is governed by the laws of Scotland.</p>
      </L>
    </LegalLayout>
  );
}
