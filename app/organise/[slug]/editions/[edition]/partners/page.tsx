import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PartnersManager } from "@/components/editions-manage/PartnersManager";
import { getPartnerRows } from "@/lib/editions/data.server";
import { dateRangeLabel, can } from "@/lib/editions/rules";
import Link from "next/link";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition partners" };

export default async function PartnersPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle, role, hub } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/partners`);
  const rows = await getPartnerRows(bundle.edition.id);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="partners" />
      {hub && (
        <p className="mb-4 rounded-lg bg-sand/60 px-3 py-2 text-sm text-ink-soft">
          Want to feature {hub.name}’s own events and activities? You do not need to invite them: use <Link href={`/organise/${slug}/editions/${edSlug}/programme#add-from-hub`} className="font-semibold text-ink underline">Add from your Hub</Link> on the Programme tab.
        </p>
      )}
      <PartnersManager
        organiserSlug={slug} editionSlug={edSlug} organiserName={organiser.name} editionTitle={bundle.edition.title}
        dateLabel={dateRangeLabel(bundle.edition.starts_on, bundle.edition.ends_on)} rows={rows} canManage={can(role, "editor")}
      />
    </>
  );
}
