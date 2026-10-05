import type { PreviewConfig } from '../types.ts';
import { shopify } from './shared.ts';

/**
 * Shetland Jewellery — Products + experiences.
 *
 * Public information from shetlandjewellery.co.uk (the business's own Shopify store), read 5 Oct 2026: the history
 * page, six product pages and the workshop-tour page. Prices are the displayed default (silver) price. Product
 * pictures are loaded from the store's own CDN; the workshop photograph is the first picture on the tour page, saved
 * locally at 1600px so the preview does not depend on a hot-link. Nothing here is a record in OneShetland.
 */
const CDN = 'https://cdn.shopify.com/s/files/1/0564/4635/3606/files';
const SITE = 'https://www.shetlandjewellery.co.uk';
const TOUR = `${SITE}/products/shetland-jewellery-original-workshop-tour-weisdale-booking`;

export const shetlandJewellery: PreviewConfig = {
  slug: 'shetland-jewellery',
  businessName: 'Shetland Jewellery',
  directoryBusinessId: '6ce8c083-8cfc-45ba-a43c-494b6b646023',
  claim: 'holding',
  positioning: 'Products + experiences',

  hero: {
    headline: ['Your jewellery.', 'Your workshop.', 'Discoverable across Shetland.'],
    support:
      "We've put together an example of how Shetland Jewellery could look on OneShetland — hand-made jewellery inspired by Shetland's wildlife, history and landscape, in the Shop, and your workshop tour in Experiences, in front of the locals and visitors already looking for exactly this.",
  },

  business: {
    categoryLabel: 'Shop · Hand-made jewellery',
    category: 'retail',
    pillarLabel: 'Shop',
    locality: 'Weisdale, Shetland',
    description:
      "A family jewellery business in Weisdale, founded in 1953. Every piece is hand-made in the workshop beside Hellister Loch, with designs inspired by Norse mythology, Shetland wildlife, archaeology and Celtic patterns.",
    tags: ['Hand-made in Shetland', 'Silver & gold', 'Shetland-inspired designs', 'Gifts', 'Workshop tours'],
    image: { src: '/launch/shetland-jewellery/workshop.jpg', alt: 'The enamelling bench in the Shetland Jewellery workshop, with small enamelled silver pieces on firing boards', position: '58% 55%' },
  },

  products: [
    { id: 'oyster', title: 'Shetland Oyster Shell Pendant', price: 99.5, image: shopify(`${CDN}/IMG_1390_copyWeb.jpg?v=1776946114`), blurb: 'A pendant inspired by a Shetland oyster shell.', source: `${SITE}/products/shetland-oyster-shell-pendant` },
    { id: 'crab', title: 'Silver Shetland Crab Claw Pendant', price: 235, image: shopify(`${CDN}/IMG_1561copyWeb.jpg?v=1779291058`), blurb: 'A silver pendant in the shape of a Shetland crab claw.', source: `${SITE}/products/silver-shetland-crab-claw-pendant` },
    { id: 'buckie', title: 'Large Grottie Buckie Shell Pendant', price: 75, image: shopify(`${CDN}/IMG_1402_copyWeb.jpg?v=1778509172`), blurb: 'A pendant based on the grottie buckie shell.', source: `${SITE}/products/large-grottie-buckie-shell-pendant` },
    { id: 'fibo', title: 'FIBO Fair Isle Bird Observatory Brooch', price: 165, image: shopify(`${CDN}/IMG_1469copyWeb.jpg?v=1777909553`), blurb: 'A brooch made with the Fair Isle Bird Observatory.', source: `${SITE}/products/fibo-fair-isle-bird-observatory-brooch` },
    { id: 'mandala', title: 'Half Mandala Amethyst Pendant', price: 105, image: shopify(`${CDN}/IMG_1596copyWeb_c360c4e2-7d4b-40f2-bca0-a5ad1f473c18.jpg?v=1780140844`), blurb: 'A half-mandala pendant set with an amethyst.', source: `${SITE}/products/half-mandala-amethyst-pendant-february-birthstone` },
    { id: 'etive', title: 'Buachaille Etive Mòr Medium Pendant', price: 125, image: shopify(`${CDN}/IMG_1158copyWeb_2566f4dc-7cc4-49fb-a3ff-7d9c68c6f6ee.jpg?v=1775142990`), blurb: 'A pendant in the outline of a famous Highland peak.', source: `${SITE}/products/buachaille-etive-mor-medium-pendant` },
  ],
  productsTitle: ['Your jewellery,', 'in the Shop.'],
  productsNote: 'Prices shown are the standard (silver) prices; many pieces are also offered in gold.',

  experience: {
    title: 'Original Workshop Tour',
    blurb:
      'Your own site already invites visitors to the Weisdale workshop for a guided tour by a trained jeweller — to see the lost wax process and the team at work at the bench. On OneShetland, that could sit next to your jewellery as an experience.',
    image: { src: '/launch/shetland-jewellery/workshop.jpg', alt: 'The enamelling bench in the Shetland Jewellery workshop', position: '50% 60%' },
    meta: 'Tuesdays & Thursdays, 11am',
    price: '£5',
    source: TOUR,
  },

  possibilities: ['offers', 'rewards', 'discovery'],
  appearLine: 'Your jewellery and your workshop tour can appear across OneShetland',
  searchTerm: 'jewellery',
  sourceSite: { label: 'shetlandjewellery.co.uk', url: SITE },
  sources: [
    { label: 'Our history', url: `${SITE}/pages/our-history`, used: 'business description (founded 1953, hand-made in the Weisdale workshop, design inspirations)' },
    { label: 'Original Workshop Tour', url: TOUR, used: 'the tour (days, time, price) and the workshop photograph' },
    ...[
      ['Shetland Oyster Shell Pendant', 'shetland-oyster-shell-pendant'], ['Silver Shetland Crab Claw Pendant', 'silver-shetland-crab-claw-pendant'], ['Large Grottie Buckie Shell Pendant', 'large-grottie-buckie-shell-pendant'],
      ['FIBO Fair Isle Bird Observatory Brooch', 'fibo-fair-isle-bird-observatory-brooch'], ['Half Mandala Amethyst Pendant', 'half-mandala-amethyst-pendant-february-birthstone'], ['Buachaille Etive Mòr Medium Pendant', 'buachaille-etive-mor-medium-pendant'],
    ].map(([label, h]) => ({ label, url: `${SITE}/products/${h}`, used: 'product name, price and picture' })),
  ],
};
