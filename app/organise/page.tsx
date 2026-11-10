import Link from "next/link";
import { redirect } from "next/navigation";
import { getEditionsAccess, getMyBusinessEditions, getMyHubEditions, getMyInvites, getMyOrganisers } from "@/lib/editions/data.server";
import { ROLE_LABEL } from "@/lib/editions/types";
import { AcceptInviteButton } from "@/components/editions-manage/AcceptInviteButton";
import { entryStateText, type EntryState } from "@/components/editions-manage/EditionsEntryPanel";
import { StartEditionsButton } from "@/components/editions-manage/StartEditionsButton";
import { Panel, TestPill, btnPrimary, btnSecondary } from "@/components/editions-manage/kit";
import { startBusinessEditions } from "@/app/business/[id]/manage/editions/actions";
import { startHubEditions } from "@/app/hubs/[id]/manage/editions/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editions" };

const card = "flex h-full flex-col justify-between gap-4 rounded-card border border-line bg-paper p-5 shadow-soft";

/**
 * The Editions home. Editions are run by a Business or a Hub on OneShetland, so this page lists the ones the signed-in person owns or runs, with where each stands and one
 * button, plus Editions they help with as an invited helper, and any invitations waiting. Nobody registers anything here.
 */
export default async function EditionsHome() {
  // Only signing in is needed to see this page: the database decides what each button can do.
  const access = await getEditionsAccess();
  if (!access.signedIn) redirect(`/sign-in?next=${encodeURIComponent("/organise")}`);
  const [businesses, hubs, helping, invites] = await Promise.all([getMyBusinessEditions(), getMyHubEditions(), getMyOrganisers(), getMyInvites()]);
  const helper = helping.filter((h) => !h.viaParent);
  const none = businesses.length === 0 && hubs.length === 0;
  const stateOf = (slug: string | null, editions: number, inReview: number): EntryState => (slug ? { slug, editions, inReview } : null);

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink">Festivals and Editions</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">Run a festival, show, season or campaign on OneShetland: a page with a programme, updates and sponsors, run by your Business or Hub.</p>

      {invites.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="font-display text-xl font-bold text-ink">Invitations</h2>
          {invites.map((i) => (
            <Panel key={i.id} tone="warm">
              <p className="font-semibold text-ink">{i.organiser_name} has invited you to help as {/^[aeiou]/i.test(ROLE_LABEL[i.role]) ? "an" : "a"} {ROLE_LABEL[i.role]}.</p>
              <p className="mb-3 mt-0.5 text-sm text-ink-soft">This invitation was sent to your email address and expires on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(i.expires_at))}.</p>
              <AcceptInviteButton inviteId={i.id} />
            </Panel>
          ))}
        </div>
      )}

      {none ? (
        <div className="mt-8">
          <Panel title="Editions are run by a Business or a Hub on OneShetland" sub="You do not run a Business or a Hub here yet. Choose the route that fits you.">
            <ul className="grid gap-3 sm:grid-cols-3">
              <li className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-sand/30 p-4"><div><p className="font-semibold text-ink">Claim your Business</p><p className="mt-1 text-sm text-ink-soft">Already listed in the directory? Claim it to manage it.</p></div><Link href="/business" className={btnSecondary}>Claim a Business</Link></li>
              <li className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-sand/30 p-4"><div><p className="font-semibold text-ink">Add your Business</p><p className="mt-1 text-sm text-ink-soft">Not listed yet? Add it in a few minutes.</p></div><Link href="/directory/new" className={btnSecondary}>Add a Business</Link></li>
              <li className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-sand/30 p-4"><div><p className="font-semibold text-ink">Start a Hub</p><p className="mt-1 text-sm text-ink-soft">A club, committee or community group.</p></div><Link href="/hubs/new" className={btnSecondary}>Start a Hub</Link></li>
            </ul>
          </Panel>
        </div>
      ) : (
        <section aria-labelledby="mine-h" className="mt-8">
          <h2 id="mine-h" className="font-display text-xl font-bold text-ink">Your Businesses and Hubs</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {businesses.map((b) => {
              const s = stateOf(b.organiser_slug, b.edition_count, b.in_review);
              return (
                <li key={`b-${b.business_id}`}>
                  <div className={card}>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Business</p><p className="font-display text-lg font-bold text-ink">{b.business_name}</p><p className="mt-0.5 text-sm text-ink-soft">{entryStateText(s)}</p></div>
                    {s ? <Link href={`/organise/${s.slug}`} className={btnPrimary}>Open Editions tools</Link> : <StartEditionsButton parentId={b.business_id} parentName={b.business_name} start={startBusinessEditions} />}
                  </div>
                </li>
              );
            })}
            {hubs.map((h) => {
              const s = stateOf(h.organiser_slug, h.edition_count, h.in_review);
              return (
                <li key={`h-${h.hub_id}`}>
                  <div className={card}>
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Hub</p><p className="font-display text-lg font-bold text-ink">{h.hub_name}</p><p className="mt-0.5 text-sm text-ink-soft">{entryStateText(s)}</p></div>
                    {s ? <Link href={`/organise/${s.slug}`} className={btnPrimary}>Open Editions tools</Link> : <StartEditionsButton parentId={h.hub_id} parentName={h.hub_name} start={startHubEditions} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {helper.length > 0 && (
        <section aria-labelledby="help-h" className="mt-10">
          <h2 id="help-h" className="font-display text-xl font-bold text-ink">Editions you help with</h2>
          <p className="mt-1 text-sm text-ink-soft">You were invited to help with these.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {helper.map(({ organiser, role }) => (
              <li key={organiser.id}>
                <Link href={`/organise/${organiser.slug}`} className="block rounded-card border border-line bg-paper p-5 shadow-soft transition hover:border-navy">
                  <p className="font-display text-lg font-bold text-ink">{organiser.name}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-ink-muted">{ROLE_LABEL[role]} · invited</span>{organiser.is_test && <TestPill />}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
