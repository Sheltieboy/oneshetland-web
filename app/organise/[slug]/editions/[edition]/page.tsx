import Link from "next/link";
import { can } from "@/lib/editions/rules";
import { activeUntil, dayLabel, editionState, promoteNudge, stepIndex } from "@/lib/editions/journey";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { ChecklistPanel, StatusControls } from "@/components/editions-manage/StatusPanels";
import { JourneyStepper, ReviewHistory, ReviewPanel } from "@/components/editions-manage/JourneyPanels";
import { Panel, btnPrimary, btnSecondary } from "@/components/editions-manage/kit";
import { InterestPanel, type Metric } from "@/components/editions-manage/InterestPanel";
import { getPromoRights } from "@/lib/editions/commerce.server";
import { unbookedCount } from "@/lib/editions/promo";
import { editionPage } from "../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition overview" };

export default async function EditionOverview({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, role, bundle, sb } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}`);
  const { edition, review, checklist } = bundle;
  const { data: metrics } = await sb.rpc("edition_org_analytics", { p_org: organiser.id, p_edition: edition.id, p_days: 30 });
  const counts = [
    ["Pages", bundle.pages.length, "pages"], ["Sessions", bundle.sessions.length, "programme"],
    ["Updates", bundle.updates.length, "updates"], ["Sponsors", bundle.sponsors.length, "sponsors"],
  ] as const;
  const root = `/organise/${slug}/editions/${edSlug}`;
  const state = editionState(edition);
  const editing = stepIndex(state) === 0;
  const until = bundle.entitled ? activeUntil(bundle.entitlements) : null;
  const live = edition.status === "published";
  // Promotion is optional and comes after publishing; it is read only once there is a live package to promote.
  const promoReady = edition.review_state === "approved" && !!until;
  const unbooked = promoReady ? unbookedCount(await getPromoRights(edition.id)) : 0;
  const nudge = promoteNudge({ state, unbookedRights: unbooked, canAct: can(role, "admin") });
  return (
    <>
      <EditionHeader organiser={organiser} edition={edition} active="overview" />
      <div className="mb-6"><JourneyStepper state={state} /></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <ReviewPanel organiserSlug={slug} edition={edition} role={role} review={review} checklist={checklist} entitled={bundle.entitled} />

          <section aria-labelledby="preview-h" className="rounded-card border border-line bg-paper p-5 shadow-soft">
            <h2 id="preview-h" className="font-display text-xl font-bold text-ink">{live && !edition.is_test ? "See your public page" : "Preview your Edition exactly as visitors will see it"}</h2>
            <p className="mt-1 text-sm text-ink-soft">{live && !edition.is_test ? "This is what visitors see." : "Only your team and OneShetland staff can open it until it is live. A banner at the top reminds you of that."}</p>
            <Link href={`/editions/${edition.slug}`} className={btnPrimary + " mt-3"} target="_blank" rel="noopener">{live && !edition.is_test ? "Open public page" : "Preview your Edition"}</Link>
          </section>

          {nudge && (
            <Panel tone={nudge.prominent ? "warm" : "plain"} title={nudge.headline} sub={nudge.detail}>
              <Link href={`${root}/promote`} className={(nudge.prominent ? btnPrimary : btnSecondary) + " w-full sm:w-auto"}>{nudge.cta}</Link>
            </Panel>
          )}

          {live && Array.isArray(metrics) && <InterestPanel metrics={metrics as Metric[]} days={30} />}

          {editing && (
            <Panel title="Your checklist" sub="Everything marked as needed must be done before you can submit. Recommended items help visitors but never stop you.">
              <ChecklistPanel checklist={checklist} edRoot={root} />
            </Panel>
          )}

          <Panel title="Review history" sub="What has happened to this Edition, newest first."><ReviewHistory review={review} /></Panel>

          <Panel title="Unpublish or archive">
            <p className="mb-4 text-sm text-ink-soft">
              {live ? (edition.is_test ? "This is a test Edition. It is published, but only your team and OneShetland staff can see it." : "Unpublishing takes your Edition off OneShetland straight away. It keeps its approval, so you can publish it again.")
                : edition.status === "archived" ? "This Edition is archived and hidden from visitors."
                : edition.status === "suspended" ? "This Edition is suspended and hidden from visitors."
                : "Your Edition is not public yet. Archive it if you no longer need it, or delete it if it was only a draft."}
            </p>
            <StatusControls organiserSlug={slug} edition={edition} role={role} />
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel id="package" title="Package">
            {until ? <p role="status" className="text-sm font-semibold text-emerald-800">Package active until {dayLabel(until)}</p>
              : edition.review_state === "approved" ? (
                <div className="space-y-3"><p className="text-sm text-ink-soft">Your Edition is approved. Choose a package to cover it.</p><Link href={`${root}/package`} className={btnSecondary + " w-full"}>{can(role, "admin") ? "Choose a package" : "See the packages"}</Link></div>
              ) : <p className="text-sm text-ink-soft">You choose a package after OneShetland has approved your Edition. <Link href={`${root}/package`} className="font-semibold underline">See what is on offer</Link>.</p>}
          </Panel>
          {promoReady && (
            <Panel title="Promotion">
              <p className="mb-3 text-sm text-ink-soft">Optional. Choose when your Edition is featured, add more promotion, and see how it went.</p>
              <Link href={`${root}/promote`} className={btnSecondary + " w-full"}>Promote your Edition</Link>
            </Panel>
          )}
          <Panel title="Content">
            <ul className="divide-y divide-line text-sm">
              {counts.map(([label, n, path]) => (
                <li key={label}><Link href={`${root}/${path}`} className="flex min-h-[44px] items-center justify-between py-2 hover:text-navy"><span>{label}</span><span className="font-semibold tabular-nums">{n}</span></Link></li>
              ))}
            </ul>
          </Panel>
          {can(role, "admin") && (
            <Panel title="Next year">
              <p className="mb-3 text-sm text-ink-soft">Start the next Edition with the same name, kind and series, dates moved on a year.</p>
              <Link href={`/organise/${slug}/editions/new?from=${edition.slug}`} className={btnSecondary + " w-full"}>Create next year&apos;s Edition</Link>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
