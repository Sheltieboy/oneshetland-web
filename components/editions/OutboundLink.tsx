"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * A link out of an Edition that counts itself.
 *
 * An Edition's job is to send people somewhere — to a seller's listing, to a Hub, to a What's On
 * listing, to a sponsor's website. Until now every one of those was a plain anchor, so the question an
 * organiser most wants answered ("did this send anyone to my sellers?") had no data behind it.
 *
 * WHAT IS RECORDED, AND WHAT IS NOT. The event carries the KIND of destination and, for somewhere on
 * OneShetland, that thing's id. For an external site it carries the HOSTNAME and nothing else — never
 * the path, never the query string, which can hold tokens or personal data. No referrer, no visitor.
 * It rides the existing consented, batched analytics pipeline, so nothing at all is sent until the
 * visitor has accepted analytics, and the counts an organiser sees are masked below 5.
 *
 * The click is counted without waiting: `track` queues and the navigation proceeds immediately.
 */

/** What the visitor is being sent to. Kept short and closed so it stays aggregatable. */
export type OutboundTo = "business" | "hub" | "event" | "activity" | "directory" | "whats-on" | "sponsor" | "other";
/** Where on the Edition the link sat, so an organiser can tell a card from a sponsor strip. */
export type OutboundBlock = "cards" | "prose" | "partners" | "sponsors" | "programme" | "hero";

const hostOf = (href: string): string | null => {
  try { return new URL(href).hostname.replace(/^www\./, "") || null; } catch { return null; }
};

/** Infer the destination kind from a site path, so callers rarely have to say. */
export function inferTo(href: string): OutboundTo {
  if (/^\/directory\/[^/]+/.test(href)) return "business";
  if (/^\/hubs\/[^/]+/.test(href)) return "hub";
  if (/^\/whats-on\/[^/]+/.test(href)) return "event";
  if (/^\/whats-on\/regular\/[^/]+/.test(href)) return "activity";
  if (href === "/directory" || href === "/local") return "directory";
  if (href === "/whats-on") return "whats-on";
  return "other";
}

/** The id of the thing being linked to, where the address carries one. Never a slug with a query. */
const idFrom = (href: string): string | undefined =>
  /^\/(?:directory|hubs|whats-on)\/([^/?#]+)/.exec(href)?.[1];

export function EditionOutboundLink({
  href, editionId, page, block, to, className, children, external,
}: {
  href: string;
  editionId: string;
  /** The Edition page this link sits on — the page slug, or "home". */
  page: string;
  block: OutboundBlock;
  /** Override the inferred destination kind. */
  to?: OutboundTo;
  className?: string;
  children: ReactNode;
  /** Force the external treatment. Otherwise anything not starting "/" is external. */
  external?: boolean;
}) {
  const isExternal = external ?? !href.startsWith("/");

  if (isExternal) {
    const host = hostOf(href);
    return (
      <a
        href={href} target="_blank" rel="noopener noreferrer" className={className}
        onClick={() => track("edition_outbound_clicked", {
          objectType: "edition", objectId: editionId,
          // hostname only: never the path or the query string
          props: { host: host ?? "unknown", to: to ?? "other", page, block },
        })}
      >
        {children}
      </a>
    );
  }

  const kind = to ?? inferTo(href);
  const targetId = idFrom(href);
  return (
    <Link
      href={href} className={className}
      onClick={() => track("edition_referral_clicked", {
        objectType: "edition", objectId: editionId,
        props: { to: kind, ...(targetId ? { target_id: targetId } : {}), page, block },
      })}
    >
      {children}
    </Link>
  );
}
