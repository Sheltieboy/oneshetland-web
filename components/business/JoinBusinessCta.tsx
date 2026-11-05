import Link from "next/link";

/**
 * JoinBusinessCta — the invitation for Shetland businesses to be on OneShetland. Two distinct actions, both existing journeys:
 *   Claim   -> /business#find-your-business   (the claim-first finder: search for your listing, then claim it — so nobody creates a duplicate)
 *   Add     -> /directory/new                 (the free listing form; `?name=` pre-fills it when we know what they searched for)
 * No new registration system, and no mention of paid plans here: a free listing is the offer.
 *
 * variants:  compact = homepage band;  banner = Directory, near the search/filters;  empty = inside the Directory "no businesses found" card.
 */
export const JOIN_CLAIM_HREF = "/business#find-your-business";
export const JOIN_ADD_HREF = "/directory/new";

const HEADING = "Is your business on OneShetland?";
const BODY = "Already listed? Claim your business and take control of your details. Not listed yet? Add your business for free and help folk across Shetland find you.";

function Actions({ name, className = "" }: { name?: string; className?: string }) {
  const add = name ? `${JOIN_ADD_HREF}?name=${encodeURIComponent(name.slice(0, 80))}` : JOIN_ADD_HREF;
  return (
    <div className={"flex flex-col gap-2.5 sm:flex-row sm:flex-wrap " + className}>
      <Link href={JOIN_CLAIM_HREF}
        className="inline-flex min-h-[44px] items-center justify-center rounded-pill border border-navy px-5 py-2.5 text-sm font-bold text-navy transition hover:bg-navy hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
        Claim your business
      </Link>
      <Link href={add}
        className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-navy px-5 py-2.5 text-sm font-bold text-paper shadow-soft transition hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
        Add your business — free
      </Link>
    </div>
  );
}

export function JoinBusinessCta({ variant = "compact", name }: { variant?: "compact" | "banner" | "empty"; name?: string }) {
  if (variant === "empty") {
    return (
      <div className="mx-auto mt-8 max-w-xl border-t border-line pt-6 text-left" data-join-business>
        <h2 className="font-display text-lg font-bold text-ink">Is this your business?</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          If it&apos;s already listed under another name, claim it rather than adding it again. If it isn&apos;t listed yet, you can add it for free and help folk across Shetland find you.
        </p>
        <Actions name={name} className="mt-4" />
      </div>
    );
  }
  const id = variant === "compact" ? "join-business-home" : "join-business-dir";
  const shell = variant === "compact"
    ? "mx-auto max-w-6xl px-5 py-8 sm:py-10"
    : "mx-auto max-w-6xl px-5 pt-8";
  return (
    <section aria-labelledby={id} className={shell} data-join-business>
      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-paper p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8">
        <div className="max-w-2xl">
          <h2 id={id} className="font-display text-2xl font-bold leading-tight text-navy sm:text-[1.7rem]">{HEADING}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{BODY}</p>
        </div>
        <Actions className="sm:shrink-0 sm:flex-col lg:flex-row" />
      </div>
    </section>
  );
}
