import type { PreviewConfig } from '../types.ts';
import { shopify } from './shared.ts';

/**
 * Peerie Shop — shop locally + visit locally + earn rewards locally.
 *
 * THE DIRECTORY HOLDS THREE SEPARATE RECORDS: "Peerie Shop" (796a8ec6…, the shop), "Peerie Shop Cafe" (649c7844…) and
 * "Peerie Isles" (01a8147a…). This preview belongs to the SHOP record only. The shop's own site says the café is
 * "situated behind the Peerie Shop" and shares one address and website, but who now operates the café is not stated
 * publicly, so nothing here claims or implies ownership of it; the café record is left alone. Peerie Isles is a
 * different business at a different address and is not part of this preview.
 *
 * Public information from peerieshop.co.uk, read 5 Oct 2026. The site has no shopfront or interior photograph, so the
 * hero is the shop's own homepage banner (saved locally) behind its illustrated shopfront from the existing OneShetland
 * listing. No café menu or prices are used. Nothing here is a record in OneShetland.
 */
const CDN = 'https://cdn.shopify.com/s/files/1/0242/8865/7472/files';
const SITE = 'https://peerieshop.co.uk';

export const peerieShop: PreviewConfig = {
  slug: 'peerie-shop',
  businessName: 'Peerie Shop',
  directoryBusinessId: '796a8ec6-d7a4-4af0-b77b-460ca31ab1da',
  claim: 'holding',
  positioning: 'Retail + local discovery + offers/rewards (shop locally, visit locally, earn rewards locally)',

  hero: {
    headline: ['Shop locally.', 'Visit locally.', 'Earn rewards locally.'],
    treatment: 'ambient',
    position: '10% 50%',
    support:
      "We've put together an example of how Peerie Shop could look on OneShetland — the gift shop on Lerwick's Esplanade, with its Shetland knitwear and gifts, in front of the locals and visitors already looking for exactly this.",
  },

  business: {
    categoryLabel: 'Shop · Gifts & knitwear',
    category: 'retail',
    pillarLabel: 'Shop',
    logo: '/business-logos/peerie-shop.png',
    locality: 'Lerwick, Shetland',
    description:
      "A gift shop on Lerwick's Esplanade, in an 18th-century converted lodberry, selling carefully chosen gifts, hand-knitted designer knitwear and its own range of Shetland gifts and stationery.",
    tags: ['Gifts', 'Shetland knitwear', 'Cards & stationery', 'Lerwick Esplanade'],
    image: { src: '/launch/peerie-shop/banner.jpg', alt: "Hand-painted wooden Fair Isle jumper decorations and a wooden seagull on patterned paper, with the Peerie Shop logo — the banner on the shop's own website", position: '50% 50%' },
  },

  products: [
    { id: 'wool-hat', title: 'Wool hat', price: 29.99, image: shopify(`${CDN}/beaniehatrolledhead.jpg`), blurb: 'A wool beanie with a rolled brim.', source: `${SITE}/products/wool-hat` },
    { id: 'checked-hat', title: 'Peerie Shop checked wool hat', price: 24.95, image: shopify(`${CDN}/checked_hat_red.jpg`), blurb: "A checked wool hat from the shop's own range.", source: `${SITE}/products/peerie-shop-hat` },
    { id: 'mug', title: 'Angela Harding Fairisle Mug', price: 15, image: shopify(`${CDN}/angelahardingmug2.jpg`), blurb: 'A Fair Isle patterned mug.', source: `${SITE}/products/angela-harding-fairisle-mug` },
    { id: 'puffins', title: 'Tin of Puffins', price: 6.75, image: shopify(`${CDN}/puffinsinatin1.jpg`), blurb: 'A small gift tin of puffins.', source: `${SITE}/products/tin-of-puffins` },
    { id: 'baby-vest', title: 'Shetland Baby Vest', price: 13, image: shopify(`${CDN}/ShetlandVests.jpg`), blurb: 'A baby vest with a Shetland design.', source: `${SITE}/products/shetland-baby-vest` },
  ],
  productsTitle: ['Your gifts and knitwear,', 'in the Shop.'],

  story: {
    eyebrow: 'The shop',
    title: ['Gifts chosen with care,', 'on the Esplanade.'],
    body: [
      "Peerie Shop describes itself as selling beautifully chosen and curated gifts, in an 18th-century converted lodberry on Lerwick's Esplanade — including hand-knitted designer knitwear and its own range of Shetland gifts and stationery.",
      "Its own website says the café sits behind the shop, serving home-cooked food and good coffee. How the shop and the café appear on OneShetland would be entirely your decision.",
    ],
    source: `${SITE}/pages/about-us`,
  },

  possibilities: ['offers', 'rewards', 'discovery'],
  rewardsNote: 'For example, a stamp card for regular customers, or points for repeat visits. These are examples only — nothing has been set up.',
  searchTerm: 'gifts',
  sourceSite: { label: 'peerieshop.co.uk', url: SITE },
  sources: [
    { label: 'About us', url: `${SITE}/pages/about-us`, used: 'what the shop and café are, and that the café is behind the shop' },
    { label: 'The Peerie Shop', url: `${SITE}/pages/the-peerie-shop-1`, used: 'the shop description (curated gifts, converted lodberry, Esplanade)' },
    { label: 'Homepage banner', url: `${SITE}/`, used: 'the banner photograph' },
    ...[['Wool hat', 'wool-hat'], ['Peerie Shop checked wool hat', 'peerie-shop-hat'], ['Angela Harding Fairisle Mug', 'angela-harding-fairisle-mug'], ['Tin of Puffins', 'tin-of-puffins'], ['Shetland Baby Vest', 'shetland-baby-vest']]
      .map(([label, h]) => ({ label, url: `${SITE}/products/${h}`, used: 'product name, price and picture' })),
  ],
};
