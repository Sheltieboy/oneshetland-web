import type { PreviewConfig } from '../types.ts';
import { shopify } from './shared.ts';

/**
 * Da Craft Shed — Products + Shetland makers.
 *
 * Da Craft Shed has no website of its own. Its public online presence is the Jade Crafts Shetland store (same owner),
 * which has a "Da Craft Shed" page and offers click & collect from the shed. Public information read 5 Oct 2026 from
 * jadecraftsshetland.co.uk. The six items are listed on that store under the owner's own brand with NO third-party
 * maker or yarn brand in the title — deliberately: the shed's page names many local makers, and OneShetland has no
 * relationship with any of them. Who made each item is not stated on its page, so none is attributed.
 * The shopfront photograph is the one on the shed's page, saved locally. Nothing here is a record in OneShetland.
 */
const CDN = 'https://cdn.shopify.com/s/files/1/0977/4501/1025/files';
const SITE = 'https://www.jadecraftsshetland.co.uk';
const SHED = `${SITE}/pages/da-craft-shed`;

export const daCraftShed: PreviewConfig = {
  slug: 'da-craft-shed',
  businessName: 'Da Craft Shed',
  directoryBusinessId: 'f7a8915a-a80b-467c-8c4b-ca42369471c0',
  claim: 'holding',
  positioning: 'Products + Shetland makers',

  hero: {
    headline: ['Your shed.', 'Your shelves.', 'Discoverable across Shetland.'],
    support:
      "We've put together an example of how Da Craft Shed could look on OneShetland — a local craft shop in Dunrossness, with handmade Shetland gifts, in front of the locals and visitors already looking for exactly this.",
  },

  business: {
    categoryLabel: 'Shop · Local handmade crafts',
    category: 'retail',
    pillarLabel: 'Shop',
    locality: 'Dunrossness, Shetland',
    description:
      'A craft shop and studio at the Dunrossness Industrial Estate in the south mainland of Shetland — local handmade crafts and gifts, and workshops.',
    tags: ['Local handmade crafts', 'Shetland gifts', 'Knitting & yarn', 'Workshops', 'Dunrossness'],
    image: { src: '/launch/da-craft-shed/shopfront.jpg', alt: 'The Da Craft Shed building with its sign, a Local Handmade Crafts banner and a welcome board', position: '44% 50%' },
  },

  products: [
    { id: 'cushion', title: 'Embroidered Lighthouse Cushion', price: 30, image: shopify(`${CDN}/Lighthouse-Cushion-Embroidered-Applique-Natural-Cotton.webp?v=1766407226`), blurb: 'An embroidered lighthouse design on a natural cotton cushion.', source: `${SITE}/products/handcrafted-lighthouse-cushion` },
    { id: 'jigsaw', title: 'Sumburgh Head Lighthouse Jigsaw', price: 34, image: shopify(`${CDN}/Sumburgh-Head-Lighthouse-Jigsaw-Puzzle-500-Pieces.webp?v=1766407553`), blurb: 'A 500-piece jigsaw of Sumburgh Head lighthouse, in an illustrated tin.', source: `${SITE}/products/sumburgh-head-jigsaw` },
    { id: 'croft-house', title: 'Handmade Peerie Croft House', price: 16.25, image: shopify(`${CDN}/515B5A4B-DDFC-476E-865E-FD9A34B7EE77.png?v=1771421514`), blurb: 'A small croft house with a knitted wool roof.', source: `${SITE}/products/handmade-peerie-croft-houses` },
    { id: 'brooch', title: 'Hand-Painted Fair Isle Jumper Brooch', price: 6, image: shopify(`${CDN}/IMG_3749.webp?v=1771250707`), blurb: 'A hand-painted clay brooch shaped like a Fair Isle jumper.', source: `${SITE}/products/fair-isle-jumper-brooch` },
    { id: 'bauble', title: 'Shetland Sheep Felted Bauble', price: 10, image: shopify(`${CDN}/Shetland-Sheep-Felted-Bauble-Handmade-British-Wool-Ornament.webp?v=1766407513`), blurb: 'A felted wool sheep ornament.', source: `${SITE}/products/shetland-sheep-felted-bauble` },
    { id: 'mug', title: 'Purple Rainbow Fair Isle Ceramic Mug', price: 11, image: shopify(`${CDN}/Purple-White-Fair-Isle-Ceramic-Mug.webp?v=1766408008`), blurb: 'A ceramic mug with a Fair Isle pattern.', source: `${SITE}/products/rainbow-fair-isle-mug` },
  ],
  productsTitle: ['A craft shop,', 'in the Shop.'],
  productsNote: "These examples come from the shop's online store. OneShetland has no relationship with any individual maker or brand shown there, and nothing here claims anyone's work — what the shed shows of other makers would be for you to decide, together with them.",

  possibilities: ['offers', 'rewards', 'discovery'],
  searchTerm: 'craft',
  sourceSite: { label: 'jadecraftsshetland.co.uk', url: SITE },
  sources: [
    { label: 'Da Craft Shed', url: SHED, used: 'business description, location and the shopfront photograph' },
    ...[
      ['Embroidered Lighthouse Natural Cotton Cushion', 'handcrafted-lighthouse-cushion'], ['Sumburgh Head Lighthouse Jigsaw Puzzle', 'sumburgh-head-jigsaw'], ['Handmade Peerie Croft House with Knitted Wool Roof', 'handmade-peerie-croft-houses'],
      ['Hand-Painted Fair Isle Jumper Clay Brooch', 'fair-isle-jumper-brooch'], ['Shetland Sheep Felted Bauble', 'shetland-sheep-felted-bauble'], ['Purple Rainbow Fair Isle Ceramic Mug', 'rainbow-fair-isle-mug'],
    ].map(([label, h]) => ({ label, url: `${SITE}/products/${h}`, used: 'product name, price and picture' })),
  ],
};
