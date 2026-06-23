import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHub, hubAccent } from "@/lib/hubs-data";
import { getHubMembers, isHubAdmin } from "@/lib/hubs-server";
import { MembersManager } from "@/components/hubs/admin/MembersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();
  const admin = await isHubAdmin(hub.id);
  if (!admin.isAdmin) redirect(`/hubs/${hub.slug || hub.id}`);

  const [pending, members] = await Promise.all([
    getHubMembers(hub.id, "pending"),
    getHubMembers(hub.id, "active"),
  ]);
  const accent = hubAccent(hub);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>
        ← Back to management
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Members</h1>
      <div className="mt-8">
        <MembersManager pending={pending} members={members} accent={accent} />
      </div>
    </div>
  );
}
