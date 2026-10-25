"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { headerSummaryAction } from "@/app/fetch/actions";
import type { HeaderSummary } from "@/lib/fetch/header";

const TONE: Record<string, { bg: string; fg: string; icon: string }> = {
  attention: { bg: "#FEF3C7", fg: "#92400E", icon: "!" },
  good: { bg: "#D1FAE5", fg: "#065F46", icon: "✓" },
  neutral: { bg: "#FFEDD5", fg: "#9A3412", icon: "⏳" },
  done: { bg: "#D1FAE5", fg: "#065F46", icon: "✓" },
  muted: { bg: "#F1EFEA", fg: "#4B5563", icon: "–" },
};

/**
 * The site header's Fetch chip (Fetch v2). Where the member's live Fetch is, in the same words as the Fetch page, refreshed every 30 s
 * while the tab is visible through a server action — no browser Supabase client and no subscription to a raw job table. Words and an
 * icon, never colour alone; nothing animates.
 */
export function HeaderChip({ initial }: { initial: HeaderSummary }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") headerSummaryAction().then(setS).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  if (!s) return null;
  const t = TONE[s.tone] ?? TONE.neutral;
  return (
    <Link href={s.href} aria-label={`Your Fetch: ${s.label}${s.count > 1 ? `, ${s.count} live` : ""}`}
      className="hidden items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold hover:brightness-95 focus:outline-none focus-visible:ring-2 sm:inline-flex"
      style={{ background: t.bg, color: t.fg }}>
      <span aria-hidden>{t.icon}</span> Fetch: {s.label}{s.count > 1 ? ` · ${s.count}` : ""}
    </Link>
  );
}
