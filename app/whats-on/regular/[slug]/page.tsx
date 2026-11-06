import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActivityDetail } from "@/lib/activities-data";
import { ActivityDetailView } from "@/components/activities/detail/ActivityDetailView";
import { patternText } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getActivityDetail(slug);
  if (!d || d.activity.status !== "published" || d.activity.admin_paused) return { title: "Regular activity" };
  return { title: `${d.activity.title} · Regular activities`, description: d.activity.description?.slice(0, 160) ?? `${patternText(d.rules)}${d.activity.venue ? ` at ${d.activity.venue}` : ""}.` };
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = new Date();
  const d = await getActivityDetail(slug, now);
  if (!d) notFound();
  const { activity: a, owner } = d;
  const isPublic = a.status === "published" && !a.admin_paused;
  const manageHref = d.canManage
    ? owner.kind === "hub" ? `/hubs/${owner.slug || owner.id}/manage/activities/${a.id}` : owner.kind === "business" ? `/business/${owner.id}/manage/activities/${a.id}` : "/admin/activities"
    : null;
  return <ActivityDetailView activity={a} owner={owner} rules={d.rules} sessions={d.sessions} now={now} isPublic={isPublic} canManage={d.canManage} manageHref={manageHref} signedIn={d.signedIn} following={d.following} />;
}
