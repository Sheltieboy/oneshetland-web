import { askPeerieBot } from "@/lib/plan-ai.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/plan-day — a thin wrapper over lib/plan-ai.server.ts, for the
 * APP to post to. The website calls that function directly instead: a server
 * component fetching its own API route is a wasted trip through the CDN to
 * reach code in the same process, and depending on a base-URL env var is how
 * the AI half ended up silently dead in production.
 *
 * Body: { from, to, transport, interests, candidates }
 * Returns: { title, intro, picks } or 503 when Peerie Bot isn't switched on.
 */
export async function POST(request: Request) {
  let body: {
    from?: string; to?: string; transport?: string;
    interests?: string[]; candidates?: Parameters<typeof askPeerieBot>[0];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 45) : [];
  if (candidates.length === 0) return Response.json({ error: "No candidates." }, { status: 400 });

  const plan = await askPeerieBot(candidates, {
    from: body.from ?? "09:00",
    to: body.to ?? "17:00",
    transport: body.transport ?? "driving",
    interests: Array.isArray(body.interests) ? body.interests : [],
  });

  if (!plan) return Response.json({ error: "Peerie Bot isn't available." }, { status: 503 });
  return Response.json(plan);
}
