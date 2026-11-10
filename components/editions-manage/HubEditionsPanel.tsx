"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createHubEditionsOrganiser } from "@/app/hubs/[id]/manage/editions/actions";
import { suggestOrganiserSlug } from "@/lib/editions/hub-brand";
import { Field, Notice, btnPrimary, btnSecondary, inputCls } from "./kit";
import { useAction } from "./use-action";

/**
 * "Run your own Edition", for a Hub's owner or committee. They never see the organiser machinery: one button sets Editions up for the Hub (the Hub's own name, logo and
 * colour are used automatically, and the Hub's committee is the team), then they carry on in the organiser tools.
 */
export function HubEditionsPanel({ hubId, hubName, hubSlug, organiser }: {
  hubId: string; hubName: string; hubSlug: string | null; organiser: { slug: string; status: string; editions: number } | null;
}) {
  const router = useRouter();
  const create = useAction();
  const [slug, setSlug] = useState(() => suggestOrganiserSlug(hubSlug || hubName));
  const card = "rounded-card border border-line bg-paper p-5 shadow-soft";
  if (organiser) {
    return (
      <section aria-labelledby="own-h" className={card}>
        <h2 id="own-h" className="font-display text-xl font-bold text-ink">Your Hub&rsquo;s Editions</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          {hubName} runs Editions as <strong className="font-semibold text-ink">/{organiser.slug}</strong>. {organiser.editions === 0 ? "You have not made an Edition yet." : `${organiser.editions} Edition${organiser.editions === 1 ? "" : "s"} so far.`}{" "}
          Everyone on your Hub&rsquo;s committee can manage them, and that follows your committee automatically.
        </p>
        <p className="mt-1 text-sm text-ink-muted">{organiser.status === "verified" ? "Verified: you can publish when an Edition is ready." : "Not verified yet: you can build and preview Editions now, and ask OneShetland to verify before publishing."}</p>
        <div className="mt-4"><Link href={`/organise/${organiser.slug}`} className={btnPrimary}>Open your Edition tools</Link></div>
      </section>
    );
  }
  return (
    <section aria-labelledby="own-h" className={card}>
      <h2 id="own-h" className="font-display text-xl font-bold text-ink">Run your own Edition</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        A festival, a season or a campaign with its own beautiful page, programme and journal, run by {hubName}. It uses your Hub&rsquo;s name, logo and colour, and your committee manages it with
        the permissions they already have. Nothing about your Hub is copied.
      </p>
      <form className="mt-4 max-w-md space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); create.run(() => createHubEditionsOrganiser(hubId, slug), { onOk: (r) => router.push(`/organise/${(r as unknown as { slug: string }).slug}`) }); }}>
        <Field label="Web address for your Editions" htmlFor="hub-org-slug" hint="Letters, numbers and hyphens. You can only choose this once.">
          <input id="hub-org-slug" className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={60} autoComplete="off" spellCheck={false} />
        </Field>
        <Notice msg={create.msg} />
        <div className="flex gap-2.5"><button type="submit" className={btnPrimary} disabled={create.pending}>{create.pending ? "Setting up…" : "Set up Editions for my Hub"}</button><Link href="/editions" className={btnSecondary}>See how Editions look</Link></div>
      </form>
    </section>
  );
}
