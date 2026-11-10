import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PartnersManager } from "@/components/editions-manage/PartnersManager";
import { getPartnerRows } from "@/lib/editions/data.server";
import { dateRangeLabel, can } from "@/lib/editions/rules";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition partners" };

export default async function PartnersPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle, role } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/partners`);
  const rows = await getPartnerRows(bundle.edition.id);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="partners" />
      <PartnersManager
        organiserSlug={slug} editionSlug={edSlug} organiserName={organiser.name} editionTitle={bundle.edition.title}
        dateLabel={dateRangeLabel(bundle.edition.starts_on, bundle.edition.ends_on)} rows={rows} canManage={can(role, "editor")}
      />
    </>
  );
}
