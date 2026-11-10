import Link from "next/link";
import { can } from "@/lib/editions/rules";
import { IdentityPanel } from "@/components/editions-manage/IdentityPanel";
import { Panel, btnSecondary } from "@/components/editions-manage/kit";
import { organiserPage } from "../../gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Identity" };

export default async function IdentityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organiser, role, parent } = await organiserPage(slug, `/organise/${slug}/profile`);
  const kind = parent?.kind === "business" ? "Business" : "Hub";
  const who = parent?.name ?? organiser.name;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/organise/${slug}`} className="text-sm text-ink-muted hover:underline">← {organiser.name}</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Identity</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">Your Editions are run by {who}. They use its name, logo, cover and description, and follow any change you make there. Each Edition keeps its own title, imagery and design.</p>

      <div className="mt-6 space-y-6">
        <Panel title={`From your ${kind}`} sub={`Shown on your Editions pages. To change any of this, edit it where it lives: only the owner of a Business, or the committee of a Hub, can.`}>
          <div className="flex flex-wrap items-start gap-4">
            {parent?.logo_url ? <img src={parent.logo_url} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" /> : <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-xl bg-navy text-2xl font-bold text-paper">{who.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold text-ink">{who}</p>
              {parent?.website && <p className="mt-0.5 break-words text-sm text-ink-soft">{parent.website}</p>}
              {parent?.description ? <p className="mt-2 line-clamp-4 text-sm text-ink-soft">{parent.description}</p> : <p className="mt-2 text-sm text-ink-muted">No description yet. Adding one helps people understand who is behind your Editions.</p>}
            </div>
          </div>
          {parent?.cover_url && <img src={parent.cover_url} alt="" className="mt-4 h-32 w-full rounded-xl border border-line object-cover" />}
          {parent && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {can(role, "admin") && <Link href={parent.manageHref} className={btnSecondary}>Edit your {kind} details</Link>}
              <Link href={parent.href} className={btnSecondary}>View public page</Link>
            </div>
          )}
        </Panel>

        <Panel title="Colours and imagery" sub="Your Editions can use their own logo, cover and colour instead. Anything you leave empty follows your profile.">
          <Link href={`/organise/${slug}/brand`} className={btnSecondary}>Open Brand</Link>
        </Panel>

        <Panel title="Details for your Editions">
          <IdentityPanel organiser={organiser} canEdit={can(role, "admin")} />
        </Panel>
      </div>
    </div>
  );
}
