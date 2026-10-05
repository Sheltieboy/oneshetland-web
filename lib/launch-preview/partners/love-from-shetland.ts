import type { PreviewConfig } from '../types.ts';

/**
 * Love From Shetland — first Launch Partner Preview.
 *
 * Everything here was already public: the Directory record on oneshetland.com, and the product names, photographs
 * and prices shown on lovefromshetland.com on 5 Oct 2026. Five representative items are used, chosen to show the
 * Shop treatment well (none involves restricted goods). Nothing is a product record in OneShetland.
 * Photographs are loaded from the business's own site rather than copied.
 */
const IMG = 'https://static.wixstatic.com/media';
const fit = (id: string, ext: string, w = 800) => `${IMG}/${id}/v1/fit/w_${w},h_${w},q_80/file.${ext}`;

export const loveFromShetland: PreviewConfig = {
  slug: 'love-from-shetland',
  businessName: 'Love From Shetland',
  directoryBusinessId: 'fdda4cbe-1e28-4f4d-89d8-aed8317be513',

  hero: {
    support:
      "We've put together an example of how Love From Shetland could look on OneShetland — handmade goat's milk soaps and bath products, made on a Shetland croft, in front of the locals and visitors already looking for exactly this.",
  },

  business: {
    categoryLabel: 'Shop · Handmade soap & bath',
    locality: 'Lerwick, Shetland',
    description:
      "A small family-run company in the Shetland Islands. Handmade soaps and bath products using natural ingredients, including their own goats' milk — palm oil free, with no parabens or SLS.",
    tags: ["Goats' milk soap", 'Palm oil free', 'Handmade in Shetland', 'Gifts', 'Skincare'],
    image: {
      // The photo already on their OneShetland listing (public/business-logos/shetland-with-love.jpeg), with the
      // letterbox bars baked into that file cropped off.
      src: '/launch/love-from-shetland/shopfront.jpg',
      alt: 'The Love From Shetland shop window on Commercial Street, with a goat resting on the pavement outside',
    },
  },

  products: [
    {
      id: 'soaps',
      title: 'Fragranced Goatmilk Soaps 45g',
      price: 3.95,
      image: fit('5fbe5e_0d1b6389dd2a439fbccc3e2079ebe261~mv2.jpeg', 'jpg'),
      blurb: "Goats' milk soap bars in a variety of scents, for any skin type.",
    },
    {
      id: 'gift-box',
      title: 'Body Butter & Soap Gift Box',
      price: 21.95,
      image: fit('5fbe5e_e794354a105e45f288ae79be1bf414a8~mv2.jpg', 'jpg'),
      blurb: 'A coordinated body butter and soap set, handmade in Shetland.',
    },
    {
      id: 'freya',
      title: 'Freya Solid Perfume',
      price: 18.95,
      image: fit('5fbe5e_44b4beb8137947fcb0e6913f388ec78f~mv2.jpeg', 'jpg'),
      blurb: 'A solid perfume in a gold-finished jar.',
    },
    {
      id: 'spa-set',
      title: 'Sea Salt & Sage Spa Gift Set',
      price: 24.95,
      image: fit('5fbe5e_e9bfab796d294b6c89a9bd7f9ddcb3a0~mv2.jpeg', 'jpg'),
      blurb: 'A pamper box of natural handmade skincare from Shetland.',
    },
    {
      id: 'book',
      title: "Little Miss Goatee's Big Shetland Adventure",
      price: 9.95,
      image: fit('5fbe5e_5136013174874249904166013f55e435~mv2.png', 'png'),
      blurb: "A children's picture book starring the shop's own goat.",
    },
  ],

  searchTerm: 'soap',
  sourceSite: { label: 'lovefromshetland.com', url: 'https://www.lovefromshetland.com' },
};
