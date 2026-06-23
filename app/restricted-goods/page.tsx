import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Restricted Goods · OneShetland" };

export default function RestrictedGoodsPage() {
  return (
    <LegalLayout title="Restricted goods" updated="June 2026">
      <p>To keep Fetch safe and legal, some items can&rsquo;t be carried by community drivers. This applies to everyone requesting and fulfilling deliveries.</p>

      <L h="Never allowed">
        <ul className="list-disc space-y-1 pl-5">
          <li>Alcohol, tobacco and vapes</li>
          <li>Cash, cheques or other monetary instruments</li>
          <li>Weapons, ammunition, fireworks or explosives</li>
          <li>Illegal drugs or controlled substances</li>
          <li>Hazardous, flammable, corrosive or toxic materials</li>
          <li>Live animals</li>
          <li>Stolen, counterfeit or otherwise unlawful goods</li>
          <li>Anything requiring a licence the driver doesn&rsquo;t hold</li>
        </ul>
      </L>

      <L h="Handle with care">
        <p>Prescription medicines may only be collected through the proper pharmacy process and handed to the named person — drivers must not handle controlled drugs. Chilled, frozen, fragile or high-value items are carried at the customer&rsquo;s own risk; OneShetland can&rsquo;t guarantee their condition in transit.</p>
      </L>

      <L h="No passengers">
        <p>Fetch is for goods only. Drivers must not carry people as part of a Fetch delivery.</p>
      </L>

      <L h="If in doubt">
        <p>Drivers can decline any request they&rsquo;re not comfortable with. Requesting prohibited items may lead to account suspension. Questions? Contact <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.</p>
      </L>
    </LegalLayout>
  );
}
