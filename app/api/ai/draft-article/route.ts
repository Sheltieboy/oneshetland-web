import Anthropic from "@anthropic-ai/sdk";
import { publicClient } from "@/lib/supabase/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/draft-article  { recipe: "spik_word", word?: string }
 *
 * Peerie Bot drafts an Almanac article from OneShetland's own data. First recipe:
 * a Shetland dialect word deep-dive, grounded ONLY in the dictionary row (never
 * invents etymology or meanings). Returns a reviewable draft — the admin edits,
 * schedules and publishes it. ANTHROPIC_API_KEY stays server-side.
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Engaging, SEO-friendly headline, e.g. 'Gansey: the Shetland word for a hand-knitted jumper'." },
    slug: { type: "string", description: "URL slug, lowercase words separated by hyphens, derived from the title. No leading/trailing hyphen." },
    excerpt: { type: "string", description: "One-sentence standfirst that sells the read." },
    body: { type: "string", description: "600–900 word article in Markdown. Use ## subheadings, short paragraphs, a bullet list where useful. Ground everything ONLY in the facts provided — do not invent origins, dates, or meanings. Weave in the meaning, how/when it's used, the example, and where it sits in the dialect. Include the markdown link [<word>](/spik/<id>) once, and a link to the full dictionary [Spik dictionary](/spik)." },
    seo_title: { type: "string", description: "≤60 char title-tag." },
    seo_description: { type: "string", description: "≤155 char meta description." },
  },
  required: ["title", "slug", "excerpt", "body", "seo_title", "seo_description"],
} as const;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });

  let recipe = "spik_word", word = "";
  try { ({ recipe = "spik_word", word = "" } = await request.json()); } catch { /* defaults */ }
  if (recipe !== "spik_word") return Response.json({ error: "Unknown recipe." }, { status: 400 });

  // Pull the source word from the dictionary (a specific word, or a rich random one).
  const sb = publicClient();
  let row: Record<string, unknown> | null = null;
  if (word.trim()) {
    const { data } = await sb.from("spik_dictionary").select("*").ilike("word", word.trim()).limit(1).maybeSingle();
    row = data as Record<string, unknown> | null;
  } else {
    const { data } = await sb.from("spik_dictionary").select("*").not("spik_meaning", "is", null).not("example_sentence", "is", null).limit(200);
    const pool = (data ?? []) as Record<string, unknown>[];
    if (pool.length) row = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!row) return Response.json({ error: "Couldn't find a dialect word to write about." }, { status: 404 });

  const facts = {
    word: row.word, part_of_speech: row.part_of_speech, short_meaning: row.short_meaning,
    spik_meaning: row.spik_meaning, example_sentence: row.example_sentence, origin: row.origin,
    era: row.era, tone: row.tone, category: row.category, id: row.id,
  };

  const system =
    "You are Peerie Bot, OneShetland's writer. Write a warm, accurate Almanac article about ONE Shetland dialect word for a general audience (locals and visitors). " +
    "Use ONLY the facts supplied — never invent an etymology, meaning, date, or usage. If a fact isn't given, don't state it. British English. Do not use the word 'delve'. " +
    `The word's dictionary page is /spik/${facts.id}. Keep it engaging and genuinely informative.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: `Write the article from these dictionary facts (JSON):\n${JSON.stringify(facts, null, 2)}` }],
    });
    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return Response.json({ error: "Peerie Bot couldn't draft that — try again." }, { status: 502 });
    const draft = JSON.parse(block.text);

    return Response.json({
      ...draft,
      slug: slugify(draft.slug || draft.title),
      pillar: "dialect",
      linked_entities: [{ type: "word", id: String(facts.id), label: String(facts.word) }],
      source: { recipe: "spik_word", word: facts.word, word_id: facts.id },
    });
  } catch (e) {
    console.error("[draft-article] Peerie Bot error:", e);
    return Response.json({ error: "Peerie Bot had a hiccup — please try again." }, { status: 502 });
  }
}
