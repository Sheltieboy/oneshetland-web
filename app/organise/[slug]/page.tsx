import Link from "next/link";
import { EDITION_COLUMNS, KIND_LABEL, ROLE_LABEL, type Edition, type EditionEntitlement } from "@/lib/editions/types";
import { can, dateRangeLabel, phaseOf } from "@/lib/editions/rules";
import { VerificationForm } from "@/components/editions-manage/VerificationForm";
import { EditionStatusPill, EmptyState, OrganiserStatusPill, Panel, PhasePill, Pill, TestPill, btnPrimary, btnSecondary } from "@/components/editions-manage/kit";
import { BrandPreview } from "@/components/editions-manage/brand-kit";
import { normaliseFocus, TYPEFACE } from "@/lib/editions/brand";
import { organiserPage } from "../gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

export default async function OrganiserDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, sb } = await organiserPage(slug, `/organise/${slug}`);
  const isAdmin = can(role, "admin"), isOwner = can(role, "owner");

  const [eds, ents, ver, team] = await Promise.all([
    sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).order("starts_on", { ascending: false }),
    sb.from("edition_entitlements").select("*").eq("organiser_id", organiser.id),
    sb.from("edition_organiser_verifications").select("status, note, created_at").eq("organiser_id", organiser.id).order("created_at", { ascending: false }).limit(1),
    isAdmin ? sb.rpc("edition_org_team", { p_org: organiser.id }) : Promise.resolve({ data: null }),
  ]);
  const editions = (eds.data ?? []) as Edition[];
  const entitlements = (ents.data ?? []) as EditionEntitlement[];
  const now = Date.now();
  const entitledFor = (id: string) => entitlements.some((e) => e.edition_id === id && e.feature === "publish" && !e.voided_at && Date.parse(e.starts_at) <= now && Date.parse(e.ends_at) > now);
  const latest = ((ver.data ?? []) as { status: string; note: string | null }[])[0] ?? null;
  const teamCount = Array.isArray(team.data) ? team.data.length : null;
  const inReview = organiser.status === "pending" && latest?.status === "pending";

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link href="/organise" className="hover:underline">Organiser tools</Link></nav>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">{organiser.name}</h1>
        <OrganiserStatusPill status={organiser.status} />
        {organiser.is_test && <TestPill />}
      </div>
      <p className="mt-1 text-sm text-ink-soft">You are an {ROLE_LABEL[role]}. {organiser.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-navy">
        <Link href={`/organise/${organiser.slug}/brand`} className="hover:underline">Brand</Link>
        <Link href={`/organise/${organiser.slug}/profile`} className="hover:underline">Profile</Link>
        <Link href={`/organise/${organiser.slug}/team`} className="hover:underline">Team</Link>
        {organiser.status === "verified" && <Link href={`/organise/${organiser.slug}/members`} className="hover:underline">Members</Link>}
        {organiser.status === "verified" && <Link href={`/organise/${organiser.slug}/payments`} className="hover:underline">Payments</Link>}
        {organiser.status === "verified" && <Link href={`/organise/${organiser.slug}/packages`} className="hover:underline">Packages</Link>}
        {organiser.status === "verified" && <Link href={`/organisers/${organiser.slug}`} className="hover:underline">Public page</Link>}
      </div>

      <div className="mt-6 space-y-6">
        {organiser.status === "verified" ? null : organiser.status === "suspended" ? (
          <Panel tone="alert" title="This organiser is suspended"><p className="text-sm text-ink-soft">OneShetland has suspended this organiser, so none of its Editions are public. Contact support to resolve this.</p></Panel>
        ) : inReview ? (
          <Panel tone="warm" title="Verification is under review"><p className="text-sm text-ink-soft">We have your request and will review it. You can keep building your Editions in the meantime; they stay private until you are verified and have an active package.</p></Panel>
        ) : (
          <Panel tone="warm" title={organiser.status === "rejected" ? "Verification was not approved" : "Verify your organiser"}
            sub={organiser.status === "rejected" ? (latest?.note ? `Reason given: ${latest.note}` : "You can send more detail and ask us to look again.") : "Editions can only be published by a verified organiser. You can build everything now and publish once we have verified you."}>
            {isOwner ? <VerificationForm slug={organiser.slug} resubmit={organiser.status === "rejected"} /> : <p className="text-sm text-ink-soft">Only an owner can request verification.</p>}
          </Panel>
        )}

        <Panel title="Your brand" sub="Your logo, one colour and one cover photograph make every page feel like yours. We handle the rest."
          action={isAdmin ? <Link href={`/organise/${organiser.slug}/brand`} className={btnSecondary}>{organiser.logo_url && organiser.cover_url && organiser.brand_color ? "Edit brand" : "Set up your brand"}</Link> : undefined}>
          <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,22rem)_1fr]">
            <BrandPreview name={organiser.name} tagline={organiser.tagline} logo={organiser.logo_url} cover={organiser.cover_url} focus={normaliseFocus(organiser.cover_focus)} color={organiser.brand_color} eyebrow="Organiser" />
            <ul className="space-y-2 text-sm text-ink-soft" aria-label="Brand checklist">
              {[["Logo", !!organiser.logo_url], ["Brand colour", !!organiser.brand_color], ["Cover photograph", !!organiser.cover_url], ["Tagline", !!organiser.tagline]].map(([label, ok]) => (
                <li key={String(label)} className="flex items-center gap-2"><span aria-hidden="true" className={ok ? "text-emerald-700" : "text-ink-faint"}>{ok ? "✓" : "○"}</span><span className={ok ? "text-ink" : ""}>{label as string}{ok ? "" : " (not added yet)"}</span></li>
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
                      <EditionStatusPill status={e.status} />
                      {e.status !== "archived" && <PhasePill phase={phaseOf(e)} />}
                      {e.status !== "archived" && <Pill label={entitledFor(e.id) ? "Package active" : "No package"} tone={entitledFor(e.id) ? "green" : "gray"} />}
                      {e.is_test && <TestPill />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Panel title="Team" action={<Link href={`/organise/${organiser.slug}/team`} className={btnSecondary + " !px-4 !py-1.5"}>{isOwner ? "Manage team" : "View"}</Link>}>
          <p className="text-sm text-ink-soft">{teamCount !== null ? `${teamCount} ${teamCount === 1 ? "person" : "people"} can work on this organiser.` : "Administrators and owners can see the team."} Owners manage people; administrators manage and publish Editions; editors change content.</p>
        </Panel>
      </div>
    </>
  );
}
