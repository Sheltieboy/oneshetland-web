import Link from "next/link";
import { LegalLayout, L } from "@/components/site/LegalLayout";

export const metadata = { title: "Selling on OneShetland" };

/**
 * /selling-policy — what a business may commercially offer here.
 *
 * Deliberately separate from two things it is often confused with:
 *
 *   /terms §11        what a business selling here is RESPONSIBLE for. That
 *                     document is accepted per version and enforced in the
 *                     database, so it must not change to publish this. It
 *                     already says offerings must follow "any policy we publish
 *                     for the feature you're using" — this is that policy, and
 *                     it is incorporated without the Terms moving.
 *
 *   /restricted-goods what a community driver may CARRY through Fetch. Selling
 *                     something here and Fetch being able to deliver it are two
 *                     different questions, and conflating them would both ban
 *                     ordinary retail and let unsuitable things into a car.
 *
 * Dated only — no version number, no acceptance record. Categories will be
 * revised as decisions are made, and a numbered version tied to acceptance
 * would lock every business out of commercial writes until they re-accepted.
 */
export default function SellingPolicyPage() {
  return (
    <LegalLayout title="Selling on OneShetland — what you may offer" updated="August 2026">
      <p>
        This policy applies when a business uses OneShetland to advertise, sell, book or otherwise
        commercially offer something to customers — products in the Shop, services and appointments,
        passes and packs, tickets to its events, offers, and similar commercial listings.
      </p>

      <p>
        It does not apply to having a Directory listing. A business is welcome to be listed, keep its
        details right and be found, without selling anything through OneShetland and without taking on
        any of the responsibilities below.
      </p>

      <p>
        It sits alongside our{" "}
        <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">Terms</Link>;
        section 11 of the Terms covers what a business selling here is responsible for generally.
      </p>

      <L h="The basic rule">
        <p>Only offer something that:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>is lawful;</li>
          <li>you&rsquo;re entitled to supply;</li>
          <li>you&rsquo;ve described accurately;</li>
          <li>you can supply safely and properly;</li>
          <li>follows this policy and any other rules we publish for the feature you&rsquo;re using.</li>
        </ul>
        <p>
          If you&rsquo;re not sure whether something belongs on OneShetland, ask us before you list it.
          We&rsquo;d far rather answer a question than take a listing down.
        </p>
      </L>

      <L h="Not permitted on OneShetland">
        <p>We don&rsquo;t allow these to be offered here, whatever the circumstances:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>illegal drugs, controlled substances, and things sold for taking them</li>
          <li>firearms, ammunition and explosives</li>
          <li>stolen goods, and goods you can&rsquo;t show you&rsquo;re entitled to sell</li>
          <li>counterfeit goods, fakes, and copies passed off as something they aren&rsquo;t</li>
          <li>protected wildlife, or specimens and parts whose sale isn&rsquo;t permitted</li>
          <li>human remains, body parts or bodily materials</li>
          <li>adult and sexual products</li>
          <li>anything whose sale is itself an offence</li>
        </ul>
        <p>
          Some of these are matters of law and some are simply our choice for a local island
          marketplace. Either way, the answer here is no.
        </p>
      </L>

      <L h="Age-restricted goods">
        <p>
          For now, we don&rsquo;t allow age-restricted goods to be sold through OneShetland — alcohol,
          tobacco, vapes and nicotine products, knives and bladed items, and fireworks. This isn&rsquo;t
          a judgement about your business; it&rsquo;s because we don&rsquo;t yet have a way to check a
          buyer&rsquo;s age properly. We&rsquo;ll revisit it, and we&rsquo;ll say so here when we do.
        </p>
      </L>

      <L h="Things you can only offer in particular circumstances">
        <p>
          Some goods and services are perfectly legitimate but can only be sold by certain businesses,
          or in certain ways. These include medicines, including veterinary; food and drink; live
          animals; fuels, chemicals and solvents; and services that need a qualification, registration
          or licence.
        </p>
        <p>
          If you offer something in this group,{" "}
          <span className="font-semibold text-ink">
            you&rsquo;re responsible for holding any licence, registration or permission it needs, and
            for meeting any age-verification, labelling, safety, storage and fulfilment requirements
            that apply to your business.
          </span>{" "}
          We don&rsquo;t check this for you, and listing something here isn&rsquo;t us saying you may
          sell it.
        </p>
      </L>

      <L h="Food and drink">
        <p>
          Plenty of Shetland businesses sell food, and you&rsquo;re welcome to. If you do, you&rsquo;re
          responsible for the things that apply to your kind of food business — registration and safety
          requirements, allergen information, honest descriptions of what&rsquo;s in it, and storing,
          packing and getting it to the customer in a fit state. Say clearly how and when it will reach
          them, particularly if it&rsquo;s fresh, chilled or has a short life.
        </p>
      </L>

      <L h="Services and bookings">
        <p>
          Everything above applies to services as much as to things in boxes. Where a service needs a
          qualification, registration, insurance or licence, only offer it if you have one. Don&rsquo;t
          advertise services that are unlawful, unsafe, deceptive, or that you can&rsquo;t actually
          deliver.
        </p>
      </L>

      <L h="Selling it here isn&rsquo;t the same as Fetch carrying it">
        <p>
          Being allowed to sell something on OneShetland does not mean it can be delivered by a Fetch
          driver. Fetch has its own separate rules in our{" "}
          <Link href="/restricted-goods" className="font-semibold text-ink underline underline-offset-2">
            Restricted goods
          </Link>{" "}
          policy, and community drivers can&rsquo;t carry a number of ordinary, perfectly legal items.
          If you sell something Fetch can&rsquo;t carry, arrange collection or your own delivery. Both
          policies apply where both are involved.
        </p>
      </L>

      <L h="Describing things honestly">
        <p>Don&rsquo;t:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>list a prohibited item under a different name, category or photo;</li>
          <li>use a title, image or description that misleads about what something is;</li>
          <li>split, bundle or disguise something to get around this policy;</li>
          <li>use a listing to arrange a prohibited sale privately afterwards.</li>
        </ul>
      </L>

      <L h="What we may do">
        <p>
          We don&rsquo;t check or approve listings before they appear, and a listing being live
          doesn&rsquo;t mean we&rsquo;ve reviewed it. Where we think this policy has been broken, we may
          remove or restrict a listing, ask you for more information about what you&rsquo;re offering,
          or suspend a business&rsquo;s access to some or all commercial features. Where it&rsquo;s
          practical and appropriate we&rsquo;ll tell you why first. These are the powers already set out
          in section 11 of our Terms.
        </p>
      </L>

      <L h="Telling us about a listing">
        <p>
          If you think something shouldn&rsquo;t be on OneShetland, contact{" "}
          <a href="mailto:hello@oneshetland.com" className="font-semibold text-ink underline underline-offset-2">
            hello@oneshetland.com
          </a>
          . Tell us what you saw and where, and we&rsquo;ll look at it.
        </p>
      </L>
    </LegalLayout>
  );
}
