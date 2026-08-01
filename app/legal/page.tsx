import Link from "next/link";
import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Legal" };

const DOCS = [
  { href: "/terms", title: "Terms of Service", blurb: "The agreement for using OneShetland — accounts, payments, wallet & loyalty, content rules." },
  { href: "/privacy", title: "Privacy Policy", blurb: "What we collect, why, who processes it, and your rights under UK GDPR." },
  { href: "/community-guidelines", title: "Community Guidelines", blurb: "How we keep OneShetland friendly — and what gets content removed." },
  { href: "/restricted-goods", title: "Restricted Goods", blurb: "What can't be sent with Fetch deliveries." },
  { href: "/delete-account", title: "Delete Your Account", blurb: "How to delete your OneShetland account and what happens to your data." },
];

export default function LegalPage() {
  return (
    <LegalLayout title="Legal" updated="August 2026">
      <p>Everything legal about OneShetland, in one place. OneShetland is operated by Darren Fullerton Consultancy Ltd, trading as OneShetland. Questions? <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline">hello@oneshetland.com</a>.</p>

      <ul className="!list-none space-y-3 !pl-0">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className="block rounded-card border border-line bg-white p-4 shadow-soft transition hover:bg-sand">
              <span className="font-display font-bold text-navy">{d.title} →</span>
              <span className="mt-0.5 block text-sm text-ink-soft">{d.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>

      <L h="Data attributions">
        <p>Some of what OneShetland shows builds on open and third-party data, with thanks:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><span className="font-semibold text-ink">Business directory:</span> includes data © <a href="https://www.openstreetmap.org/copyright" className="font-semibold text-ink underline" rel="noreferrer" target="_blank">OpenStreetMap</a> contributors, available under the Open Database Licence (ODbL).</li>
          <li><span className="font-semibold text-ink">Public-sector vacancies:</span> sourced from the employer&rsquo;s public listings via myjobscotland; the source listing always takes precedence.</li>
          <li><span className="font-semibold text-ink">Maps &amp; places:</span> mapping and place data provided by Google Maps.</li>
          <li><span className="font-semibold text-ink">Tides &amp; marine data:</span> where tide times are shown, they are provided via the UK Hydrographic Office&rsquo;s ADMIRALTY APIs; not for navigation.</li>
        </ul>
      </L>
    </LegalLayout>
  );
}
