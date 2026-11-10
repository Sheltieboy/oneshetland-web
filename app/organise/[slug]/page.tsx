import Link from "next/link";
import { EDITION_COLUMNS, KIND_LABEL, ROLE_LABEL, type Edition, type EditionEntitlement } from "@/lib/editions/types";
import { can, dateRangeLabel, phaseOf } from "@/lib/editions/rules";
import { EmptyState, Panel, PhasePill, Pill, TestPill, btnPrimary, btnSecondary } from "@/components/editions-manage/kit";
import { BrandPreview } from "@/components/editions-manage/brand-kit";
import { normaliseFocus, TYPEFACE } from "@/lib/editions/brand";
import { inheritFromParent, inheritedFields } from "@/lib/editions/hub-brand";
import { EditionStatePill } from "@/components/editions-manage/JourneyPanels";
import { editionState } from "@/lib/editions/journey";
import { organiserPage } from "../gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

export default async function OrganiserDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, sb, parent } = await organiserPage(slug, `/organise/${slug}`);
  // What the Edition really shows: the organiser's own choices, else the Hub's (read live). The checklist says which is which.
  const shown = inheritFromParent(organiser, parent), loan = inheritedFields(organiser, parent);
  const isAdmin = can(role, "admin"), isOwner = can(role, "owner");

  const [eds, ents, team] = await Promise.all([
    sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).order("starts_on", { ascending: false }),
    sb.from("edition_entitlements").select("*").eq("organiser_id", organiser.id),
    isAdmin ? sb.rpc("edition_org_team", { p_org: organiser.id }) : Promise.resolve({ data: null }),
  ]);
  const editions = (eds.data ?? []) as Edition[];
  const entitlements = (ents.data ?? []) as EditionEntitlement[];
  const now = Date.now();
  const entitledFor = (id: string) => entitlements.some((e) => e.edition_id === id && e.feature === "publish" && !e.voided_at && Date.parse(e.starts_at) <= now && Date.parse(e.ends_at) > now);
  const teamCount = Array.isArray(team.data) ? team.data.length : null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="inline-block py-1.5 hover:underline">Festivals and Editions</Link></nav>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">{organiser.name}</h1>
        {organiser.is_test && <TestPill />}
      </div>
      <p className="mt-1 text-sm text-ink-soft">You are an {ROLE_LABEL[role]}. {organiser.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-navy">
        <Link href={`/organise/${organiser.slug}/brand`} className="inline-block py-1.5 hover:underline">Brand</Link>
        <Link href={`/organise/${organiser.slug}/profile`} className="inline-block py-1.5 hover:underline">Identity</Link>
        <Link href={`/organise/${organiser.slug}/team`} className="inline-block py-1.5 hover:underline">Team</Link>
        <Link href={`/organise/${organiser.slug}/members`} className="inline-block py-1.5 hover:underline">Members</Link>
        {isAdmin && <Link href={`/organise/${organiser.slug}/payments`} className="inline-block py-1.5 hover:underline">Payments</Link>}
        {isAdmin && <Link href={`/organise/${organiser.slug}/packages`} className="inline-block py-1.5 hover:underline">Packages</Link>}
        <Link href={`/organisers/${organiser.slug}`} className="inline-block py-1.5 hover:underline">Public page</Link>
      </div>

      <div className="mt-6 space-y-6">
        {organiser.status === "suspended" && <Panel tone="alert" title="Your Editions are paused"><p className="text-sm text-ink-soft">OneShetland has paused Editions for {parent?.name ?? "this Business or Hub"}, so none of them are public for now.</p></Panel>}

        <Panel title="Your brand" sub="Your logo, one colour and one cover photograph make every page feel like yours. We handle the rest."
          action={isAdmin ? <Link href={`/organise/${organiser.slug}/brand`} className={btnSecondary}>{shown.logo_url && shown.cover_url && shown.brand_color ? "Edit brand" : "Set up your brand"}</Link> : undefined}>
          <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,22rem)_1fr]">
            <BrandPreview name={organiser.name} tagline={organiser.tagline} logo={shown.logo_url} cover={shown.cover_url} focus={normaliseFocus(shown.cover_focus)} color={shown.brand_color} eyebrow="Editions" />
            <ul className="space-y-2 text-sm text-ink-soft" aria-label="Brand checklist">
              {[["Logo", !!shown.logo_url, loan.logo], ["Brand colour", !!shown.brand_color, loan.color], ["Cover photograph", !!shown.cover_url, loan.cover], ["Tagline", !!organiser.tagline, false]].map(([label, ok, fromHub]) => (
                <li key={String(label)} className="flex items-center gap-2"><span aria-hidden="true" className={ok ? "text-emerald-700" : "text-ink-faint"}>{ok ? "✓" : "○"}</span><span className={ok ? "text-ink" : ""}>{label as string}{ok ? (fromHub ? ` (from ${parent?.name ?? "your profile"})` : "") : " (not added yet)"}</span></li>
              ))}
              <li className="pt-1 text-ink-muted">Typeface: {TYPEFACE.name}, shared by every Edition.</li>
            </ul>
          </div>
        </Panel>

        <section aria-labelledby="eds-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="eds-h" className="font-display text-xl font-bold text-ink">Editions</h2>
            {isAdmin && <Link href={`/organise/${organiser.slug}/editions/new`} className={btnPrimary}>New Edition</Link>}
          </div>
          {editions.length === 0 ? (
            <div className="mt-3"><EmptyState>{isAdmin ? "No Editions yet. Create your first one: a festival, a season, a day of events." : "No Editions yet. An administrator or owner can create one."}</EmptyState></div>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper shadow-soft">
              {editions.map((e) => (
                <li key={e.id}>
                  <Link href={`/organise/${organiser.slug}/editions/${e.slug}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-sand/40">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold text-ink">{e.title}</p>
                      <p className="text-sm text-ink-soft">{KIND_LABEL[e.kind]} · {dateRangeLabel(e.starts_on, e.ends_on)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <EditionStatePill edition={e} showAttention />
                      {e.status !== "archived" && <PhasePill phase={phaseOf(e)} />}
                      {isAdmin && editionState(e) === "approved" && <Pill label={entitledFor(e.id) ? "Package active" : "Choose a package"} tone={entitledFor(e.id) ? "green" : "amber"} />}
                      {e.is_test && <TestPill />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Panel title="Team" action={<Link href={`/organise/${organiser.slug}/team`} className={btnSecondary + " !px-4 !py-1.5"}>{isOwner ? "Manage team" : "View"}</Link>}>
          <p className="text-sm text-ink-soft">{teamCount !== null ? `${teamCount} ${teamCount === 1 ? "person" : "people"} can work on your Editions.` : "Administrators and owners can see everyone with access."} Owners invite helpers; administrators submit and publish Editions; editors edit content.</p>
        </Panel>
      </div>
    </>
  );
}
