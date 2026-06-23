import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHub, hubAccent, isMembershipActive } from "@/lib/hubs-data";
import { getMyMembership, isHubAdmin, getHubDirectory } from "@/lib/hubs-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member directory" };

export default async function DirectoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();

  const [membership, admin] = await Promise.all([getMyMembership(hub.id), isHubAdmin(hub.id)]);
  const canView = admin.isAdmin || (membership && isMembershipActive(membership));
  if (!canView) redirect(`/hubs/${hub.slug || hub.id}`);

  const accent = hubAccent(hub);
  const members = await getHubDirectory(hub.id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-12">
      <Link href={`/hubs/${hub.slug || hub.id}/manage`} className="text-sm font-semibold hover:underline" style={{ color: accent }}>← Management</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Member directory</h1>
      <p className="mt-1 text-ink-soft">{members.length} member{members.length === 1 ? "" : "s"}</p>

      <ul className="mt-6 space-y-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full font-bold text-paper" style={{ background: accent }}>
                {(m.name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="font-semibold text-ink">{m.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {m.tier && <span className="rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-muted">{m.tier}</span>}
              {m.role !== "member" && (
                <span className="rounded-pill px-2 py-0.5 text-xs font-semibold capitalize text-paper" style={{ background: accent }}>{m.role}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
