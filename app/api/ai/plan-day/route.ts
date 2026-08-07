import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/plan-day
 *
 * Peerie Bot CHOOSES and ORDERS the stops; it never sets a time.
 *
 * The split matters. The first version scored candidates on "matches your
 * interests, nearby, probably open" and produced a chippy, a takeaway, a curry
 * house and a bar back to back — every one a good answer to the question being
 * asked, and a daft day out. That judgement (a day has a shape; you eat once;
 * you don't want four of the same thing) is exactly what a model is good at
 * and a scoring function is bad at.
 *
 * What it must NOT do is arithmetic. Arrival times, travel legs and opening
 * hours stay in lib/planner.ts, because a planner that's charming and wrong
 * about when the ferry goes is worse than a plain one that's right. The route
 * returns an ORDER; the scheduler decides whether that order actually fits and
 * drops anything that doesn't.
 *
 * Body: { window, transport, interests, candidates: [...] }
 * Returns: { title, intro, picks: [{ id, why }] }
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A short, warm name for the day, e.g. \"A day round the south end\". No exclamation marks." },
    intro: { type: "string", description: "One or two sentences on the shape of the day and why it hangs together. Plain English, no dialect." },
    picks: {
      type: "array",
      description: "The chosen stops IN ORDER, 3–6 of them. Use only ids given to you.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Exactly one of the candidate ids provided." },
          why: { type: "string", description: "One short line on why it's here and at this point in the day. Facts from the candidate only." },
        },
        required: ["id", "why"],
      },
    },
  },
  required: ["title", "intro", "picks"],
} as const;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Not an error the visitor should ever see — the caller falls back to the
    // deterministic planner and the page still works.
    return Response.json({ error: "Peerie Bot isn't switched on." }, { status: 503 });
  }

  let body: {
    from?: string; to?: string; transport?: string; interests?: string[];
    candidates?: Array<Record<string, unknown>>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 45) : [];
  if (candidates.length === 0) return Response.json({ error: "No candidates." }, { status: 400 });

  const system =
    `You are Peerie Bot, planning a day in Shetland for a visitor. You are choosing WHICH stops and in WHAT ORDER. ` +
    `You never state times — the app works those out and will drop anything that doesn't fit.\n\n` +
    `What makes a good day:\n` +
    `• A shape. Something to see, somewhere to eat, something to take home — not four of the same kind in a row.\n` +
    `• ONE meal, at a mealtime. Two only if the window spans both lunch and dinner. Never a takeaway and a restaurant and a bar in a row.\n` +
    `• Geography that makes sense. Work outward and back, or along in one direction; don't criss-cross the isles.\n` +
    `• Events are fixed and can't be moved, so build the rest of the day around any you include.\n` +
    `• A short window means fewer stops. Three good ones beat six rushed ones. Never more than six.\n` +
    `• Prefer places that match what they said they're after. If they said nothing, give a spread.\n\n` +
    `Only ever use the candidate ids given. Never invent a place, and never claim anything about a place ` +
    `beyond what its description says — no opening times, no prices, no "famous for" unless it's written there.`;

  const user =
    `Window: ${body.from} to ${body.to}. Getting about: ${body.transport === "walking" ? "on foot" : "by car"}.\n` +
    `They're interested in: ${(body.interests ?? []).join(", ") || "anything"}.\n\n` +
    `Candidates:\n${JSON.stringify(candidates, null, 1)}`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });

    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return Response.json({ error: "No plan came back." }, { status: 502 });
    return Response.json(JSON.parse(block.text));
  } catch (e) {
    console.error("[plan-day] Peerie Bot error:", e);
    return Response.json({ error: "Peerie Bot had a hiccup." }, { status: 502 });
  }
}
