import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ActivityImageError, ACTIVITY_IMAGE_MAX_BYTES } from "@/lib/activity-image";
import { dropPhoto, savePhoto, type ActivityRow, type PhotoClient } from "@/lib/activity-image-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An activity's main photograph. Every step runs as the SIGNED-IN person: the manage check (`can_manage_activity`), the storage write (the
 * bucket's own policy re-checks business owner / hub admin / the person's own folder) and the cover_url update (row security). No service key is
 * used, so a request that is not allowed is refused by the database as well as by this code. Only cover_url is ever changed: not the schedule,
 * publishing, following or notifications. Unknown and not-yours both answer "not found", so a draft's existence is never revealed.
 */
async function gate(id: string) {
  if (!UUID.test(id)) return { res: json({ error: "Activity not found." }, 404) } as const;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { res: json({ error: "Please sign in." }, 401) } as const;
  const { data: can } = await sb.rpc("can_manage_activity", { p_activity: id });
  if (can !== true) return { res: json({ error: "Activity not found." }, 404) } as const;
  const { data: a } = await sb.from("regular_activities").select("id, organiser_business_id, organiser_hub_id, is_platform_activity, cover_url").eq("id", id).maybeSingle();
  if (!a) return { res: json({ error: "Activity not found." }, 404) } as const;
  const client: PhotoClient = {
    storage: sb.storage as unknown as PhotoClient["storage"],
    setCover: async (activityId, url) => {
      const { data, error } = await sb.from("regular_activities").update({ cover_url: url }).eq("id", activityId).select("id");
      return { changed: data?.length ?? 0, error };
    },
  };
  return { client, uid: user.id, a: a as ActivityRow } as const;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate((await ctx.params).id);
  if ("res" in g) return g.res;
  if (Number(req.headers.get("content-length") ?? 0) > ACTIVITY_IMAGE_MAX_BYTES + 64 * 1024) return json({ error: "That photo is over 5 MB. Choose a smaller one." }, 413);
  let file: File | null = null;
  try { const f = (await req.formData()).get("file"); file = f instanceof File ? f : null; } catch { /* handled below */ }
  if (!file) return json({ error: "Choose a photo to upload." }, 400);
  try {
    return json(await savePhoto(g.client, g.uid, g.a, new Uint8Array(await file.arrayBuffer()), crypto.randomUUID()));
  } catch (e) {
    if (e instanceof ActivityImageError) return json({ error: e.message }, e.status);
    return json({ error: "The photo could not be saved. Please try again." }, 500);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate((await ctx.params).id);
  if ("res" in g) return g.res;
  try { await dropPhoto(g.client, g.a); return json({ cover_url: null }); }
  catch (e) { return e instanceof ActivityImageError ? json({ error: e.message }, e.status) : json({ error: "The photo could not be removed. Please try again." }, 500); }
}
