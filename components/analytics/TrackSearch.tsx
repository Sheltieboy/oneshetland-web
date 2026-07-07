"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * TrackSearch — fires `search_performed` once on mount when a query is present.
 *
 * Pass `section`, `query` and `resultsCount` from the server page. Renders null.
 */
export function TrackSearch({
  section,
  query,
  resultsCount,
}: {
  section: string;
  query: string;
  resultsCount: number;
}) {
  useEffect(() => {
    if (!query) return;
    track("search_performed", {
      props: { section, query, results_count: resultsCount },
    });
    // Fire once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
