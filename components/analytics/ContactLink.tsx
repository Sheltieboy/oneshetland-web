"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * ContactLink — a drop-in replacement for plain <a> contact links that fires
 * `contact_clicked` on click. Forwards all anchor props through.
 */
export function ContactLink({
  objectType,
  objectId,
  businessId,
  hubId,
  method,
  children,
  onClick,
  ...rest
}: {
  objectType: "business" | "hub";
  objectId: string;
  businessId?: string;
  hubId?: string;
  method: string;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track("contact_clicked", {
          objectType,
          objectId,
          businessId,
          hubId,
          props: { method },
        });
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
