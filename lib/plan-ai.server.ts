import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import type { Candidate, Interest, Transport } from "@/lib/planner";
import { fmtTime, shortlistForModel } from "@/lib/planner";

/**
 * Peerie Bot's part of the day planner: choosing WHICH stops and IN WHAT
 * ORDER. It never states a time — lib/planner.ts computes those and decides
 * whether the order actually fits.
 *
 * A plain server function, not an HTTP call. The page used to fetch its own
 * API route through `NEXT_PUBLIC_SITE_URL`, which isn't set on Netlify, so in
 * production it dialled localhost, failed, and silently fell back to the
 * deterministic planner — the AI half was dead on the live site while working
 * perfectly when the route was called directly. A server component calling its
 * own API over the network was never the right shape anyway: it's a wasted
 * round trip through the CDN to reach code in the same process.
 *
 * The API route still exists as a thin wrapper, because the app needs an
 * endpoint it can post to.
 */

export type DaySuggestion = {
  title: string;
  intro: string;
  picks: { id: string; why: string }[];
};

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

const SYSTEM =
  `You are Peerie Bot, planning a day in Shetland for a visitor. You are choosing WHICH stops and in WHAT ORDER. ` +
  `You never state times — the app works those out and will drop anything that doesn't fit.\n\n` +
  `What makes a good day:\n` +
  `• A shape. Something to see, somewhere to eat, something to take home — not four of the same kind in a row.\n` +
  `• ONE meal, at a mealtime. Two only if the window spans both lunch and dinner. Never a takeaway and a restaurant and a bar in a row.\n` +
  `• Geography that makes sense. Work outward and back, or along in one direction; don't criss-cross the isles.\n` +
  `• Events are fixed and can't be moved, so build the rest of the day around any you include.\n` +
  `• A short window means fewer stops. Three good ones beat six rushed ones. Never more than six.\n` +
  `• Prefer places that match what they said they're after. If they said nothing, give a spread.\n\n` +
  `Some candidates carry extra context: whatItIs (one line from the owner or from us), typicalVisit (how long ` +
  `folk spend), setting (indoors or out), goodFor (families, a wet day, a quick stop…) and booking. Use it — ` +
  `it is far better ground for a decision than the category. Treat whatItIs as a CLAIM by whoever wrote it, ` +
  `not a verified fact: repeat it if useful, never embellish it.\n\n` +
  `Only ever use the candidate ids given. Never invent a place, and never claim anything about a place ` +
  `beyond what its description says — no opening times, no prices, no "famous for" unless it's written there.`;

/**
 * The shape sent to the model: no coordinates, no internal fields.
 *
 * Trimming is done by shortlistForModel, NOT a plain slice — see the note
 * there. A slice took the newest 45, which were almost all cafés, and left
 * Peerie Bot unable to suggest a museum because it had never seen one.
 */
export function toModelCandidates(candidates: Candidate[], interests: Interest[] = [], limit = 45) {
  return shortlistForModel(candidates, { limit, interests }).map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    what: c.category ?? null,
    about: c.blurb ? c.blurb.slice(0, 180) : null,
    startsAt: c.startsAt ?? null,
    endsAt: c.endsAt ?? null,
    // Planner context, where anyone has given it. This is the difference
    // between the model reasoning from a category and reasoning from what the
    // place actually is.
    whatItIs: c.note ?? null,
    typicalVisit: c.dwell ? `${c.dwell} min` : null,
    setting: c.setting ?? null,
    goodFor: c.goodFor?.length ? c.goodFor : null,
    booking: c.booking && c.booking !== "none" ? c.booking : null,
  }));
}

/**
 * Returns null on ANY failure — missing key, timeout, bad JSON. Callers fall
 * back to the deterministic planner, so a visitor always gets a day.
 */
/**
 * The raw call, taking candidates already flattened to the model's shape.
 * Shared by the page (via suggestDayOrder) and the API route the app posts to.
 */
