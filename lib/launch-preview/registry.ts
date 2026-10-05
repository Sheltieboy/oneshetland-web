import type { PreviewConfig } from './types.ts';
import { loveFromShetland } from './partners/love-from-shetland.ts';

/** Every preview that exists. Adding a business = one config file + one line here + an invitation hash. */
const ALL: PreviewConfig[] = [loveFromShetland];

export const getPreviewConfig = (slug: string): PreviewConfig | null => ALL.find((p) => p.slug === slug) ?? null;
export const previewSlugs = (): string[] => ALL.map((p) => p.slug);
