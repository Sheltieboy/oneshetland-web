import { AdminHeader } from "@/components/admin/AdminUI";
import { ActivitiesAdmin, type AdminActivity } from "@/components/admin/ActivitiesAdmin";
import type { QueueStatus } from "@/lib/activities";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sb = await createClient();
  // The follower-alert queue: a failed read just shows "status unavailable"; it must never hide the page.
  const queue: QueueStatus | null = await Promise.resolve(sb.rpc("admin_activity_notice_status")).then((r) => (r.error ? null : (r.data as QueueStatus))).catch(() => null);
  const { data } = await sb.from("regular_activities")
    .select("id, slug, title, category, status, admin_paused, admin_pause_reason, calendar_approved, organiser_business_id, organiser_hub_id, is_platform_activity")
    .order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { organiser_business_id: string | null; organiser_hub_id: string | null; is_platform_activity: boolean }[];
  const hubIds = [...new Set(rows.map((r) => r.organiser_hub_id).filter(Boolean))] as string[];
  const bizIds = [...new Set(rows.map((r) => r.organiser_business_id).filter(Boolean))] as string[];
  const [hubs, biz] = await Promise.all([
    hubIds.length ? sb.from("hubs").select("id, name").in("id", hubIds) : Promise.resolve({ data: [] }),
    bizIds.length ? sb.from("local_businesses_public").select("id, name").in("id", bizIds) : Promise.resolve({ data: [] }),
  ]);
  const name = new Map<string, string>([...(hubs.data ?? []), ...(biz.data ?? [])].map((x) => [x.id as string, x.name as string]));
  const list: AdminActivity[] = (data ?? []).map((r) => {
    const x = r as unknown as AdminActivity & { organiser_business_id: string | null; organiser_hub_id: string | null; is_platform_activity: boolean };
    const kind = x.is_platform_activity ? "platform" : x.organiser_hub_id ? "hub" : "business";
    const id = x.organiser_hub_id ?? x.organiser_business_id;
    return { ...x, owner_kind: kind, owner_id: id, owner_name: kind === "platform" ? "OneShetland" : (id && name.get(id)) || "Unknown" } as AdminActivity;
  });
  return (
    <>
      <AdminHeader title="Regular activities" sub="Publish platform activities, pause any listing, approve hub activities and hand one to a hub or business. Everything here is recorded." />
      <ActivitiesAdmin rows={list} queue={queue} />
    </>
  );
}
