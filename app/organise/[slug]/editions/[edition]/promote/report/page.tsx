import Link from "next/link";
import { getPromoReport } from "@/lib/editions/commerce.server";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PromoReport } from "@/components/editions-manage/PromoReport";
import { Panel, btnSecondary } from "@/components/editions-manage/kit";
import { editionPage } from "../../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaign report" };

export default async function PromoReportPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/promote/report`);
  const rows = await getPromoReport(bundle.edition.id);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="promote" />
      <Panel title="Campaign report" sub="How each promotion has gone, booking by booking." action={<Link href={`/organise/${slug}/editions/${edSlug}/promote`} className={btnSecondary}>Back to promotion</Link>}>
        <PromoReport rows={rows} />
      </Panel>
    </>
  );
}
