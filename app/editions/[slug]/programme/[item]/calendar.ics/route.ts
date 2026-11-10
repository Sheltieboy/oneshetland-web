import { getEditionBundle } from "@/lib/editions/data.server";
import { buildIcs } from "@/lib/editions/ics";
import { itemKey, slugWords } from "@/lib/editions/session-url";

export const dynamic = "force-dynamic";

/** One programme item as a calendar file. Test, draft and suspended Editions 404 (RLS), exactly like the whole-Edition file. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; item: string }> }) {
  const { slug, item } = await params;
  const b = await getEditionBundle(slug);
  if (!b || b.edition.status !== "published" || b.edition.is_test) return new Response("Not found", { status: 404 });
  const key = /(?:^|-)([0-9a-f]{8})$/.exec(item)?.[1];
  const s = key ? b.sessions.find((x) => itemKey(x.id) === key) : undefined;
  const e = key && !s ? b.partners.events.find((x) => itemKey(x.link_id) === key) : undefined;
  if (!s && !e) return new Response("Not found", { status: 404 });
  const venue = s?.venue_id ? b.venues.find((v) => v.id === s.venue_id) : undefined;
  const origin = new URL(req.url).origin;
  const it = s
    ? { uid: `edition-session-${s.id}`, title: s.title, starts_at: s.starts_at, ends_at: s.ends_at, location: [venue?.name, venue?.address].filter(Boolean).join(", "), description: s.description ?? "", url: `${origin}/editions/${slug}/programme/${item}`, status: s.status }
    : { uid: `edition-event-${e!.event_id}`, title: e!.title, starts_at: e!.starts_at, ends_at: e!.ends_at, location: [e!.venue, e!.locality].filter(Boolean).join(", "), description: e!.description ?? "", url: `${origin}/whats-on/${e!.event_id}`, status: e!.status };
  return new Response(buildIcs({ name: b.edition.title, items: [it] }), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${slugWords(it.title)}.ics"`, "Cache-Control": "no-store" } });
}
