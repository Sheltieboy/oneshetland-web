import type { PreviewConfig } from './types.ts';
import { loveFromShetland } from './partners/love-from-shetland.ts';
import { zzTestAcceptance } from './partners/zz-test-acceptance.ts';

/** Every preview that exists. Adding a business = one config file + one line here + an invitation hash. */
const ALL: PreviewConfig[] = [loveFromShetland, zzTestAcceptance];

export const getPreviewConfig = (slug: string): PreviewConfig | null => ALL.find((p) => p.slug === slug) ?? null;
export const previewSlugs = (): string[] => ALL.map((p) => p.slug);

/** What an administrator can issue an invitation for: the preview, and the one business it belongs to. */
export const launchPreviewOptions = () =>
  ALL.filter((p) => p.directoryBusinessId).map((p) => ({ slug: p.slug, businessId: p.directoryBusinessId as string, name: p.businessName }));
