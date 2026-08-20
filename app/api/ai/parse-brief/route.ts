import Anthropic from "@anthropic-ai/sdk";
import { guardAi, aiProviderFailure } from "@/lib/ai-guard.server";
import { TRADES } from "@/lib/trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/parse-brief  { text: string }
 *
 * Peerie Bot turning "my kitchen window's rotten and won't shut" into a brief
 * a tradesperson can triage in ten seconds: which trades it needs, how big, how
 * urgent, and a tidy description written from only what was said.
 *
 * TWO THINGS IT MUST NOT DO.
 *
 * It must not guess a PRICE. Not "roughly £2,000", not a range, not "expect to
 * pay". It would be wrong often enough to matter, it would anchor both sides
 * before anyone had seen the job, and the first time somebody quotes it back at
 * a joiner we've damaged a relationship the whole thing depends on. Cost can
 * come later from what briefs actually got quoted, or not at all.
 *
 * It must not promise WHEN. "Someone will be out this week" is not ours to say.
 *
 * `questions` is the useful part and the reason this beats a form: the two or
 * three things a trade will need to know that the person didn't think to
 * mention. Not a questionnaire — the answer to "how many windows" changes who
 * can help and what it costs; "what colour" does not.
 */

const TRADE_KEYS = TRADES.map((t) => t.key);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "Short, plain summary as a tradesperson would file it, e.g. \"Rotten kitchen window, won't close\". Max 80 chars. \"\" if not derivable.",
    },
    trades: {
      type: "array",
      description: "Every trade genuinely needed, most central first. A new bathroom needs plumber, joiner and electrician — say all three. [] if truly unclear; \"other\" only if nothing fits.",
      items: { type: "string", enum: TRADE_KEYS },
    },
    scale: {
      type: "string",
      enum: ["small", "day", "multi_day", "project", "unsure"],
      description: "\"small\" = an hour or two. \"day\" = about a day. \"multi_day\" = a few days. \"project\" = weeks or more. \"unsure\" when the description genuinely doesn't say — prefer this over guessing.",
    },
    urgency: {
      type: "string",
      enum: ["emergency", "weeks", "months", "flexible"],
      description: "\"emergency\" ONLY for water coming in, no heat in winter, no power, or anything unsafe. Otherwise judge from their words; default \"flexible\" if not stated.",
    },
    location: {
      type: "string",
      description: "Place in Shetland if mentioned (Lerwick, Brae, Yell…), else \"\". Never invent one.",
    },
    description: {
      type: "string",
      description: "A tidy 2-4 sentence brief written from ONLY the stated facts, in plain English, as if handing it to a tradesperson. No adjectives that weren't earned, no pleading, no price talk.",
    },
    questions: {
      type: "array",
      description: "1-3 short questions a trade would need answered before quoting, that the description does NOT already answer. Only things that change who can help or what it costs. [] if the brief is already complete.",
      items: { type: "string" },
    },
    emergency_note: {
      type: "string",
      description: "If and only if urgency is \"emergency\" and there's a real safety issue (gas, electrics, structural, flooding), one short sentence on what to do RIGHT NOW before anyone arrives. Otherwise \"\".",
    },
  },
  required: ["title", "trades", "scale", "urgency", "location", "description", "questions", "emergency_note"],
} as const;

export async function POST(request: Request) {
  // Signed in, sized, and inside quota — or no Anthropic call happens at all.
  const gate = await guardAi(request, { route: "parse-brief", maxBodyBytes: 32_000, maxFieldChars: 8_000 });
  if (!gate.ok) return gate.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });
  }

  const text = typeof gate.body.text === "string" ? gate.body.text : "";
  if (text.trim().length < 8) {
    return Response.json({ error: "Tell Peerie Bot a bit more about the job." }, { status: 400 });
  }

  const system =
    `You are Peerie Bot, the OneShetland assistant. Somebody in Shetland has described a job they need doing. Turn it into a brief a tradesperson can read in ten seconds and decide on.\n\n` +
    `NEVER estimate or mention a price, a cost, a rate, or a budget — not even a range, not even hedged. You do not know, and a wrong number anchors both sides before anyone has seen the job.\n` +
    `NEVER promise when somebody will come, or that anyone is available.\n` +
    `Use ONLY what they said. Do not invent access details, materials, measurements or a location.\n\n` +
    `Shetland context: it is a small island group, so travel and ferries matter and small jobs are often hard to get anyone out for. Places include Lerwick, Scalloway, Brae, Voe, Walls, Sandwick, Bressay, Whalsay, Yell, Unst and Fetlar. Weather is a real constraint on outside work.\n\n` +
    `Write the description in plain English. No sales language, no dialect, no adjectives that weren't earned.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });

    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return Response.json({ error: "Peerie Bot couldn't read that — try rephrasing." }, { status: 502 });

    const parsed = JSON.parse(block.text) as Record<string, unknown>;

    // The model is told the enum, but the enum is what the database and the
    // matcher rely on — so it's checked here rather than trusted.
    const trades = Array.isArray(parsed.trades)
      ? (parsed.trades as string[]).filter((t) => TRADE_KEYS.includes(t as never))
      : [];

    return Response.json({ ...parsed, trades });
  } catch (e) {
    return aiProviderFailure("parse-brief", e);
  }
}
