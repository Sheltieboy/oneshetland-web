import { permanentRedirect } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";

/**
 * Legacy redirect: the old WordPress dictionary used /spik_word/<word>; the new
 * app uses /spik/<id>. Look the word up and 308 to its new page, so every old
 * (and often-ranking) dialect-word URL passes its equity through. Falls back to
 * the Spik index if the word isn't found.
 */
export const dynamic = "force-dynamic";

export default async function SpikWordRedirect({ params }: { params: Promise<{ word: string }> }) {
  const { word } = await params;
  const term = decodeURIComponent(word).trim();
  let id: string | number | null = null;
  if (term) {
    try {
      const { data } = await publicClient()
        .from("spik_dictionary")
        .select("id")
        .ilike("word", term)
        .limit(1)
        .maybeSingle();
      id = (data as { id: string | number } | null)?.id ?? null;
    } catch {
      /* fall through to the index */
    }
  }
  // permanentRedirect throws internally, so it MUST run outside the try/catch.
  if (id != null) permanentRedirect(`/spik/${id}`);
  permanentRedirect("/spik");
}
