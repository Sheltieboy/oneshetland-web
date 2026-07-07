"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * TicketLink — a drop-in replacement for the external "Get tickets" <a> that
 * fires `ticket_outbound_clicked` on click. Forwards all anchor props through.
 */
export function TicketLink({
  eventId,
  children,
  onClick,
  ...rest
}: {
  eventId: string;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track("ticket_outbound_clicked", {
          objectType: "event",
          objectId: eventId,
        });
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
