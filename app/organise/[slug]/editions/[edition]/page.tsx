import Link from "next/link";
import { can } from "@/lib/editions/rules";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { ChecklistPanel, EntitlementPanel, StatusControls } from "@/components/editions-manage/StatusPanels";
import { Panel, btnSecondary } from "@/components/editions-manage/kit";
import { InterestPanel, type Metric } from "@/components/editions-manage/InterestPanel";
import { editionPage } from "../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition overview" };

export default async function EditionOverview({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, role, bundle, sb } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}`);
  const { edition } = bundle;
  const { data: metrics } = await sb.rpc("edition_org_analytics", { p_org: organiser.id, p_edition: edition.id, p_days: 30 });
  const counts = [
    ["Pages", bundle.pages.length, "pages"], ["Sessions", bundle.sessions.length, "programme"],
    ["Updates", bundle.updates.length, "updates"], ["Sponsors", bundle.sponsors.length, "sponsors"],
  ] as const;
  const root = `/organise/${slug}/editions/${edSlug}`;
  return (
    <>
      <EditionHeader organiser={organiser} edition={edition} active="overview" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {edition.status === "published" && Array.isArray(metrics) && <InterestPanel metrics={metrics as Metric[]} days={30} />}
          <Panel title="Before you publish" sub="Items marked required are checked by OneShetland when you publish.">
            <ChecklistPanel checklist={bundle.checklist} />
          </Panel>
          <Panel title="Visibility">
            <p className="mb-4 text-sm text-ink-soft">
              {edition.status === "published" ? (edition.is_test ? "This is a test Edition. It is published, but only your team and OneShetland staff can see it." : "This Edition is live and anyone can see it.")
                : edition.status === "draft" ? "This Edition is a private draft. Only your team can see it."
                : edition.status === "archived" ? "This Edition is archived and hidden from visitors."
                : "This Edition is suspended and hidden from visitors."}
            </p>
            <StatusControls organiserSlug={slug} edition={edition} role={role} checklist={bundle.checklist} />
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Preview">
            <p className="mb-3 text-sm text-ink-soft">{edition.status === "published" ? "See what visitors see." : "Your team can open the draft exactly as visitors will see it once published."}</p>
            <Link href={`/editions/${edition.slug}`} className={btnSecondary + " w-full"} target="_blank" rel="noopener">{edition.status === "published" ? "Open public page" : "Preview draft"}</Link>
          </Panel>
          <Panel title="Package"><EntitlementPanel entitlements={bundle.entitlements} entitled={bundle.entitled} /></Panel>
          <Panel title="Content">
            <ul className="divide-y divide-line text-sm">
              {counts.map(([label, n, path]) => (
                <li key={label}><Link href={`${root}/${path}`} className="flex items-center justify-between py-2 hover:text-navy"><span>{label}</span><span className="font-semibold tabular-nums">{n}</span></Link></li>
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
