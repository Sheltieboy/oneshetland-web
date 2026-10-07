"use client";

import { useState } from "react";
import { InvitationSection } from "./InvitationSection";
import { EmailSection } from "./EmailSection";
import type { PipelineRow } from "@/lib/launch-partners/status";
import type { InviteSummaryRow } from "@/lib/launch-partners/campaigns.server";

/**
 * The invitation and the email share one fact that exists only in memory: the private link, available right after it is
 * generated. It is held here (never saved, never logged) so the email preview can show the real button and the send
 * can use it. Reload the page and it is gone — by design; the database keeps only a hash.
 */
export function OutreachPanels({ row, claimMode, businessName, email, history = [] }: {
  row: PipelineRow; claimMode: "live" | "holding"; businessName: string; history?: InviteSummaryRow[];
  email: { contactName: string | null; contactEmail: string | null; subject: string | null; opening: string | null; body: string | null };
}) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  return (
    <>
      <InvitationSection row={row} claimMode={claimMode} onLink={setLink} history={history} />
      <EmailSection row={row} slug={row.slug} businessName={businessName} initial={email} sessionLink={link} />
    </>
  );
}
