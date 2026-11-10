import { getMyPlan } from "@/lib/editions/data.server";
import { groupPlan } from "@/lib/editions/plan";
import { buildIcs } from "@/lib/editions/ics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The signed-in visitor's own plan as a calendar file. Signed out gets 401, never someone else's data. */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("Sign in to download your plan", { status: 401 });
  const origin = new URL(req.url).origin;
  const items = groupPlan(await getMyPlan()).flatMap((e) => e.items.map((i) => ({
    uid: `edition-${i.kind}-${i.id}`, title: i.title, starts_at: i.starts_at, ends_at: i.ends_at, location: i.venue,
    url: i.href ? `${origin}${i.href}` : `${origin}/editions/${e.slug}/programme`, status: i.status, description: e.title,
  })));
  return new Response(buildIcs({ name: "My OneShetland plan", items }), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="my-oneshetland-plan.ics"', "Cache-Control": "private, no-store" } });
}
