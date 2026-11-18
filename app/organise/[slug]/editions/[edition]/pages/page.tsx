import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PageEditor } from "@/components/editions-manage/PageEditor";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition pages" };

export default async function PagesPage({ params, searchParams }: { params: Promise<{ slug: string; edition: string }>; searchParams: Promise<{ open?: string }> }) {
  const { slug, edition: edSlug } = await params;
  // "?open=<page id>" lands the organiser in that page's editor — where the stale-wording warning links to.
  const open = (await searchParams)?.open;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/pages`);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="pages" />
      <p className="mb-5 max-w-2xl text-sm text-ink-soft">Pages make up your Edition&apos;s menu. The programme and updates are added automatically, so you do not need pages for them.</p>
      <PageEditor organiserSlug={slug} organiserId={organiser.id} editionSlug={edSlug} pages={bundle.pages} summary={bundle.edition.summary} openPageId={typeof open === "string" ? open : null} />
    </>
  );
}
