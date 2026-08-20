import Anthropic from "@anthropic-ai/sdk";
import { guardAi, aiProviderFailure } from "@/lib/ai-guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/draft-product  { business_id, rough: string }
 *
 * Peerie Bot turns a merchant's rough line ("aran gansey, shetland wool,
 * s to xl, £85") into a draft product listing: title, description, price,
 * category, variant suggestions. Only from what the merchant said — never
 * invents materials, provenance or claims. Owner-gated; draft only, the
 * merchant reviews before saving.
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short, buyer-facing product title (max 80 chars). No ALL CAPS." },
    description: { type: "string", description: "2–4 warm, plain-English sentences selling the product using ONLY facts the merchant gave. Never invent materials, sizes, provenance or claims." },
    price_pence: { type: "integer", description: "Price in pence if the merchant stated one, else a sensible placeholder of 0 (merchant must fill it in)." },
    category: { type: "string", enum: ["knitwear", "craft", "art", "food_drink", "home", "beauty", "outdoor", "books_music", "other"] },
    variants: { type: "array", items: { type: "string" }, description: "Variant names ONLY if the merchant implied options (e.g. ['Small','Medium','Large'] from 's to xl'). Empty array if none." },
  },
  required: ["title", "description", "price_pence", "category", "variants"],
} as const;

export async function POST(request: Request) {
  // Signed in, sized, and inside quota. This route already checked the session
  // and the owner; what it lacked was any bound on `rough` and any ceiling on
  // how often one account could call it.
  const gate = await guardAi(request, { route: "draft-product", maxBodyBytes: 16_000, maxFieldChars: 4_000 });
  if (!gate.ok) return gate.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Peerie Bot isn't switched on yet (missing API key)." }, { status: 503 });

  const businessId = String(gate.body.business_id ?? "");
  const rough = String(gate.body.rough ?? "").trim();
  if (!businessId || !rough) return Response.json({ error: "Tell Peerie Bot a bit about the product first." }, { status: 400 });

  // Authentication is not authorisation: only the owner of THIS business (or an
  // admin) may draft for it, or one signed-in user could read another's
  // business name into a prompt.
  const sb = gate.supabase;
  const user = gate.user;
  const { data: biz } = await sb.from("local_businesses").select("id, name, owner_id").eq("id", businessId).maybeSingle();
  if (!biz) return Response.json({ error: "Business not found." }, { status: 404 });
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (biz.owner_id !== user.id && profile?.role !== "admin") {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 900,
      system:
        "You draft product listings for Shetland businesses selling on OneShetland. Voice: warm, plain-spoken standard English — no marketing fluff, no invented facts. " +
        "Write ONLY from what the merchant tells you. If they didn't state a material, origin or size, don't claim one. Prices in PENCE (e.g. £85 → 8500); if no price given, return 0.",
      tools: [{ name: "draft_product", description: "Return the drafted product listing.", input_schema: SCHEMA as never }],
      tool_choice: { type: "tool", name: "draft_product" },
      messages: [{ role: "user", content: `Business: ${biz.name}\nMerchant's rough notes:\n${rough}` }],
    });
    const tool = msg.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no tool output");
    return Response.json({ draft: tool.input });
  } catch (err) {
    return aiProviderFailure("draft-product", err);
  }
}
