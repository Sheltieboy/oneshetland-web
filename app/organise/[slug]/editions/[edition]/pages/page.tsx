import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PageEditor } from "@/components/editions-manage/PageEditor";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition pages" };

export default async function PagesPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/pages`);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="pages" />
      <p className="mb-5 max-w-2xl text-sm text-ink-soft">Pages make up your Edition&apos;s menu. The programme and updates are added automatically, so you do not need pages for them.</p>
      <PageEditor organiserSlug={slug} editionSlug={edSlug} pages={bundle.pages} summary={bundle.edition.summary} />
    </>
  );
}
