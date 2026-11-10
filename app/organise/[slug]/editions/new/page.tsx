import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/editions/rules";
import { shiftYear } from "@/lib/editions/validate";
import type { Edition } from "@/lib/editions/types";
import { EDITION_COLUMNS } from "@/lib/editions/types";
import { EditionForm } from "@/components/editions-manage/EditionForm";
import { Panel } from "@/components/editions-manage/kit";
import { organiserPage } from "../../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Edition" };

/** `?from=<edition slug>` pre-fills next year's Edition in the same series. */
export default async function NewEditionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const [{ slug }, { from }] = await Promise.all([params, searchParams]);
  const { organiser, role, sb } = await organiserPage(slug, `/organise/${slug}/editions/new`, "admin");
  if (!can(role, "admin")) notFound();
  const { data: series } = await sb.from("edition_series").select("id, name").eq("organiser_id", organiser.id).order("name");
  let seed: Parameters<typeof EditionForm>[0]["seed"];
  if (typeof from === "string" && /^[a-z0-9-]{1,80}$/.test(from)) {
    const { data } = await sb.from("editions").select(EDITION_COLUMNS).eq("organiser_id", organiser.id).eq("slug", from).maybeSingle();
    const e = data as Edition | null;
    if (e) seed = { title: e.title, kind: e.kind, starts_on: shiftYear(e.starts_on), ends_on: shiftYear(e.ends_on), series_id: e.series_id ?? "", brand_color: e.brand_color ?? "", summary: e.summary ?? "" };
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/organise/${slug}`} className="text-sm text-ink-muted hover:underline">← {organiser.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">{seed ? "Next year's Edition" : "New Edition"}</h1>
      <p className="mt-1 text-ink-soft">Start with the basics. It stays a private draft: you build it, preview it exactly as visitors will see it, then send it to OneShetland to review before you publish.</p>
      <div className="mt-6"><Panel><EditionForm mode="create" organiserSlug={slug} organiserId={organiser.id} series={(series ?? []) as { id: string; name: string }[]} seed={seed} canCreateSeries organiser={organiser} /></Panel></div>
    </div>
  );
}
