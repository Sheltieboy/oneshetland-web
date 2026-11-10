"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

/** A calendar download link that records, anonymously and only with analytics consent, that a calendar file was downloaded. */
export function CalendarLink({ href, editionId, className, children }: { href: string; editionId?: string; className?: string; children: ReactNode }) {
  return <a href={href} download className={className} onClick={() => track("edition_calendar_exported", { objectType: "edition", objectId: editionId })}>{children}</a>;
}
