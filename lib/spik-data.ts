import { publicClient } from "./supabase/public";

/** The Shetland dialect dictionary, read live from Supabase `spik_dictionary`.
 *  Mirrors the app's reads in oneshetland-delivers/lib/oneshetland-api.ts. */

export const SPIK_COLOR = "#12b3d6";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type SpikWord = {
  id: number;
  word: string;
  first_letter: string | null;
  alternate_spelling: string | null;
  pronunciation: string | null;
  short_meaning: string | null;
  spik_meaning: string | null;
  example_sentence: string | null;
  part_of_speech: string | null;
  category: string | null;
  usage_level: string | null;
  era: string | null;
  tone: string | null;
  origin: string | null;
  audio_url: string | null;
  contributor_name: string | null;
  contributor_show: boolean | null;
  speaker_area: string | null;
  notes: string | null;
};

export type SpikListItem = Pick<
  SpikWord,
  "id" | "word" | "part_of_speech" | "short_meaning" | "pronunciation" | "example_sentence"
>;

const LIST_COLS =
  "id, word, part_of_speech, short_meaning, pronunciation, example_sentence";

/** Words whose first letter matches, A–Z. */
export async function getWordsByLetter(letter: string): Promise<SpikListItem[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("spik_dictionary")
      .select(LIST_COLS)
      .eq("first_letter", letter.toLowerCase())
      .order("word", { ascending: true })
      .limit(2000);
    return (data ?? []) as unknown as SpikListItem[];
  } catch {
    return [];
  }
}

/** Free-text search across the word itself. */
export async function searchWords(q: string): Promise<SpikListItem[]> {
  const term = q.trim();
  if (!term) return [];
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("spik_dictionary")
      .select(LIST_COLS)
      .ilike("word", `%${term}%`)
      .order("word", { ascending: true })
      .limit(100);
    return (data ?? []) as unknown as SpikListItem[];
  } catch {
    return [];
  }
}

/** A single word, all fields, for the detail page. */
export async function getWord(id: string): Promise<SpikWord | null> {
  const numId = Number(id);
  if (!Number.isInteger(numId)) return null;
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("spik_dictionary")
      .select("*")
      .eq("id", numId)
      .maybeSingle();
    return (data ?? null) as SpikWord | null;
  } catch {
    return null;
  }
}

/** Total word count + which letters have entries (drives the A–Z rail).
 *  PostgREST caps each response at 1000 rows, so we page through the
 *  `first_letter` column to see every letter, not just the first page. */
export async function getAlphabetInfo(): Promise<{
  total: number;
  letters: Set<string>;
}> {
  const sb = publicClient();
  const letters = new Set<string>();
  const PAGE = 1000;
  try {
    let from = 0;
    let total = 0;
    // Guard against runaway loops; the dictionary is a few thousand words.
    for (let page = 0; page < 20; page++) {
      const { data, count } = await sb
        .from("spik_dictionary")
        .select("first_letter", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (count != null) total = count;
      const rows = (data ?? []) as { first_letter: string | null }[];
      for (const r of rows) {
        if (r.first_letter) letters.add(r.first_letter.toUpperCase());
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return { total, letters };
  } catch {
    return { total: 0, letters };
  }
}

/** Words filtered by origin (e.g. "scots", "old norse"). */
export async function getWordsByOrigin(origin: string): Promise<SpikListItem[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("spik_dictionary")
      .select(LIST_COLS)
      .eq("origin", origin)
      .order("word", { ascending: true })
      .limit(2000);
    return (data ?? []) as unknown as SpikListItem[];
  } catch {
    return [];
  }
}

/** Words filtered by usage_level (e.g. "common", "rare"). */
export async function getWordsByUsage(level: string): Promise<SpikListItem[]> {
  const sb = publicClient();
  try {
    const { data } = await sb
      .from("spik_dictionary")
      .select(LIST_COLS)
      .eq("usage_level", level)
      .order("word", { ascending: true })
      .limit(2000);
    return (data ?? []) as unknown as SpikListItem[];
  } catch {
    return [];
  }
}

export type SpikStats = {
  total: number;
  origins: Array<{ origin: string; count: number }>;
  usage: Array<{ level: string; count: number }>;
};

/** Aggregate dictionary stats (origin breakdown + usage mix), via RPC. */
export async function getSpikStats(): Promise<SpikStats> {
  const sb = publicClient();
  try {
    const { data } = await sb.rpc("get_spik_stats");
    const s = (data ?? {}) as Partial<SpikStats>;
    return {
      total: s.total ?? 0,
      origins: s.origins ?? [],
      usage: s.usage ?? [],
    };
  } catch {
    return { total: 0, origins: [], usage: [] };
  }
}

/** A random word id, for "Surprise me". */
export async function getRandomWordId(): Promise<number | null> {
  const sb = publicClient();
  try {
    const { count } = await sb
      .from("spik_dictionary")
      .select("id", { count: "exact", head: true });
    if (!count) return null;
    // Deterministic-free randomness lives here (server-side), not in a Date call.
    const offset = Math.floor(Math.random() * count);
    const { data } = await sb
      .from("spik_dictionary")
      .select("id")
      .order("id", { ascending: true })
      .range(offset, offset);
    const row = (data ?? [])[0] as { id: number } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/* ── Community suggestions ───────────────────────────────────────────────────
 * Mirrors the app's spik-suggest flow: one row per changed field in
 * `spik_suggestions`, status 'pending', reviewed in WordPress. */

export type SuggestFieldType = "text" | "multiline" | "select";

export type SuggestField = {
  name: keyof SpikWord | "short_meaning";
  label: string;
  hint: string;
  type: SuggestFieldType;
  options?: string[];
};

export const SUGGEST_FIELDS: SuggestField[] = [
  { name: "short_meaning", label: "Meaning (short)", type: "text", hint: "A concise English definition" },
  { name: "spik_meaning", label: "Full Shetland meaning", type: "multiline", hint: "A richer explanation in context" },
  { name: "example_sentence", label: "Example in use", type: "text", hint: "A natural sentence using this word" },
  { name: "pronunciation", label: "Pronunciation", type: "text", hint: "e.g. AHB-er (caps = stressed syllable)" },
  { name: "alternate_spelling", label: "Alternate spelling", type: "text", hint: "Another way this word is written" },
  {
    name: "part_of_speech", label: "Part of speech", type: "select",
    hint: "Select the closest match",
    options: ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "interjection", "determiner", "conjunction", "auxiliary verb", "phrase"],
  },
  {
    name: "category", label: "Category", type: "select", hint: "What topic does this word relate to?",
    options: ["action", "quality", "people", "animals", "body", "sea", "object", "nature", "food", "emotion", "home", "time", "weather", "work", "place", "clothing"],
  },
  { name: "usage_level", label: "Usage level", type: "select", hint: "How commonly is this word used today?", options: ["common", "known", "less common", "rare"] },
  { name: "era", label: "Era", type: "select", hint: "Is this word still in everyday use?", options: ["current", "older", "archaic"] },
  { name: "tone", label: "Tone", type: "select", hint: "What feeling does this word carry?", options: ["neutral", "affectionate", "warm", "humorous", "harsh", "insult"] },
  { name: "origin", label: "Origin", type: "select", hint: "Where does this word come from?", options: ["scots", "old norse", "unknown"] },
];

/** Strip the HTML the WordPress source sometimes wraps fields in. */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}
