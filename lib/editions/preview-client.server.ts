import { cookies } from "next/headers";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { PREVIEW_HEADER, isPreviewToken, previewCookieName } from "./preview-link";

/**
 * The read path for a private Edition preview.
 *
 * An anon client that carries the presented token as a request header. PostgREST puts request headers
 * into the `request.headers` GUC, where the database's `edition_preview_id()` reads it and decides —
 * on its own, in SQL — which single Edition that token unlocks. Row-level security does the rest.
 *
 * Note what is NOT here. No service key: this is the ordinary anon key, the same one every visitor
 * uses, and the preview policies are additional `select` policies rather than a way around RLS. A
 * holder of a valid token can read one Edition and write nothing, and that is enforced in the
 * database rather than by this file remembering to be careful.
 */

/** The token this request presents for `slug`, or null. HttpOnly, so page JavaScript never sees it. */
export async function presentedPreviewToken(slug: string): Promise<string | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(previewCookieName(slug))?.value;
    return isPreviewToken(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** An anon Supabase client that presents `token` on every request it makes. */
export function previewClient(token: string): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { [PREVIEW_HEADER]: token } },
    },
  );
}
