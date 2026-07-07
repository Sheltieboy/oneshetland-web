"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * TrackView — fires a single analytics event on mount.
 *
 * Drop into a server component to record a view without converting the page
 * to a client component. Renders nothing.
 */
export function TrackView({
  event,
  objectType,
  objectId,
  businessId,
  hubId,
  extra,
}: {
  event: string;
  objectType?: string;
  objectId?: string;
  businessId?: string;
  hubId?: string;
  extra?: Record<string, unknown>;
}) {
  useEffect(() => {
    track(event, { objectType, objectId, businessId, hubId, props: extra });
    // Fire once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
