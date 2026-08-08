import { askPeerieBot } from "@/lib/plan-ai.server";
import { getPlannerCandidates } from "@/lib/planner-data";
import { buildPlan, schedulePicks, fmtTime, describeLeg, LERWICK, type Interest, type Transport } from "@/lib/planner";

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
 * Two shapes:
 *   • { date, from, to, transport, interests } — does the lot server-side and
 *     returns stops ready to render. Used by the website, and by the APP with
 *     allowPlain (see below), so both get the identical day for identical
 *     input rather than two planners drifting apart.
 *   • { candidates, ... } — ordering only, for a caller holding its own
 *     candidates.
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

  /**
   * The website has a deterministic plan ON SCREEN already, so a 503 here is
   * harmless — it keeps what it has. The APP has nothing to keep: it asked
   * cold and a 503 is a blank screen. So the app sends allowPlain and gets the
   * plain planner's day rather than an apology, which is the same safety net
   * the website gets from rendering first, just served from here.
   */
  const allowPlain = body.allowPlain === true;

  const { suggestDayOrder } = await import("@/lib/plan-ai.server");
  const suggestion = await suggestDayOrder({ candidates, start, end, transport, interests });

  const byId = new Map(candidates.map((c) => [c.id, c] as const));
  const scheduled = suggestion
    ? schedulePicks({ order: suggestion.picks, byId, start, end, transport, startPoint: LERWICK })
    : null;

  // Fewer than two stops isn't a day.
  const usable = scheduled && scheduled.stops.length >= 2 ? scheduled : null;

  if (!usable && !allowPlain) {
    return Response.json({ error: suggestion ? "too thin" : "no plan" }, { status: 503 });
  }

  const plan = usable ?? buildPlan({ candidates, start, end, transport, interests, startPoint: LERWICK });
  if (plan.stops.length === 0) return Response.json({ error: "nothing fits" }, { status: 503 });

  // Flattened for rendering — no Date objects over the wire.
  return Response.json({
    by: usable ? "peerie" : "plain",
    title: usable ? suggestion!.title : "Your day",
    intro: usable ? suggestion!.intro : null,
    stops: plan.stops.map((s) => ({
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
    skipped: plan.skipped,
  });
}
