import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { ParticipationManager } from "@/components/editions-commerce/ParticipationManager";
import { getOrgEntitlements, getParticipationRows, getParticipationTerms } from "@/lib/editions/commerce.server";
import { can } from "@/lib/editions/rules";
import { editionPage } from "../../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition participation" };

export default async function ParticipationPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle, role } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/participation`);
  const [terms, rows, ents] = await Promise.all([getParticipationTerms(bundle.edition.id), getParticipationRows(bundle.edition.id), getOrgEntitlements(organiser.id)]);
  const has = (f: string) => ents.some((e) => e.feature === f);
  return (<><EditionHeader organiser={organiser} edition={bundle.edition} active="participation" /><ParticipationManager slug={slug} edSlug={edSlug} terms={terms} rows={rows} canManage={can(role, "admin")} hasFees={has("participation_fees")} hasOffline={has("offline_records")} /></>);
}
