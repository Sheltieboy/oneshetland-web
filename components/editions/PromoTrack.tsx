"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { trackPromo } from "@/lib/editions/promo-track";
import type { PromoSurface } from "@/lib/editions/promo-public";

/** A link that counts one tap on a promoted card. The count is sent without waiting, so navigation is never delayed or blocked. */
export function PromoLink({ href, editionId, surface, className, children }: { href: string; editionId: string; surface: Exclude<PromoSurface, "edition_page">; className?: string; children: ReactNode }) {
  return <Link href={href} className={className} onClick={() => trackPromo(editionId, surface, "tap")}>{children}</Link>;
}

/** Counts one view of an Edition page (the database ignores Editions with no booking). Renders nothing. */
export function PromoView({ editionId }: { editionId: string }) {
  useEffect(() => { trackPromo(editionId, "edition_page", "view"); }, [editionId]);
  return null;
}
