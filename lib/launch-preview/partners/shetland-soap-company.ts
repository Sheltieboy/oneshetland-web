import type { PreviewConfig } from '../types.ts';
import { shopify } from './shared.ts';

/**
 * Shetland Soap Company — Products + local story.
 *
 * Public information from shetlandsoap.co.uk (the company's own Shopify store), read 5 Oct 2026. The story section
 * uses ONLY what the homepage says (part of COPE Ltd, a social enterprise; works alongside adults with learning
 * disabilities and autism) and attributes it. Product prices come from the store's catalogue feed (the Ayre price was
 * cross-checked against its product page). The hero is the homepage's own carousel photograph, saved locally.
 * Nothing here is a record in OneShetland.
 */
const CDN = 'https://cdn.shopify.com/s/files/1/0158/8645/0788';
const SITE = 'https://shetlandsoap.co.uk';

export const shetlandSoapCompany: PreviewConfig = {
  slug: 'shetland-soap-company',
  businessName: 'Shetland Soap Company',
  directoryBusinessId: '7511b3df-4cc6-479b-b62e-04715a22cd7c',
  claim: 'holding',
  positioning: 'Products + local story',

  hero: {
    headline: ['Your products.', 'Your story.', 'Discoverable across Shetland.'],
    support:
      "We've put together an example of how Shetland Soap Company could look on OneShetland — handmade soap and skincare inspired by the islands, and the story behind it, in front of the locals and visitors already looking for exactly this.",
  },

  business: {
    categoryLabel: 'Shop · Handmade soap & skincare',
    category: 'retail',
    pillarLabel: 'Shop',
    logo: '/business-logos/shetland-soap-co-ltd.png',
    locality: 'Lerwick, Shetland',
    description:
      'A Lerwick company making handmade soap and skincare inspired by the islands — soap bars, washes, lotions, bath salts, candles and more, with scents named for Shetland places and words.',
    tags: ['Handmade soap', 'Skincare', 'Candles & wax melts', 'Shetland-inspired scents', 'Gifts'],
    image: { src: '/launch/shetland-soap-company/hero.jpg', alt: 'A Shetland Soap Company Norseman hair and body wash bottle on a dark rock, with waves and a hill behind', position: '52% 50%' },
  },

  story: {
    eyebrow: 'The story behind it',
    title: ['Products with a purpose,', 'told in your words.'],
    body: [
      'Shetland Soap Company is part of COPE Ltd, which describes itself as a social enterprise based in the Shetland Islands.',
      'The company’s own website says it works alongside adults with learning disabilities and autism to produce its range of handmade soap and skincare, inspired by the islands.',
    ],
    source: `${SITE}/`,
  },

  products: [
    { id: 'ayre', title: 'Ayre Soap Bar', price: 5.75, image: shopify(`${CDN}/products/Ayre.jpg`), blurb: 'A handmade soap bar from the Shetland-named range.', source: `${SITE}/products/ayre-hard-bar` },
    { id: 'lodberrie', title: 'Lodberrie Candle', price: 12.95, image: shopify(`${CDN}/products/20201013-1658.jpg`), blurb: 'A candle named for the Lerwick waterfront lodberries.', source: `${SITE}/products/lodberrie-candle` },
    { id: 'shoormal', title: 'Shoormal Hand & Body Lotion', price: 10.95, image: shopify(`${CDN}/products/ShoormalHandlotion.png`), blurb: 'A hand and body lotion from the same range.', source: `${SITE}/products/shoormal-hand-lotion` },
    { id: 'heather', title: 'Heather Glycerine Soap', price: 5.5, image: shopify(`${CDN}/files/IMG-20260305-WA0002.jpg`), blurb: 'A glycerine soap bar.', source: `${SITE}/products/heather-glycerine-soap` },
    { id: 'bath-salts', title: 'Citrus & Vanilla Bath Salts', price: 9.5, image: shopify(`${CDN}/products/salt-grey2.jpg`), blurb: 'Bath salts in a citrus and vanilla scent.', source: `${SITE}/products/citrus-vanilla-bath-salts` },
    { id: 'shaving', title: 'Alamootie Shaving Soap', price: 10.95, image: shopify(`${CDN}/products/Alamootie_Shaving_Soap.jpg`), blurb: 'A shaving soap from the grooming range.', source: `${SITE}/products/alamootie-shaving-soap` },
  ],
  productsTitle: ['Your products,', 'in the Shop.'],

  possibilities: ['offers', 'rewards', 'discovery'],
  searchTerm: 'soap',
  sourceSite: { label: 'shetlandsoap.co.uk', url: SITE },
  sources: [
    { label: 'shetlandsoap.co.uk', url: `${SITE}/`, used: 'the story (COPE Ltd, social enterprise, working alongside adults with learning disabilities and autism), the range, and the hero photograph' },
    ...[
      ['Ayre Soap Bar', 'ayre-hard-bar'], ['Lodberrie Candle', 'lodberrie-candle'], ['Shoormal Hand & Body Lotion', 'shoormal-hand-lotion'],
      ['Heather Glycerine Soap', 'heather-glycerine-soap'], ['Citrus & Vanilla Bath Salts', 'citrus-vanilla-bath-salts'], ['Alamootie Shaving Soap', 'alamootie-shaving-soap'],
    ].map(([label, h]) => ({ label, url: `${SITE}/products/${h}`, used: 'product name, price and picture' })),
  ],
};
