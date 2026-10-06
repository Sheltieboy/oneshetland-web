import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireBusinessOwner } from "@/lib/business-server";
import { getOwnerLaunchSetup } from "@/lib/launch-partners/owner-setup.server";
import { LaunchSetupEditor, type EditorInitial } from "@/components/business/LaunchSetupEditor";
import { LaunchSetupCard } from "@/components/business/LaunchSetupCard";
import { GoLivePanel } from "@/components/business/GoLivePanel";
import { gbp } from "@/lib/business-page/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your launch setup", robots: { index: false, follow: false, nocache: true } };

/**
 * The owner's launch setup: review what was prepared for them, change it, and approve it. Private throughout. Two locks, both in the
 * database: they must own THIS business (requireBusinessOwner) and hold an approved launch-partner claim for it (the draft reader
 * returns nothing otherwise — then this is an ordinary 404, indistinguishable from "no setup"). Nothing on this page publishes anything.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusinessOwner(id, { returnPath: `/business/${id}/manage/launch-setup` });
  const ctx = await getOwnerLaunchSetup(business.id);
  const base = `/business/${business.id}/manage`;
  if (!ctx.draft || !ctx.prepared) notFound();
  const back = <div className="border-b border-line bg-white"><div className="mx-auto max-w-4xl px-5 py-2 text-sm"><Link href={base} className="font-semibold text-ink-soft hover:text-ink">← Back to your dashboard</Link></div></div>;
  if (ctx.launch.state === "none" || ctx.launch.state === "ended") {
    return (<>{back}<div className="mx-auto max-w-4xl px-5 py-10"><h1 className="font-display text-3xl font-bold text-ink">Your launch setup</h1>
      <p className="mt-2 text-ink-soft">{ctx.launch.state === "none" ? "Your launch setup opens as soon as your Launch Partner access has been added. Nothing has changed on your listing." : "Your launch-partner access has ended, so there is nothing to set up here. Your listing and everything on it is unchanged."}</p></div></>);
  }
  const d = ctx.draft;
  const approvedAt = ctx.versions.find((v) => v.kind === "approved")?.created_at ?? null;
  const initial: EditorInitial = {
    headline: d.hero.headline ?? "", tagline: d.hero.tagline, eyebrow: d.hero.eyebrow ?? "", locality: d.hero.locality ?? "",
    treatment: (d.hero.treatment ?? (d.hero.gallery?.length === 3 ? "mosaic" : "photo")) as EditorInitial["treatment"],
    gallery: (ctx.prepared.hero.gallery ?? []).map((g) => ({ src: g.src, alt: g.alt })), keepGallery: (d.hero.gallery ?? []).map((g) => g.src),
    story: d.story ? { title: d.story.title, body: d.story.body.join("\n\n") } : null,
    useful: (d.useful ?? []).map((u) => ({ title: u.title, body: u.body.join("\n\n") })),
  };
  const examples = d.products ?? [];
  return (
    <>
      {back}
      <div className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Your launch setup</h1>
        {ctx.launch.state === "live"
          ? <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">You’re live. Your approved page is public. Anything you change here stays private until you publish it.</p>
          : <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">Nothing here is live. This is a private draft that only you and OneShetland can see. Your public listing hasn’t changed.</p>}

        <div className="mt-6"><LaunchSetupCard launch={ctx.launch} href={base} publicHref={`/directory/${business.id}`} hideCta /></div>

        <div className="mt-6 flex flex-wrap gap-2">
          {ctx.launch.state === "live" ? <Link href={`/directory/${business.id}`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">View my public page →</Link> : null}
          <Link href={`${base}/page-draft`} target="_blank" className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">{ctx.launch.state === "live" ? "See my saved changes →" : "See your page as a draft →"}</Link>
          <Link href={`${base}/page-draft?view=future-live`} target="_blank" className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">See how customers will see it →</Link>
        </div>

        {(ctx.launch.state === "approved" || ctx.launch.state === "live") && <div className="mt-6"><GoLivePanel businessId={business.id} publicHref={`/directory/${business.id}`} live={ctx.launch.state === "live"} waiting={ctx.launch.approvalWaiting} /></div>}

        <div className="mt-6"><LaunchSetupEditor businessId={business.id} initial={initial} locked={ctx.launch.state === "approved"} approvedAt={approvedAt} live={ctx.launch.state === "live"} unpublishedChanges={ctx.launch.unpublishedChanges} /></div>

        <section aria-labelledby="examples-h" className="mt-6 rounded-card border border-line bg-paper p-5 shadow-soft">
          <h2 id="examples-h" className="font-display text-xl font-bold text-ink">Examples we prepared <span className="text-sm font-semibold text-ink-muted">· not on sale</span></h2>
          <p className="mt-1 text-sm text-ink-soft">These are pictures of what’s already on your own website, shown so you can judge how a page could look. <strong>They aren’t products or services on OneShetland</strong>, nothing is copied into your business, and customers can’t buy them. When you’re ready, add your real products and services yourself.</p>
          {examples.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2">{examples.map((p) => <li key={p.id} className="rounded-lg bg-cream/60 px-3 py-2 text-sm"><span className="font-semibold text-ink">{p.title}</span> <span className="text-ink-muted">· {gbp(p.price)} (example)</span></li>)}</ul>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`${base}/products`} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95">Add my products</Link>
            <Link href={`${base}/products/import`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Import products from a file</Link>
            <Link href={`${base}/services`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Add my services</Link>
            <Link href={`${base}/profile`} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">Complete my business details</Link>
          </div>
        </section>
      </div>
    </>
  );
}
