"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The start of the real claim flow. Pressing the button only opens a short reassurance; "Continue →" is an ordinary
 * link to the claim page, which handles sign-in. This component makes no request and holds no secret.
 */
export function ClaimEntry({ slug, businessName, signedIn, holding = false }: { slug: string; businessName: string; signedIn: boolean; holding?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="claim-reassurance"
        className="rounded-full bg-[#c8f169] px-7 py-4 text-base font-bold text-[#032f4c] shadow-lg transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        Claim {businessName} →
      </button>
      <p className="mt-3 text-sm font-semibold text-white/85">Still private. Nothing goes live until you approve it.</p>
      {open && (
        <div id="claim-reassurance" className="mt-6 max-w-xl rounded-3xl border border-white/25 bg-white/10 p-6 text-left backdrop-blur-sm">
          <p className="font-display text-2xl font-bold text-white">Before you continue</p>
          {holding ? (
            <>
              <p className="mt-2 text-white/90">Claiming isn&apos;t open on this private preview yet — there&apos;s nothing for you to do right now, and pressing this button has not sent or created anything.</p>
              <p className="mt-2 text-sm text-white/75">When you&apos;re ready, reply to Darren&apos;s message and he&apos;ll switch it on with you. Nothing goes live until you approve it.</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-white/90">
            Claiming gives you access to review and manage your business. Nothing new is published until you choose to publish it.
              </p>
              <p className="mt-2 text-sm text-white/75">
            {signedIn ? "You're signed in, so you'll go straight to confirming your details." : "You'll be asked to sign in or create a OneShetland account, then you'll come straight back here."}
              </p>
              <Link href={`/launch/${slug}/claim`} className="mt-5 inline-block rounded-full bg-white px-6 py-3 text-sm font-bold text-[#032f4c] shadow hover:brightness-95">Continue →</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
