"use client";

import { useState } from "react";
import { evidenceLinkAction, photoLinkAction } from "@/app/admin/fetch/actions";

/**
 * Opens a photo or verification document through a 2-minute signed link fetched at the moment of the click. The link is never
 * rendered into the page or kept; a new one is fetched every time (and, for driver documents, every view is recorded).
 */
export function ShortLinkButton({ kind, id, label }: { kind: "photo" | "evidence"; id: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true); setError(null);
    try {
      const r = kind === "photo" ? await photoLinkAction(id) : await evidenceLinkAction(id);
      if (r.ok) window.open(r.url, "_blank", "noopener,noreferrer"); else setError(r.error);
    } catch { setError("The link could not be fetched."); } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={open} disabled={busy} className="rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink hover:bg-sand disabled:opacity-40">
        {busy ? "Opening…" : label}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}
