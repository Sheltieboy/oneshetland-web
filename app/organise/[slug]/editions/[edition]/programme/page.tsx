import { EditionHeader } from "@/components/editions-manage/EditionHeader";
import { ProgrammeManager } from "@/components/editions-manage/ProgrammeManager";
import { editionPage } from "../../../../gate";
import { getPartnerRows } from "@/lib/editions/data.server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edition programme" };

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition: edSlug } = await params;
  const { organiser, bundle } = await editionPage(slug, edSlug, `/organise/${slug}/editions/${edSlug}/programme`);
  // approved business partners (the only ones a session may name) and who is already named where
  const partners = (await getPartnerRows(bundle.edition.id)).filter((p) => p.kind === "business" && p.state === "approved").map((p) => ({ link_id: p.link_id, name: p.subject_name }));
  const sb = await createClient();
  const ids = bundle.sessions.map((x) => x.id);
  const { data: sbRows } = ids.length ? await sb.from("edition_session_businesses").select("session_id, link_id").in("session_id", ids) : { data: [] };
  const sessionLinks: Record<string, string[]> = {};
  for (const r of (sbRows ?? []) as { session_id: string; link_id: string }[]) (sessionLinks[r.session_id] ??= []).push(r.link_id);
  return (
    <>
      <EditionHeader organiser={organiser} edition={bundle.edition} active="programme" />
      <ProgrammeManager organiserSlug={slug} edition={bundle.edition} sessions={bundle.sessions} venues={bundle.venues} organiserId={organiser.id} partners={partners} sessionLinks={sessionLinks} />
    </>
  );
}