export async function askPeerieBot(
  modelCandidates: ReturnType<typeof toModelCandidates>,
  meta: { from: string; to: string; transport: string; interests: string[] },
): Promise<DaySuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || modelCandidates.length === 0) return null;

  const user =
    `Window: ${meta.from} to ${meta.to}. ` +
    `Getting about: ${meta.transport === "walking" ? "on foot" : "by car"}.\n` +
    `They're interested in: ${meta.interests.join(", ") || "anything"}.\n\n` +
    `Candidates:\n${JSON.stringify(modelCandidates, null, 1)}`;

  try {
    // NO RETRIES, and a budget well inside the host's limit.
    //
    // This was `timeout: 18000, maxRetries: 1`, which sounds cautious and
    // isn't: a slow call waited 18s, retried, waited another 18s, and the
    // platform killed the request at 36s — a 500 and an error page, when the
    // whole point of the fallback is that the visitor always gets a day.
    // Measured in production: exactly 36.15s to the error page.
    //
    // One attempt, 20 seconds. 12s was too tight — measured on production,
    // five calls in six were timing out at 12.7s while a 15.6s call returned
    // fine, so the host's ceiling is comfortably above that and the budget was
    // throwing away good answers. 36s is known to be fatal; 20 leaves room.
    const client = new Anthropic({ apiKey, timeout: 20000, maxRetries: 0 });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      // No extended thinking here, unlike the form-parsing routes. This is a
      // selection task against an explicit set of rules, not something needing
      // deliberation, and thinking was the bulk of the latency that had five
      // calls in six timing out. The scheduler validates the answer anyway.
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    const block = resp.content.find((b) => b.type === "text") as { text: string } | undefined;
    if (!block) return null;
    const data = JSON.parse(block.text) as DaySuggestion;
    return Array.isArray(data?.picks) && data.picks.length > 0 ? data : null;
  } catch (e) {
    console.error("[plan-day] Peerie Bot error:", e);
    return null;
  }
}

/**
 * Returns null on ANY failure — missing key, timeout, bad JSON. Callers fall
 * back to the deterministic planner, so a visitor always gets a day.
 */
const cachedAsk = unstable_cache(
  async (payload: string): Promise<DaySuggestion> => {
    const { candidates, meta } = JSON.parse(payload);
    const result = await askPeerieBot(candidates, meta);
    // THROW on failure rather than return null: unstable_cache stores whatever
    // resolves, so returning null here would cache the FAILURE for six hours
    // and pin every visitor to the plain planner for that query. A throw isn't
    // cached, so the next request tries again.
    if (!result) throw new Error("no-plan");
    return result;
  },
  ["peerie-plan-day"],
  // Long enough that a link you send someone gives them the SAME day, short
  // enough that a new event shows up the same day it's added.
  { revalidate: 60 * 60 * 6 },
);

/**
 * Returns null on ANY failure — missing key, timeout, bad JSON. Callers fall
 * back to the deterministic planner, so a visitor always gets a day.
 *
 * Cached on the request, which matters for more than speed: the plan is meant
 * to be a URL you can send to whoever you're travelling with, and an uncached
 * model call made the same link produce a different day every time it was
 * opened. It also means a slow call is paid for once, not by every visitor.
 */
export async function suggestDayOrder(input: {
  candidates: Candidate[];
  start: Date;
  end: Date;
  transport: Transport;
  interests: Interest[];
}): Promise<DaySuggestion | null> {
  const payload = JSON.stringify({
    // 30, not 45: fewer candidates is a materially faster call, and the
    // shortlist is balanced by category so 30 still covers every kind.
    candidates: toModelCandidates(input.candidates, input.interests, 30),
    meta: {
      from: fmtTime(input.start),
      to: fmtTime(input.end),
      transport: input.transport,
      interests: [...input.interests].sort(),
    },
  });
  try {
    return await cachedAsk(payload);
  } catch {
    return null; // fall back to the deterministic planner
  }
}
