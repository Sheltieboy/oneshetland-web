"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

/** The external "Tickets" button. Tickets are sold on the organiser's own site; we only record that the link was followed (no personal data). */
export function SessionTicketLink({ href, editionId, sessionId, children }: { href: string; editionId: string; sessionId: string; children: ReactNode }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      onClick={() => track("ticket_outbound_clicked", { objectType: "edition", objectId: editionId, props: { session_id: sessionId } })}
      className="ed-btn ed-btn--solid ed-btn--small"
    >
      {children}
    </a>
  );
}
