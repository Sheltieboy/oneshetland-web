import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/admin/AdminUI";
import { getCampaign, listInvites } from "@/lib/launch-partners/campaigns.server";
import { STATUS_LABEL, STATUS_TONE, derivePipelineStatus, isClaimed } from "@/lib/launch-partners/status";
import { parsePageDraft, parsePreviewConfig } from "@/lib/launch-partners/validate";
import type { PreviewConfig } from "@/lib/launch-preview/types";
import type { PageDraft } from "@/lib/business-page/types";
import { Section } from "@/components/admin/launch-partners/fields";
import { PositioningField } from "@/components/admin/launch-partners/PositioningField";
import { PreviewEditor } from "@/components/admin/launch-partners/PreviewEditor";
import { PageDraftEditor } from "@/components/admin/launch-partners/PageDraftEditor";
import { OutreachPanels } from "@/components/admin/launch-partners/OutreachPanels";
import { StatusSection } from "@/components/admin/launch-partners/StatusSection";
import { OutreachStopSection } from "@/components/admin/launch-partners/OutreachStopSection";
import { EnrichmentSection } from "@/components/admin/launch-partners/EnrichmentSection";
import { enrichmentView } from "@/lib/launch-partners/enrich.server";
import { GrantSection } from "@/components/admin/launch-partners/GrantSection";
import { grantContext } from "@/lib/launch-partners/grant.server";
import { WorkflowRail } from "@/components/admin/launch-partners/WorkflowRail";
import { deriveWorkflow } from "@/lib/launch-partners/workflow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Launch partner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAV: [string, string][] = [["business", "Business"], ["positioning", "Positioning"], ["peerie", "Peerie Bot draft"], ["preview", "Preview"], ["page", "Business page"], ["invitation", "Invitation"], ["email", "Email"], ["outreach", "Do not contact"], ["grant", "Launch access"], ["status", "Status"]];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await getCampaign(id);
  if (!c) notFound();
  const status = derivePipelineStatus(c);

  const pv = parsePreviewConfig(c.preview_config, c.slug);
  const pg = parsePageDraft(c.page_config);
  const preview = (pv.ok ? pv.value : null) as PreviewConfig | null;
  const page = (pg.ok ? pg.value : null) as PageDraft | null;
  const claimMode = preview?.claim === "live" ? "live" : "holding";
  const enrich = await enrichmentView(c);
  // Every invitation ever issued for this preview, newest first; the newest is the current one (shown above), the rest are kept history.
  const invitesForSlug = (await listInvites().catch(() => [])).filter((i) => i.slug === c.slug);
  // The workflow is READ from the same facts as everything below it: the pipeline row, the preview's claim mode and the saved email draft.
  // Launch partner access is shown once their claim is approved (or if they ever had a grant); it reads the real grant records.
  const approved = isClaimed(c);
  const grant = approved ? await grantContext(c.business_id) : { lookup: null, last: null };
  const showGrant = approved || !!grant.last;
  const workflow = deriveWorkflow({ row: c, claimMode, email: { subject: c.email_subject, body: c.email_body, opening: c.email_opening, contactEmail: c.contact_email }, lastGrant: grant.last, owner: { edited: (c.versions ?? []).some((v) => v.kind === "owner_edit"), approved: !!c.approved_at, published: !!c.published_version_id } });

  const facts: [string, string][] = [
    ["Category", c.category ?? "—"], ["Location", c.locality ?? "—"],
    ["Directory listing", c.is_active ? "Publicly listed" : "Not publicly listed"],
    ["Ownership", c.has_owner ? "Has an owner" : c.is_claimed ? "Claimed" : "Unclaimed"],
    ["Plan", c.grant ? `${c.grant.tier} (launch partner)` : c.plan_live ? (c.tier ?? "paid") : "Free"],
    ["Content on OneShetland", `${c.product_count} product${c.product_count === 1 ? "" : "s"} (${c.active_product_count} live) · ${c.import_batch_count} import${c.import_batch_count === 1 ? "" : "s"}`],
  ];

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-5">
    <div className="min-w-0">
      <Link href="/admin/launch-partners" className="text-sm font-semibold text-ink-soft hover:text-ink">← Launch partners</Link>
      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-ink">{c.name}</h1>
            <StatusPill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
            {c.is_test && <StatusPill label="Test fixture" tone="purple" />}
          </div>
          <p className="mt-1 text-sm text-ink-muted">Private to Admin. Nothing on this screen is public, and nothing has been sent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin-preview/launch-partners/${c.id}/launch`} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Preview launch page →</a>
          <a href={`/admin-preview/launch-partners/${c.id}/business-page`} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Preview business page →</a>
          <a href={`/admin-preview/launch-partners/${c.id}/business-page?view=future-live`} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">Future live preview →</a>
        </div>
      </div>
      <nav aria-label="Sections" className="mb-6 flex flex-wrap gap-2">
        {NAV.filter(([k]) => k !== "grant" || showGrant).map(([k, l]) => <a key={k} href={`#${k}`} className="rounded-pill border border-line-strong px-3 py-1 text-sm font-semibold text-ink-soft hover:bg-sand">{l}</a>)}
      </nav>

      <div className="space-y-6">
        <Section id="business" title="Business" sub="What OneShetland already holds. Read-only here; none of it is changed by preparing a launch partner.">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => <div key={k}><dt className="eyebrow text-ink-muted">{k}</dt><dd className="mt-0.5 text-sm font-semibold text-ink">{v}</dd></div>)}
          </dl>
          <p className="text-sm"><a href={`/directory/${c.business_id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-soft underline underline-offset-2">View the current public Directory listing →</a></p>
        </Section>

        <Section id="positioning" title="Positioning" sub="One line naming the pitch. Internal; never shown publicly.">
          <PositioningField id={c.id} initial={c.positioning ?? ""} />
        </Section>

        <EnrichmentSection id={c.id} businessName={c.name} defaultUrl={enrich.defaultUrl} runs={enrich.runs} editedSince={enrich.editedSince} hasContent={enrich.hasContent} sent={!!c.sent_at} />

        {preview ? <PreviewEditor id={c.id} initial={preview} /> : <Section id="preview" title="Preview"><p role="alert" className="text-sm font-semibold text-rose-700">The stored preview is not valid: {pv.ok ? "" : pv.error}</p></Section>}
        {page && preview ? <PageDraftEditor id={c.id} initial={page} preview={preview} previewHref={`/admin-preview/launch-partners/${c.id}/business-page`} /> : <Section id="page" title="Business page"><p className="text-sm text-ink-muted">{pg.ok ? "Prepare the launch preview first." : `The stored page draft is not valid: ${pg.error}`}</p></Section>}
        <OutreachPanels row={c} claimMode={claimMode} businessName={c.name} history={invitesForSlug.slice(1)} email={{ contactName: c.contact_name, contactEmail: c.contact_email, subject: c.email_subject, opening: c.email_opening, body: c.email_body }} />
        <OutreachStopSection row={c} businessName={c.name} />
        {showGrant && <GrantSection businessId={c.business_id} businessName={c.name} lookup={grant.lookup} />}
        <StatusSection row={c} events={c.events ?? []} />
      </div>
    </div>
    <WorkflowRail id={c.id} workflow={workflow} />
    </div>
  );
}
