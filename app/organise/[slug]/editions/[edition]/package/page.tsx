import { can } from "@/lib/editions/rules";
import { activeUntil } from "@/lib/editions/journey";
import { getActivePackages, getCommerceEnabled } from "@/lib/editions/commerce.server";
import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { PackageStep } from "@/components/editions-manage/PackageStep";
import { Panel } from "@/components/editions-manage/kit";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a package" };

export default async function EditionPackagePage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, role, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/package`);
  const { edition } = bundle;
  const [packages, commerceOn] = await Promise.all([getActivePackages(organiser.id), getCommerceEnabled()]);
  const until = bundle.entitled ? activeUntil(bundle.entitlements) : null;
  return (
    <>
      <EditionHeader organiser={organiser} edition={edition} active="overview" />
      <div className="max-w-4xl">
        <Panel title="Choose a package" sub="A package covers your Edition for a period of time. You choose it after OneShetland has approved your Edition, then you can publish.">
          <PackageStep organiserSlug={slug} editionSlug={edition.slug} editionTitle={edition.title} approved={edition.review_state === "approved"} packages={packages}
            commerceOn={commerceOn} canChoose={can(role, "admin")} activeUntilIso={until} published={edition.status === "published"} />
        </Panel>
      </div>
    </>
  );
}
