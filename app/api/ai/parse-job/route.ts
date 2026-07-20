import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/parse-job  { text: string }
 *
 * Peerie Bot's job parser. Turns an employer's plain-English description of a
 * vacancy into the Post-a-job form's fields — title, a well-written job
 * description, sector, contract type, working pattern, location, pay, and
 * relocation/housing/seasonal flags. Key stays server-side; the client reviews
 * before posting. Mirrors /api/ai/parse-shift.
 */

const JOB_CATEGORIES = [
  "Hospitality", "Maritime", "Aquaculture", "Energy", "Care", "Health",
  "Retail", "Trades", "Construction", "Tourism", "Education", "Public sector",
  "Office & admin", "Transport", "Crofting", "Other",
];
const CONTRACT_TYPES = ["full-time", "part-time", "casual", "apprenticeship", "volunteer", "freelance"];
const REMOTE_MODES = ["on_site", "hybrid", "remote"];
const PAY_PERIODS = ["hour", "day", "week", "month", "year"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Job title, e.g. \"Sous Chef\". \"\" if not derivable." },
    description: { type: "string", description: "An appealing, well-structured job description written from ONLY the facts given (role, responsibilities, who they want). Do not invent duties, pay, or requirements. \"\" if nothing to say." },
    category: { type: "string", enum: [...JOB_CATEGORIES, ""], description: "Best-fit sector, or \"\" if unclear." },
    contract_type: { type: "string", enum: [...CONTRACT_TYPES], description: "Default \"full-time\" unless another is stated." },
    remote_mode: { type: "string", enum: [...REMOTE_MODES], description: "Default \"on_site\" unless remote/hybrid is stated." },
    location: { type: "string", description: "Where the job is (town/area), else \"\"." },
    pay_hidden: { type: "boolean", description: "true if pay is described only vaguely (e.g. \"competitive\", \"DOE\") or not given as numbers; false if a numeric salary/rate is stated." },
    pay_min: { type: "number", description: "Lower pay figure if a number/range is given, else 0." },
    pay_max: { type: "number", description: "Upper pay figure if a range is given (else same as pay_min, or 0)." },
    pay_period: { type: "string", enum: [...PAY_PERIODS], description: "Unit for the pay figures. Default \"year\" for salaries, \"hour\" for hourly rates." },
    pay_text: { type: "string", description: "The vague pay wording when pay_hidden is true (e.g. \"Competitive, DOE\"), else \"\"." },
    relocation_support: { type: "boolean", description: "true only if relocation support is stated." },
    housing_available: { type: "boolean", description: "true only if housing/accommodation is offered." },
    is_seasonal: { type: "boolean", description: "true only if it's a seasonal role." },
    season_label: { type: "string", description: "e.g. \"Summer 2026\" if seasonal and stated, else \"\"." },
    apply_url: { type: "string", description: "Application URL if given, else \"\"." },
    apply_email: { type: "string", description: "Application email if given, else \"\"." },
  },
  required: [
    "title", "description", "category", "contract_type", "remote_mode", "location",
    "pay_hidden", "pay_min", "pay_max", "pay_period", "pay_text",
    "relocation_support", "housing_available", "is_seasonal", "season_label",
    "apply_url", "apply_email",
  ],
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
    return Response.json({ error: "Tell Peerie Bot a wee bit more about the job." }, { status: 400 });
  }

  const now = new Date();
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  const system =
    `You are Peerie Bot, the OneShetland assistant. Extract structured details from an employer's plain-English description of a job vacancy and fill the Post-a-job form.\n` +
    `Today is ${todayISO} (Shetland time) — use it to phrase any seasonal label.\n` +
    `Rules: only use facts the employer states — never invent duties, pay, or benefits. Leave anything not mentioned as an empty string "" (0 for pay figures, false for the flags). Default contract_type "full-time", remote_mode "on_site", pay_period "year" (or "hour" for an hourly rate). If pay is only described vaguely (e.g. "competitive", "DOE") set pay_hidden true and put the wording in pay_text. Write the description to read well and attract applicants, using only the given facts — a few short paragraphs is ideal.`;

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
    console.error("[parse-job] Peerie Bot error:", e);
    return Response.json({ error: "Peerie Bot had a hiccup — please try again." }, { status: 502 });
  }
}
