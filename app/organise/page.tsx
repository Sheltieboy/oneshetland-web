import Link from "next/link";
import { getMyInvites, getMyOrganisers } from "@/lib/editions/data.server";
import { ROLE_LABEL } from "@/lib/editions/types";
import { AcceptInviteButton } from "@/components/editions-manage/AcceptInviteButton";
import { EmptyState, OrganiserStatusPill, Panel, TestPill, btnPrimary } from "@/components/editions-manage/kit";
import { gate } from "./gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Organiser tools" };

export default async function OrganiserHome() {
  await gate("/organise");
  const [mine, invites] = await Promise.all([getMyOrganisers(), getMyInvites()]);
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink">Organiser tools</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">Run a festival, show, season or campaign on OneShetland: a branded page with a programme, updates and sponsors, managed by your team.</p>

      {invites.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="font-display text-xl font-bold text-ink">Invitations</h2>
          {invites.map((i) => (
            <Panel key={i.id} tone="warm">
              <p className="font-semibold text-ink">{i.organiser_name} has invited you to join as {/^[aeiou]/i.test(ROLE_LABEL[i.role]) ? "an" : "a"} {ROLE_LABEL[i.role]}.</p>
              <p className="mb-3 mt-0.5 text-sm text-ink-soft">This invitation was sent to your email address and expires on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(i.expires_at))}.</p>
              <AcceptInviteButton inviteId={i.id} />
            </Panel>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Your organisers</h2>
        {mine.length > 0 && <Link href="/organise/new" className={btnPrimary}>New organiser</Link>}
      </div>
      {mine.length === 0 ? (
        <div className="mt-3 space-y-5">
          <EmptyState>You do not belong to an organiser yet.</EmptyState>
          <Panel title="Start an organiser" sub="An organiser is the group behind your events, such as a committee, club or company. You can invite your team afterwards.">
            <p className="mb-4 text-sm text-ink-soft">You can set everything up straight away. Before an Edition can go public, OneShetland verifies who you are, which usually means a quick check of your organisation&apos;s details. Until then everything stays private to your team.</p>
            <Link href="/organise/new" className={btnPrimary}>Create an organiser</Link>
          </Panel>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {mine.map(({ organiser, role, viaHub }) => (
            <li key={organiser.id}>
              <Link href={`/organise/${organiser.slug}`} className="block rounded-card border border-line bg-paper p-5 shadow-soft transition hover:border-navy">
                <p className="font-display text-lg font-bold text-ink">{organiser.name}</p>
                {organiser.tagline && <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{organiser.tagline}</p>}
                <p className="mt-3 flex flex-wrap items-center gap-2"><OrganiserStatusPill status={organiser.status} /><span className="text-xs font-semibold text-ink-muted">{ROLE_LABEL[role]}{viaHub ? " · through your Hub" : ""}</span>{organiser.is_test && <TestPill />}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
