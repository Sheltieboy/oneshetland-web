import { getEditionBundle } from "@/lib/editions/data.server";
import { buildIcs } from "@/lib/editions/ics";
import { editionPath } from "@/lib/editions/seo";

export const dynamic = "force-dynamic";

/** One calendar file for a whole public Edition: native sessions plus the events its owners have agreed to show. Test, draft and suspended Editions 404 (RLS). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const b = await getEditionBundle((await params).slug);
  if (!b || b.edition.status !== "published" || b.edition.is_test) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  const venueById = new Map(b.venues.map((v) => [v.id, v]));
  const items = [
    ...b.sessions.map((s) => ({ uid: `edition-session-${s.id}`, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at, location: s.venue_id ? [venueById.get(s.venue_id)?.name, venueById.get(s.venue_id)?.address].filter(Boolean).join(", ") : null, description: s.description, url: `${origin}${editionPath(b.edition.slug, "programme")}`, status: s.status })),
    ...b.partners.events.map((e) => ({ uid: `edition-event-${e.event_id}`, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, location: [e.venue, e.locality].filter(Boolean).join(", "), description: e.description, url: `${origin}/whats-on/${e.event_id}`, status: e.status })),
  ];
  return new Response(buildIcs({ name: b.edition.title, items }), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${b.edition.slug}.ics"`, "Cache-Control": "no-store" } });
}
