"use client";

import { useState } from "react";

/**
 * ShareButton — uses the Web Share API where available (mobile, some desktop),
 * falling back to copying the URL to the clipboard. Mirrors the app's share
 * affordance on the event detail screen.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title, text: text ?? title, url };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing more we can do silently
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share this event"
      className="inline-flex items-center gap-2 rounded-pill bg-black/40 px-4 py-2 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-black/55"
    >
      <span aria-hidden>{copied ? "✓" : "↗"}</span>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
