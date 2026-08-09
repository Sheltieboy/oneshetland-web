import { findMatches } from "@/lib/trades-data";
import { isTradeKey, type Scale, type TradeKey, type Urgency } from "@/lib/trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/trades/match — who could take this on, live, as the job is typed.
 *
 * Deliberately returns no contact details and no brief: it's the SHAPE of a
 * job in, and public directory facts out. Anyone can call it, because
 * everything it returns is already on the business's own listing.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const trades = (Array.isArray(body.trades) ? body.trades : []).filter(isTradeKey) as TradeKey[];
  if (trades.length === 0) return Response.json({ matches: [] });

  const urgency = (body.urgency ?? "flexible") as Urgency;
  const scale = (body.scale ?? "unsure") as Scale;

  const matches = await findMatches({
    trades,
    urgency,
    scale,
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    limit: 8,
  });

  return Response.json({ matches });
}
