import { publicClient } from '@/lib/supabase/public';
import type { PreviewConfig } from './types.ts';

export interface DirectoryFacts { name: string; description: string | null; locality: string | null; slug: string | null; claimed: boolean }

/**
 * READ-ONLY look at the business's existing public Directory record, so the preview shows what OneShetland already
 * says about them. Reads the public view only; writes nothing; falls back to the config if anything goes wrong.
 */
export async function readDirectoryFacts(cfg: PreviewConfig): Promise<DirectoryFacts> {
  const fallback: DirectoryFacts = { name: cfg.businessName, description: null, locality: null, slug: null, claimed: false };
  if (!cfg.directoryBusinessId) return fallback;
  try {
    const { data } = await publicClient().from('local_businesses_public')
      .select('name, description, locality, slug, is_claimed').eq('id', cfg.directoryBusinessId).maybeSingle();
    if (!data) return fallback;
    return { name: data.name ?? cfg.businessName, description: data.description ?? null, locality: data.locality ?? null, slug: data.slug ?? null, claimed: !!data.is_claimed };
  } catch { return fallback; }
}
