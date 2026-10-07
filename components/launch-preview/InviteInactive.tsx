import Link from "next/link";

export type InactiveVariant = "inactive" | "unavailable" | "not_open";

/**
 * What someone sees when a private Launch Partner link does not open a preview. DELIBERATELY the same for every reason a link can be dead — expired,
 * revoked, replaced, never existed, malformed, the wrong preview — and it takes no input at all: no slug, token, business or campaign is passed in, so
 * nothing about any of them can appear here. It offers a calm way back (a reply, or hello@oneshetland.com) and never creates or reveals a replacement link.
 *
 * The two other variants are for someone holding a VALID link whose invitation simply cannot be used (taken, or claiming not open yet); they too say
 * nothing about anyone else's claim.
 */
const COPY: Record<InactiveVariant, { eyebrow: string; title: string; lead: string }> = {
  inactive: { eyebrow: "Launch Partner invitation", title: "This invitation link is no longer active", lead: "This can happen if the invitation has expired or a newer link has been issued." },
  unavailable: { eyebrow: "Launch Partner invitation", title: "This invitation is no longer available", lead: "It can’t be used any more." },
  not_open: { eyebrow: "Launch Partner invitation", title: "Claiming isn’t open yet", lead: "We’ll be in touch when it is." },
};

export function InviteInactive({ variant = "inactive" }: { variant?: InactiveVariant }) {
  const c = COPY[variant];
  return (
    <section data-invite-state={variant} className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="eyebrow text-teal">{c.eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-navy sm:text-5xl">{c.title}</h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">{c.lead}</p>
      <p className="mt-4 max-w-md text-base text-ink-soft">
        If you were expecting to join OneShetland as a Launch Partner, reply to the email you received or contact{" "}
        <a href="mailto:hello@oneshetland.com" className="font-semibold text-navy underline underline-offset-2">hello@oneshetland.com</a> and we’ll help.
      </p>
      <Link href="/" className="mt-8 rounded-pill border border-line-strong px-6 py-3 text-sm font-semibold text-ink-soft transition hover:bg-sand">Go to OneShetland</Link>
    </section>
  );
}
