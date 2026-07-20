import Anthropic from "@anthropic-ai/sdk";
import { EVENT_CATEGORIES } from "@/lib/events-data";

// The Anthropic SDK needs the Node runtime (not edge). Keep the key server-side.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/parse-event  { text: string }
 *
 * Peerie Bot's event parser. Turns a plain-English description of an event into
 * the structured fields the New Event form uses — title, an appealing
 * description, category, start/end/doors times (resolved against today's date,
 * Shetland time), venue, tickets, etc. The ANTHROPIC_API_KEY stays on the
 * server. Returns the fields as JSON; the client reviews before publishing.
 */

const AGE_RESTRICTIONS = ["All ages", "12+", "16+", "18+", "Under 18 only"];

// Structured-outputs schema. Absence is represented with "" (empty string) and
// [] rather than null — the validator rejects union types like ["string","null"]
// alongside an enum. The client treats empty values as "leave that field".
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short, punchy event title. \"\" if not derivable." },
    description: {
      type: "string",
      description: "An appealing 2–3 sentence description written from ONLY the facts given. Do not invent lineup, prices, or details not provided. \"\" if nothing to say.",
    },
    category: { type: "string", enum: [...EVENT_CATEGORIES, ""], description: "Best-fit category, or \"\" if unclear." },
    starts_at: { type: "string", description: "Local Shetland start, format YYYY-MM-DDTHH:mm (24h), or \"\"." },
    ends_at: { type: "string", description: "Local end in the same format, or \"\". Must be after starts_at — a midnight/early-hours end is the FOLLOWING day." },
    doors_open_at: { type: "string", description: "Local doors-open time in the same format, or \"\"." },
    venue: { type: "string", description: "Venue name if named (e.g. Mareel), else \"\"." },
    area: { type: "string", description: "Town/area if given (e.g. Lerwick), else \"\"." },
    age_restriction: {
      type: "string",
      enum: [...AGE_RESTRICTIONS],
      description: "Entry age policy; \"All ages\" if none stated. An under-18 TICKET type is NOT an age restriction.",
    },
    ticket_mode: { type: "string", enum: ["none", "oneshetland", "external"], description: "\"oneshetland\" if selling via the platform; \"external\" if linking their own site; else \"none\"." },
    ticket_url: { type: "string", description: "External ticket URL if they link their own site, else \"\"." },
    tickets: {
      type: "array",
      description: "One entry per ticket type when selling via OneShetland. [] if none/free/external.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          price_gbp: { type: "number", description: "Price in pounds (0 for free)." },
        },
        required: ["name", "price_gbp"],
      },
    },
    contact_info: { type: "string", description: "Contact email/phone if given, else \"\"." },
    notes: { type: "string", description: "Any extra practical notes for attendees, else \"\"." },
  },
  required: [
    "title", "description", "category", "starts_at", "ends_at", "doors_open_at",
    "venue", "area", "age_restriction", "ticket_mode", "ticket_url", "tickets",
    "contact_info", "notes",
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
    return Response.json({ error: "Tell Peerie Bot a wee bit more about your event." }, { status: 400 });
  }

  // Today's date in Shetland time, so relative dates ("Saturday 23rd August") resolve correctly.
  const now = new Date();
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(now);

  const system =
    `You are Peerie Bot, the OneShetland assistant. Extract structured event details from an organiser's plain-English description and fill the New Event form.\n` +
    `Today is ${weekday} ${todayISO} (Europe/London, Shetland time). Resolve relative dates against today; a date with no year is the NEXT future occurrence. Times are local 24h wall-clock in the format YYYY-MM-DDTHH:mm.\n` +
    `Rules: only use facts stated by the organiser — never invent a lineup, prices, venue, or times. Leave anything not mentioned as an empty string "" (or [] for tickets), and age_restriction as "All ages" unless an entry age policy is stated. Write the description to read well and sell the event, using only the given facts. If they say they sell tickets via OneShetland, set ticket_mode "oneshetland" and list each ticket type with its price in pounds. "Midnight"/"12am" as an end time is the following day.`;

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
    const data = JSON.parse(block.text);
    return Response.json(data);
  } catch (e) {
    console.error("[parse-event] Peerie Bot error:", e);
    // `detail` is a temporary diagnostic (not shown in the UI) so we can read
    // the real Anthropic error via the public endpoint. Remove once fixed.
    const detail =
      e instanceof Anthropic.APIError
        ? `${e.status} ${e.name}: ${e.message}`
        : e instanceof Error
          ? `${e.name}: ${e.message}`
          : String(e);
    return Response.json({ error: "Peerie Bot had a hiccup — please try again.", detail }, { status: 502 });
  }
}
