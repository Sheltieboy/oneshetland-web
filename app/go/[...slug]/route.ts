import { NextRequest, NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase/public";

/**
 * /go/* — clean short links for social posts.
 *
 * Captions show `oneshetland.com/go/spik` instead of a UTM-encrusted URL. The
 * redirect (1) server-logs a `social_link_clicked` analytics event — so every
 * click shows in /admin/analytics regardless of the consent banner (it's an
 * anonymous counter, no cookies, no PII) — and (2) forwards to the real page
 * WITH the utm params attached, so any client-side attribution still works.
 *
 *   /go/spik         → /spik      (campaign wird_o_da_day)
 *   /go/whats-on     → /whats-on  (campaign whats_on_roundup)
 *   /go/jobs         → /jobs      (campaign jobs_roundup)
 *   /go/event/<id>   → /whats-on/<id> (campaign event_spotlight)
 */

export const dynamic = "force-dynamic";

const ROUTES: Record<string, { path: string; campaign: string }> = {
  spik: { path: "/spik", campaign: "wird_o_da_day" },
  "whats-on": { path: "/whats-on", campaign: "whats_on_roundup" },
  jobs: { path: "/jobs", campaign: "jobs_roundup" },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const [head, id] = slug ?? [];

  let path = "/";
  let campaign = "unknown";
  let objectId: string | undefined;
  if (head === "event" && id) {
    path = `/whats-on/${id}`;
    campaign = "event_spotlight";
    objectId = id;
  } else if (head === "product" && id) {
    path = `/product/${id}`;
    campaign = "new_product";
    objectId = id;
  } else if (head && ROUTES[head]) {
    path = ROUTES[head].path;
    campaign = ROUTES[head].campaign;
  }

  // Anonymous server-side click count — no cookies, no PII, just "a social
  // link was followed". Never block the redirect on it.
  try {
    await publicClient().rpc("log_events", {
      p_events: [{
        event_name: "social_link_clicked",
        anon_id: "social-redirect",
        session_id: "social-redirect",
        platform: "web",
        user_type: "visitor",
        object_type: objectId ? "event" : "page",
        object_id: objectId ?? path,
        props: { campaign, channel: "facebook", slug: (slug ?? []).join("/") },
        consent: true,
      }],
    });
  } catch { /* analytics must never break the redirect */ }

  const dest = new URL(path, req.nextUrl.origin);
  dest.searchParams.set("utm_source", "facebook");
  dest.searchParams.set("utm_medium", "social");
  dest.searchParams.set("utm_campaign", campaign);
  return NextResponse.redirect(dest, 302);
}
