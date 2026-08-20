import Anthropic from "@anthropic-ai/sdk";
import { guardAi, aiProviderFailure } from "@/lib/ai-guard.server";
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
    body: { type: "string", description: "600–900 word article in Markdown. Use ## subheadings, short paragraphs, and a bullet list where useful. Ground everything ONLY in the facts provided — never invent origins, dates, or meanings. Cover the meaning, how and when the word is used, the example sentence, and where it sits in the dialect. LINKS: (1) EXACTLY ONCE, link the word to its own dictionary page as a real Markdown link whose text is the actual word and whose URL is the exact slug path from the facts — e.g. word \"gansey\", slug \"gansey\" → [gansey](/spik/gansey). (2) You MAY add AT MOST ONE further internal link, woven naturally into the prose, to a genuinely relevant word from the provided relatedWords list, using that word's given slug — but ONLY if it fits naturally; if none fit, add no second link. Add NO other links. Never link a word that isn't in the facts or relatedWords, never invent a URL, and never output literal placeholders like <word> or <slug>." },
    seo_title: { type: "string", description: "≤60 char title-tag." },
    seo_description: { type: "string", description: "≤155 char meta description." },
  },
  required: ["title", "slug", "excerpt", "body", "seo_title", "seo_description"],
} as const;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export async function POST(request: Request) {
  // Had no authentication of any kind. Its only caller is the admin article
  // editor, so a signed-in session plus a quota is exactly the shape it needed.
  const gate = await guardAi(request, { route: "draft-article", maxBodyBytes: 8_000, maxFieldChars: 100 });
  if (!gate.ok) return gate.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });

  const recipe = typeof gate.body.recipe === "string" ? gate.body.recipe : "spik_word";
  const word = typeof gate.body.word === "string" ? gate.body.word : "";
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
    era: row.era, tone: row.tone, category: row.category, id: row.id, slug: row.slug || row.id,
  };

  // Candidates for ONE natural contextual internal link — real words with real
  // slugs, so the model can only ever link to a page that exists.
  let relatedWords: { word: unknown; slug: unknown }[] = [];
  try {
    let rq = sb.from("spik_dictionary").select("word, slug").neq("id", row.id).not("slug", "is", null).limit(8);
    if (row.category) rq = rq.eq("category", row.category);
    else if (row.first_letter) rq = rq.eq("first_letter", row.first_letter);
    const { data } = await rq;
    relatedWords = (data ?? []).map((r: Record<string, unknown>) => ({ word: r.word, slug: r.slug }));
  } catch { /* related links are optional */ }

  const system =
    "You are Peerie Bot, OneShetland's writer. Write a warm, accurate Almanac article about ONE Shetland dialect word for a general audience (locals and visitors). " +
    "Use ONLY the facts supplied — never invent an etymology, meaning, date, or usage. If a fact isn't given, don't state it. British English. Do not use the word 'delve'. " +
    `The word's dictionary page is /spik/${facts.slug}. Keep it engaging and genuinely informative.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: `Write the article from these dictionary facts (JSON):\n${JSON.stringify(facts, null, 2)}\n\nrelatedWords (optional — link AT MOST ONE, only if it fits naturally; use its slug):\n${JSON.stringify(relatedWords, null, 2)}` }],
    });
    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return Response.json({ error: "Peerie Bot couldn't draft that — try again." }, { status: 502 });
    const draft = JSON.parse(block.text);
    const slugPath = `/spik/${facts.slug}`;
    // Safety net: substitute any leaked placeholder tokens and fix a numeric link.
    const body = String(draft.body ?? "")
      .replaceAll("/spik/<slug>", slugPath)
      .replaceAll("<slug>", String(facts.slug))
      .replaceAll("<word>", String(facts.word))
      .replaceAll(`/spik/${facts.id}`, slugPath);

    return Response.json({
      ...draft,
      body,
      slug: slugify(draft.slug || draft.title),
      pillar: "dialect",
      linked_entities: [{ type: "word", id: String(facts.id), label: String(facts.word), href: slugPath }],
      source: { recipe: "spik_word", word: facts.word, word_id: facts.id, word_slug: facts.slug },
    });
  } catch (e) {
    return aiProviderFailure("draft-article", e);
  }
}
