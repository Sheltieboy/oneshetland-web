import type { Metadata } from "next";
import { gateFeature, serverSb } from "@/lib/event-submissions-access.server";
import { submissionsOpen } from "@/lib/event-submissions-client";
import { isSharedCategory } from "@/lib/event-categories";
import { loadMyOrganisers } from "@/lib/event-organisers.server";
import { listMySubmissions } from "@/lib/event-submissions-client";
import type { Organiser } from "@/lib/event-ownership";
import { FrontDoor, type SubmitGate } from "@/components/events/front-door/FrontDoor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add an Event or Activity", robots: { index: false, follow: false }, alternates: { canonical: "/whats-on/add" } };

/**
 * HIDDEN. Two separate questions, deliberately kept apart:
 *   WHO CAN OPEN THIS PAGE (this gate): the public flag EVENT_FRONT_DOOR === "on" opens it for everyone; with the flag off it is open ONLY to a
 *     signed-in administrator (preview) or an allowlisted tester (controlled acceptance testing); everyone else gets a 404.
 *   WHO IS SHOWN LINKS TO IT (lib/event-entry-points.ts): the flag alone, for everyone including admins. With the flag off nothing links here, so an
 *     admin or tester uses the direct address.
 * Executable proof of every viewer type: tests/event-gate-viewers.test.mjs.
 *
 * Whether the event form can be used is decided here, on the server: signed out -> sign in first; the database functions missing -> "not available
 * yet"; the master switch closed -> "not open yet" (staff may still try it, as the database allows).
 */
export default async function AddPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const { account } = await gateFeature();
  const sp = await searchParams;
  const rawCat = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const initialCategory = isSharedCategory(rawCat) ? rawCat : null;

  let gate: SubmitGate = { kind: "signin" };
  let organisers: Organiser[] = [];
  let organisersFailed = false;
  let managesHub: boolean | null = null;
  let priorStatuses: string[] = [];
  if (account) {
    // Only what this member may manage (see lib/event-organisers.server.ts); a failure degrades to the independent option.
    const loaded = await loadMyOrganisers(account.id).catch(() => null);
    if (loaded) { organisers = loaded.organisers; organisersFailed = loaded.failed; managesHub = loaded.managesHub; } else organisersFailed = true;
    const mine = await listMySubmissions(await serverSb(), account.id).catch(() => null);
    priorStatuses = mine && mine.ok ? mine.data.map((s) => s.status) : [];
    const staff = account.profile?.role === "admin" || account.profile?.role === "moderator";
    const open = await submissionsOpen(await serverSb());
    if (open.ok) gate = open.data || staff ? { kind: "ready", staff, closedToPublic: !open.data } : { kind: "closed" };
    else gate = open.error.kind === "unavailable" ? { kind: "unavailable" } : open.error.kind === "closed" ? { kind: "closed" } : { kind: "error", message: open.error.message };
  }
  return <FrontDoor gate={gate} userId={account?.id ?? null} initialCategory={initialCategory} organisers={organisers} organisersFailed={organisersFailed} managesHub={managesHub} priorStatuses={priorStatuses} />;
}
