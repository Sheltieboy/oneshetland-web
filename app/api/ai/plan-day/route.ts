import { askPeerieBot } from "@/lib/plan-ai.server";
import { getPlannerCandidates } from "@/lib/planner-data";
import { schedulePicks, fmtTime, describeLeg, LERWICK, type Interest, type Transport } from "@/lib/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/plan-day — the Peerie Bot plan, fetched AFTER the page has
 * rendered.
 *
 * The page used to await this during its own server render. That is what kept
 * breaking: a 20-second model call inside a page request, plus the account and
 * notification work a signed-in visitor's layout does, and the host kills the
 * whole thing — an error page instead of a day out. Measured at 36s once, and
 * still touching 20s after tuning.
 *
 * So the page now renders the deterministic plan immediately and the browser
 * asks for the better one. Worst case the request here times out and the
 * visitor keeps the plan already on screen; they never see a failure, and no
 * page render ever waits on a model.
 *
 * Two shapes for two callers:
 *   • { date, from, to, transport, interests } — the website. Does the lot
 *     server-side and returns stops ready to render.
 *   • { candidates, ... } — the app, which holds its own candidates.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const from = typeof body.from === "string" ? body.from : "09:00";
  const to = typeof body.to === "string" ? body.to : "17:00";
  const transport: Transport = body.transport === "walking" ? "walking" : "driving";
  const interests = (Array.isArray(body.interests) ? body.interests : []) as Interest[];

  // ── App shape: candidates supplied, picks returned. ──
  if (Array.isArray(body.candidates)) {
    const plan = await askPeerieBot(
      body.candidates.slice(0, 45) as Parameters<typeof askPeerieBot>[0],
      { from, to, transport, interests },
    );
    return plan
      ? Response.json(plan)
      : Response.json({ error: "Peerie Bot isn't available." }, { status: 503 });
  }

  // ── Website shape: a date, and we do the rest. ──
  const date = typeof body.date === "string" ? body.date : null;
  if (!date) return Response.json({ error: "date required" }, { status: 400 });

  const start = new Date(`${date}T${from}:00`);
  const end = new Date(`${date}T${to}:00`);
  if (!(end > start)) return Response.json({ error: "bad window" }, { status: 400 });

  const candidates = await getPlannerCandidates(
    new Date(start.getTime() - 60 * 60000).toISOString(),
    end.toISOString(),
  );

  const { suggestDayOrder } = await import("@/lib/plan-ai.server");
  const suggestion = await suggestDayOrder({ candidates, start, end, transport, interests });
  if (!suggestion) return Response.json({ error: "no plan" }, { status: 503 });

  const byId = new Map(candidates.map((c) => [c.id, c] as const));
  const scheduled = schedulePicks({ order: suggestion.picks, byId, start, end, transport, startPoint: LERWICK });
  // Fewer than two stops isn't a day; let the page keep what it has.
  if (scheduled.stops.length < 2) return Response.json({ error: "too thin" }, { status: 503 });

  // Flattened for rendering — no Date objects over the wire.
  return Response.json({
    title: suggestion.title,
    intro: suggestion.intro,
    stops: scheduled.stops.map((s) => ({
      id: s.candidate.id,
      name: s.candidate.name,
      href: s.candidate.href,
      image: s.candidate.image,
      blurb: s.candidate.blurb,
      kind: s.candidate.kind,
      startsAt: s.candidate.startsAt ?? null,
      arrive: fmtTime(s.arrive),
      depart: fmtTime(s.depart),
      travel: describeLeg(s.travel),
      travelMode: s.travel.mode,
      openKnown: s.openKnown,
      why: s.note ?? null,
      lat: s.candidate.lat,
      lng: s.candidate.lng,
    })),
    skipped: scheduled.skipped,
  });
}
