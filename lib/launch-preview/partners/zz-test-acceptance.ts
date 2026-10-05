import type { PreviewConfig } from '../types.ts';
import { loveFromShetland } from './love-from-shetland.ts';

/**
 * ZZ TEST — an acceptance preview for the claim flow, so Darren can walk Preview → Claim → Sign in → Confirm →
 * Submit → Admin approval → Owner → Launch-partner Premium → Products WITHOUT touching Love From Shetland.
 *
 * It is tied to the existing inactive, ownerless test listing "ZZ TEST - Launch grant acceptance"
 * (7c685526-da90-48dc-baab-a962e1ac6956), which is not public. It borrows the Love From Shetland pictures purely so
 * the page looks complete; nothing here is a product or a claim on anything. Retire it by deleting this file and
 * its registry line, and reset the test listing's owner (see the acceptance notes).
 */
export const zzTestAcceptance: PreviewConfig = {
  ...loveFromShetland,
  slug: 'zz-test-acceptance',
  businessName: 'ZZ TEST Launch Partner',
  directoryBusinessId: '7c685526-da90-48dc-baab-a962e1ac6956',
  hero: { support: "This is an ACCEPTANCE TEST of the launch-partner claim flow. It uses a test listing that is not public; the pictures are borrowed so the page looks complete." },
  business: {
    ...loveFromShetland.business,
    categoryLabel: 'Shop · Test listing',
    description: 'ZZ TEST — an inactive listing used only to test the launch-partner claim flow. It is not a real business.',
    tags: ['Test', 'Acceptance', 'Not a real business'],
  },
};
