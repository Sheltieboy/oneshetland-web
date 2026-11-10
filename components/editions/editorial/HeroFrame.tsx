"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * The Edition's home page gets the full-height masthead; every inner page (programme, partners, updates, organiser pages) gets a compact one, so a visitor is not
 * asked to scroll past a photograph on every click. The selected segment is known during server rendering, so the right size is in the first HTML (no flash).
 */
export function HeroFrame({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return <div className={segment ? "ed-compact" : undefined}>{children}</div>;
}
