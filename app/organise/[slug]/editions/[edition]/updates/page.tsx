import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { UpdatesManager } from "@/components/editions-manage/UpdatesManager";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition updates" };

export default async function UpdatesPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/updates`);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="updates" />
      <UpdatesManager organiserSlug={slug} organiserId={organiser.id} editionSlug={edSlug} updates={bundle.updates} />
    </>
  );
}
