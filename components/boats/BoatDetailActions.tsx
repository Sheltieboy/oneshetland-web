"use client";

import { useEffect, useState } from "react";
import { isBoatSaved, toggleSavedBoat, pushRecentBoat, type VesselStub } from "@/lib/boats-data";

/**
 * Client island for the vessel detail header: a Save/bookmark toggle
 * (localStorage-backed, mirroring the app's saved list), a Share button
 * (Web Share API + clipboard fallback), and a recently-viewed push on mount.
 */
export function BoatDetailActions({ stub, title }: { stub: VesselStub; title: string }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setSaved(isBoatSaved(stub.id));
    pushRecentBoat(stub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stub.id]);

  function onToggleSave() {
    setSaved(toggleSavedBoat(stub));
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Looking at ${title} on OneShetland — Da Boats heritage register.`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch { return; /* user cancelled */ }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* nothing more we can do */ }
  }

  const btn = "rounded-pill border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-white/25";

  return (
    <div className="mt-4 flex items-center gap-2">
      <button onClick={onToggleSave} className={btn} aria-pressed={saved}>
        {saved ? "★ Saved" : "☆ Save"}
      </button>
      <button onClick={onShare} className={btn}>
        {shared ? "✓ Link copied" : "↗ Share"}
      </button>
    </div>
  );
}
