import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/parse-shift  { text: string }
 *
 * Peerie Bot's shift parser. Turns an employer's plain-English description of a
 * shift into the Post-a-shift form's fields — title, work type, location,
 * start/end (resolved against today, Shetland time), pay, positions, urgency,
 * requirements and a tidy details paragraph. Key stays server-side; the client
 * reviews before posting. Mirrors /api/ai/parse-event.
 */

const SHIFT_CATEGORIES = [
  "hospitality", "maritime", "oil_gas", "aquaculture", "crofting", "care",
  "events", "retail", "driving", "trades", "education", "tourism",
];
const PAY_TYPES = ["hourly", "fixed", "negotiable", "discuss", "volunteer"];
const URGENCIES = ["asap", "today", "this_week", "planned"];
const REQUIREMENTS = [
  "Driving licence", "Food hygiene cert", "STCW", "PVG", "First aid",
  "Over 18", "Own transport", "Manual handling",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short shift title, e.g. \"Bar staff for the weekend\". \"\" if not derivable." },
    category: { type: "string", enum: [...SHIFT_CATEGORIES, ""], description: "Best-fit work type key, or \"\" if unclear." },
    location: { type: "string", description: "Where the work is (venue and/or town, e.g. \"The Lounge, Lerwick\"), else \"\"." },
    starts_at: { type: "string", description: "Local Shetland start, format YYYY-MM-DDTHH:mm (24h), or \"\"." },
    ends_at: { type: "string", description: "Local end in the same format, or \"\". After starts_at — a midnight/early-hours end is the FOLLOWING day." },
    pay_type: { type: "string", enum: [...PAY_TYPES], description: "\"hourly\" or \"fixed\" if an amount is given; \"negotiable\"/\"discuss\" if unspecified; \"volunteer\" if unpaid. Default \"hourly\"." },
    pay_amount: { type: "number", description: "Pounds — per hour if hourly, total if fixed. 0 if not stated or not applicable." },
    positions: { type: "integer", description: "How many people are needed. 1 if not stated." },
    urgency: { type: "string", enum: [...URGENCIES], description: "\"asap\" if urgent, \"today\" if today, \"this_week\" if within about a week, else \"planned\". Default \"this_week\"." },
    requirements: {
      type: "array",
      description: "Only requirements the employer clearly states. [] if none.",
      items: { type: "string", enum: [...REQUIREMENTS] },
    },
    description: { type: "string", description: "A tidy \"anything else workers should know\" paragraph from ONLY the given facts. \"\" if nothing extra." },
  },
  required: ["title", "category", "location", "starts_at", "ends_at", "pay_type", "pay_amount", "positions", "urgency", "requirements", "description"],
} as const;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });
  }

  let text = "";
  try {
    ({ text } = await request.json());
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!text || typeof text !== "string" || text.trim().length < 8) {
    return Response.json({ error: "Tell Peerie Bot a wee bit more about the shift." }, { status: 400 });
  }

  const now = new Date();
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(now);

  const system =
    `You are Peerie Bot, the OneShetland assistant. Extract structured details from an employer's plain-English description of a work shift and fill the Post-a-shift form.\n` +
    `Today is ${weekday} ${todayISO} (Europe/London, Shetland time). Resolve relative dates against today; a date with no year is the NEXT future occurrence. Times are local 24h wall-clock in the format YYYY-MM-DDTHH:mm.\n` +
    `Rules: only use facts the employer states — never invent pay, times, location, or requirements. Leave anything not mentioned as an empty string "" (or [] for requirements, 0 for pay_amount, 1 for positions). "Midnight"/"12am" as an end time is the following day. If they give a per-hour rate use pay_type "hourly"; a total/fixed fee use "fixed"; unpaid use "volunteer". Write the description from only the given facts.`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: text.slice(0, 4000) }],
    });

    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return Response.json({ error: "Peerie Bot couldn't read that — try rephrasing." }, { status: 502 });
    return Response.json(JSON.parse(block.text));
  } catch (e) {
    console.error("[parse-shift] Peerie Bot error:", e);
    return Response.json({ error: "Peerie Bot had a hiccup — please try again." }, { status: 502 });
  }
}
