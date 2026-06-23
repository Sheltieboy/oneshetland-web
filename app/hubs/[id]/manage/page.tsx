import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHub, hubAccent } from "@/lib/hubs-data";
import { getHubMembers, isHubAdmin } from "@/lib/hubs-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  return { title: hub ? `Manage — ${hub.name}` : "Manage hub" };
}

type Tile = { href: string; label: string; desc: string; badge?: number };
type Group = { heading: string; tiles: Tile[] };

export default async function ManageHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hub = await getHub(id);
  if (!hub) notFound();
  const admin = await isHubAdmin(hub.id);
  if (!admin.isAdmin) redirect(`/hubs/${hub.slug || hub.id}`);

  const [members, pending] = await Promise.all([
    getHubMembers(hub.id, "active"),
    getHubMembers(hub.id, "pending"),
  ]);
  const accent = hubAccent(hub);
  const base = `/hubs/${hub.slug || hub.id}/manage`;

  const groups: Group[] = [
    {
      heading: "Membership",
      tiles: [
        { href: `${base}/members`, label: "Members", desc: `${pending.length > 0 ? `${pending.length} request${pending.length === 1 ? "" : "s"} to review` : `${members.length} member${members.length === 1 ? "" : "s"}`}`, badge: pending.length || undefined },
        { href: `${base}/tiers`, label: "Membership tiers", desc: "Free or paid ways to join" },
        ...(hub.directory_enabled ? [{ href: `/hubs/${hub.slug || hub.id}/directory`, label: "Member directory", desc: "Who's in the hub" }] : []),
      ],
    },
    {
      heading: "Content & comms",
      tiles: [
        { href: `${base}/notices`, label: "Notices", desc: "Post and manage updates" },
        { href: `${base}/documents`, label: "Documents", desc: "Policies, minutes, forms" },
        { href: `${base}/events`, label: "Events", desc: "Create events & manage visibility" },
        { href: `${base}/campaigns`, label: "Fundraising", desc: "Campaigns, donations & Gift Aid" },
        ...(hub.is_charity && hub.charity_number ? [{ href: `${base}/giftaid`, label: "Gift Aid", desc: "Export declarations for HMRC" }] : []),
        { href: `${base}/broadcast`, label: "Message members", desc: "Push or email the whole membership" },
      ],
    },
    {
      heading: "Hub",
      tiles: [
        { href: `${base}/payouts`, label: "Payouts", desc: "Connect Stripe to take payments" },
        { href: `${base}/settings`, label: "Hub settings", desc: "Name, branding, contact, join mode" },
        { href: `/hubs/${hub.slug || hub.id}`, label: "View public page", desc: "See your hub as visitors do" },
      ],
    },
  ];

  return (
    <>
      <section className="text-paper" style={{ background: accent }}>
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
          <Link href={`/hubs/${hub.slug || hub.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-paper/85 hover:text-paper">
            <span aria-hidden>←</span> View public page
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{hub.name}</h1>
          <p className="mt-1 text-paper/85">Hub management</p>
          <div className="mt-5 flex gap-6">
            <Stat n={members.length} label="Members" />
            <Stat n={pending.length} label="Pending" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-12 space-y-8">
        {groups.map((g) => (
          <div key={g.heading}>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-muted">{g.heading}</p>
            <div className="space-y-2">
              {g.tiles.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-5 py-4 shadow-soft transition hover:shadow-md"
                >
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold group-hover:underline">{t.label}</h2>
                    <p className="mt-0.5 text-sm text-ink-soft">{t.desc}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.badge ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-paper" style={{ background: accent }}>{t.badge}</span>
                    ) : null}
                    <span className="text-ink-faint">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold">{n}</div>
      <div className="text-sm text-paper/75">{label}</div>
    </div>
  );
}
