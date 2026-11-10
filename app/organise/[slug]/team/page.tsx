import Link from "next/link";
import { can } from "@/lib/editions/rules";
import type { OrgRole } from "@/lib/editions/types";
import { LeaveOrganiser, TeamManager, type PendingInvite, type TeamMember } from "@/components/editions-manage/TeamManager";
import { Panel } from "@/components/editions-manage/kit";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, account, sb } = await organiserPage(slug, `/organise/${slug}/team`);
  const isAdmin = can(role, "admin"), isOwner = can(role, "owner");
  const [team, inv] = await Promise.all([
    isAdmin ? sb.rpc("edition_org_team", { p_org: organiser.id }) : Promise.resolve({ data: [] }),
    isOwner ? sb.from("edition_organiser_invites").select("id, email, role, expires_at").eq("organiser_id", organiser.id).eq("status", "pending").gt("expires_at", new Date().toISOString()) : Promise.resolve({ data: [] }),
  ]);
  const members = ((team.data ?? []) as { user_id: string; role: OrgRole; full_name: string | null; joined_at: string }[]) as TeamMember[];
  const invites = ((inv.data ?? []) as PendingInvite[]);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/organise/${slug}`} className="text-sm text-ink-muted hover:underline">← {organiser.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Team</h1>
      <p className="mt-1 text-ink-soft">Owners manage people and verification. Administrators create and publish Editions. Editors change content. An organiser always keeps at least one owner.</p>
      <div className="mt-6">
        {isAdmin ? <TeamManager slug={slug} role={role} selfId={account.id} members={members} invites={invites} />
          : <Panel title="Your access"><p className="mb-3 text-sm text-ink-soft">You are an editor. Administrators and owners can see the full team.</p><LeaveOrganiser slug={slug} selfId={account.id} /></Panel>}
      </div>
    </div>
  );
}
