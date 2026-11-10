import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { SponsorsManager } from "@/components/editions-manage/SponsorsManager";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition sponsors" };

export default async function SponsorsPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/sponsors`);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="sponsors" />
      <SponsorsManager organiserSlug={slug} editionSlug={edSlug} organiserId={organiser.id} sponsors={bundle.sponsors} />
    </>
  );
}
