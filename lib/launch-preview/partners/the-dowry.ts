import type { PreviewConfig } from '../types.ts';

/**
 * The Dowry — Bookings + local discovery + offers/rewards possibilities.
 *
 * Public information from thedowry.co.uk (a single page), read 5 Oct 2026: it describes a cafe/bar on Commercial
 * Street, Lerwick, offers online table booking and e-gift cards, and shows its phone number. It publishes no hours,
 * photographs or email address, so none are used. The shopfront picture is the page's own background photograph
 * (soft-focus by design), saved locally. No menu items or prices are used. Nothing here is a record in OneShetland.
 */
const SITE = 'https://www.thedowry.co.uk';

export const theDowry: PreviewConfig = {
  slug: 'the-dowry',
  businessName: 'The Dowry',
  directoryBusinessId: '0aac60af-69c7-45dd-9a92-8fa83955a8fb',
  claim: 'holding',
  positioning: 'Bookings + local discovery + offers/rewards possibilities',

  hero: {
    headline: ['Locally loved.', 'Easy to find.', 'Easy to book.'],
    treatment: 'ambient',
    collage: [],
    support:
      "We've put together an example of how The Dowry could appear on OneShetland — in Local discovery, in search, and as one more way for people to reserve a table, alongside the booking you already use.",
  },

  business: {
    categoryLabel: 'Eat & drink · Café bar',
    category: 'food_drink',
    pillarLabel: 'Eat & drink',
    logo: '/business-logos/the-dowry.png',
    locality: 'Lerwick, Shetland',
    description:
      'A café bar on Commercial Street in Lerwick, serving quality local produce, artisan coffee, beers and spirits.',
    tags: ['Café & bar', 'Local produce', 'Artisan coffee', 'Beers & spirits', 'Lerwick'],
    image: { src: '/launch/the-dowry/shopfront.jpg', alt: 'The Dowry shopfront on Commercial Street, Lerwick, in black and white', position: '50% 55%' },
  },

  products: [],
  booking: {
    cta: 'Reserve a table',
    line: "Your own website already takes table reservations online and sells e-gift cards. OneShetland would simply be another place people can find you — and a way to reach the locals and visitors who start their search here.",
  },
  possibilities: ['offers', 'rewards', 'discovery'],
  catalogue: false,
  appearLine: 'Your business can appear across OneShetland',
  stepFour: ['Add your real details', 'Your hours, photos and how people book.'],
  searchTerm: 'coffee',
  sourceSite: { label: 'thedowry.co.uk', url: SITE },
  sources: [
    { label: 'thedowry.co.uk', url: SITE, used: 'description, the online booking and e-gift card routes, and the shopfront photograph' },
  ],
};
