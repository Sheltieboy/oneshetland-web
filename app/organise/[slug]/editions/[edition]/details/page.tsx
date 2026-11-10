import { can } from "@/lib/editions/rules";
import { EditionForm } from "@/components/editions-manage/EditionForm";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { Panel } from "@/components/editions-manage/kit";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition details" };

export default async function DetailsPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, role, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/details`);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="details" />
      <div className="max-w-3xl"><Panel>
        <EditionForm mode="edit" organiserSlug={slug} organiserId={organiser.id} series={bundle.seriesOptions} edition={bundle.edition} canCreateSeries={can(role, "admin")} organiser={organiser} />
      </Panel></div>
    </>
  );
}
