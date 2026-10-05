"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitLaunchClaim, type ClaimResult } from "@/app/launch/[slug]/claim/actions";
import type { ClaimState } from "@/lib/launch-preview/invite";

const NAVY = "#032f4c";
const LIME = "#c8f169";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#fbf8f2" }}>
      <div className="border-b border-white/10 text-white" style={{ background: NAVY }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
          Private · OneShetland launch partners
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">{children}</main>
    </div>
  );
}

const input = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-[#12b3d6]";

function Card({ title, children, tone = "plain" }: { title: string; children: React.ReactNode; tone?: "plain" | "good" }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-9">
      {tone === "good" && <span className="mb-4 grid h-12 w-12 place-items-center rounded-full text-xl font-black" style={{ background: LIME, color: NAVY }} aria-hidden="true">✓</span>}
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      <div className="mt-4 space-y-3 text-ink-soft">{children}</div>
    </section>
  );
}

export function ClaimFlow({ slug, businessId, businessName, locality, state, email, defaultName, defaultPhone }: {
  slug: string; businessId: string; businessName: string; locality: string; state: ClaimState;
  email: string | null; defaultName: string; defaultPhone: string;
}) {
  const [result, action, pending] = useActionState<ClaimResult | null, FormData>(submitLaunchClaim.bind(null, slug), null);
  const effective: ClaimState = result?.ok ? result.state : state;
  const back = <Link href={`/launch/${slug}`} className="font-semibold underline underline-offset-2">← Back to your preview</Link>;

  if (effective === "pending") {
    return (
      <Shell>
        <Card title="Your claim has been sent" tone="good">
          <p>We&apos;ll confirm the claim before giving you management access. <strong className="text-ink">Nothing from your private preview has been published.</strong></p>
          <p>You don&apos;t need to do anything else. Once Darren has confirmed it, come back to your invitation and you&apos;ll find a button to manage {businessName}.</p>
          <p className="pt-2 text-sm">{back}</p>
        </Card>
      </Shell>
    );
  }
  if (effective === "owner") {
    return (
      <Shell>
        <Card title={`You manage ${businessName}`} tone="good">
          <p>Claimed · Still private setup. Your existing OneShetland listing is public as it always was; the preview, examples and anything you set up from here stay private until you choose to publish them.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/business/${businessId}/manage`} className="rounded-full px-6 py-3 text-sm font-bold" style={{ background: LIME, color: NAVY }}>Manage {businessName} →</Link>
            <Link href={`/business/${businessId}/manage/products`} className="rounded-full border border-line-strong px-6 py-3 text-sm font-bold text-ink-soft hover:bg-sand">Go to Products</Link>
          </div>
          <p className="pt-2 text-sm">{back}</p>
        </Card>
      </Shell>
    );
  }
  if (effective === "claimed_by_other") {
    return (
      <Shell>
        <Card title="This business has already been claimed">
          <p>{businessName} is already managed from another OneShetland account, so this invitation can&apos;t be used to claim it. If that doesn&apos;t look right, please reply to the message Darren sent you and he&apos;ll look into it.</p>
        </Card>
      </Shell>
    );
  }
  if (effective === "invite_used") {
    return (
      <Shell>
        <Card title="This invitation has already been used">
          <p>It was used from a different OneShetland account, and that claim is still being looked at. If you meant to claim {businessName} yourself, please reply to the message Darren sent you and he&apos;ll sort it out.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-9">
        <p className="eyebrow" style={{ color: "#0e9ab8" }}>Launch partner invitation</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">Claim {businessName}</h1>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-[#fbf8f2] px-4 py-3">
          <span aria-hidden="true" className="text-lg">🏪</span>
          <div><p className="font-display text-lg font-bold text-ink">{businessName}</p><p className="text-sm text-ink-soft">{locality}</p></div>
        </div>

        {effective === "rejected" && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Your earlier claim wasn&apos;t approved. You can send another with more detail, or reply to Darren&apos;s message.</p>}

        <p className="mt-5 text-ink-soft">
          Claiming gives you access to review and manage your business. Nothing new is published until you choose to publish it. We check every claim by hand before anyone gets management access.
        </p>

        <form action={action} className="mt-6 space-y-5">
          <div><label htmlFor="name" className="block text-sm font-semibold text-ink">Your name <span className="text-rose-500">*</span></label>
            <input id="name" name="name" defaultValue={defaultName} required maxLength={200} autoComplete="name" className={input} /></div>
          <div><label htmlFor="email" className="block text-sm font-semibold text-ink">Contact email <span className="text-rose-500">*</span></label>
            <input id="email" name="email" type="email" defaultValue={email ?? ""} required maxLength={254} autoComplete="email" autoCapitalize="none" className={input} /></div>
          <div><label htmlFor="phone" className="block text-sm font-semibold text-ink">Contact phone <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="phone" name="phone" type="tel" defaultValue={defaultPhone} maxLength={50} autoComplete="tel" className={input} /></div>
          <div><label htmlFor="role" className="block text-sm font-semibold text-ink">Your role <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="role" name="role" maxLength={100} placeholder="e.g. Owner, Manager" className={input} /></div>
          <div><label htmlFor="evidence" className="block text-sm font-semibold text-ink">How can we verify you? <span className="font-normal text-ink-muted">(optional)</span></label>
            <textarea id="evidence" name="evidence" rows={3} maxLength={2000} placeholder="e.g. a business email address, your website, or how you're connected" className={input + " resize-none"} /></div>

          <label className="flex items-start gap-3 rounded-2xl border-2 p-4" style={{ borderColor: NAVY }}>
            <input type="checkbox" name="confirm" required className="mt-1 h-5 w-5" />
            <span className="font-semibold text-ink">I confirm that I own, or am authorised to manage, {businessName}.</span>
          </label>

          {result && !result.ok && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{result.error}</p>}

          <button type="submit" disabled={pending} className="w-full rounded-full py-3.5 text-base font-bold shadow-lg transition hover:brightness-105 disabled:opacity-50" style={{ background: LIME, color: NAVY }}>
            {pending ? "Sending…" : "Send my claim"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-ink-muted">
          <span>Signed in as <strong className="text-ink-soft">{email ?? "your account"}</strong></span>
          <form action="/auth/sign-out" method="post"><button className="font-semibold underline underline-offset-2">Not you? Sign out</button></form>
        </div>
        <p className="mt-4 text-sm">{back}</p>
      </section>
    </Shell>
  );
}
