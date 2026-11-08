"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useSaved } from "@/components/saved/context";
import { SAVE_PARAM, TYPE_NOUN, parseSaveIntent, stripSaveParam } from "@/lib/saved";
import { CONFIRM_BAR } from "@/lib/saved-copy";

/** The same address without `save=`, written into the history so a refresh or a shared link cannot save again. */
function stripFromAddress() {
  try {
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const clean = stripSaveParam(now);
    if (clean !== now) window.history.replaceState(window.history.state, "", clean);
  } catch { /* the address stays as it is; nothing is saved without a tap */ }
}

/**
 * Finishes a save that was interrupted by sign-in. After sign-in the person lands back on the page with `?save=<type>:<id>[:<key>]`. This reads
 * and VALIDATES that value (type list, lower-case uuid, key shape), asks "Save this?" and saves only when they say yes, so a crafted link can
 * never change anything silently. save_item is idempotent, so a double tap or a refresh cannot toggle the save off. Either answer removes the
 * parameter from the address.
 */
const subscribe = (cb: () => void) => { window.addEventListener("popstate", cb); return () => window.removeEventListener("popstate", cb); };

export function SaveIntentRunner() {
  const { enabled, signedIn, save } = useSaved();
  usePathname();   // re-read the address after a client-side navigation
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const raw = new URLSearchParams(search).get(SAVE_PARAM);
  const [answered, setAnswered] = useState<string | null>(null);   // the value already confirmed or skipped
  const [busy, setBusy] = useState(false);
  const ref = enabled && signedIn && raw !== null && raw !== answered ? parseSaveIntent(raw) : null;

  // Not a well-formed reference: ignore it and tidy the address.
  useEffect(() => { if (enabled && signedIn && raw !== null && !parseSaveIntent(raw)) stripFromAddress(); }, [enabled, signedIn, raw]);

  if (!ref) return null;

  async function confirm() {
    if (!ref || busy) return;
    setBusy(true);
    await save(ref);
    stripFromAddress();
    setAnswered(raw);
    setBusy(false);
  }
  function skip() { stripFromAddress(); setAnswered(raw); }

  return (
    <div
      role="region" aria-label="Save this?"
      className="fixed inset-x-0 bottom-0 z-[109] border-t border-line bg-paper px-4 py-3 shadow-lift"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{CONFIRM_BAR.question(TYPE_NOUN[ref.type])}</p>
        <div className="flex gap-2">
          <button type="button" onClick={skip} className="min-h-[44px] rounded-pill border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
            {CONFIRM_BAR.skip}
          </button>
          <button type="button" onClick={() => void confirm()} disabled={busy} className="min-h-[44px] rounded-pill bg-navy px-5 text-sm font-bold text-paper hover:brightness-110 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
            {CONFIRM_BAR.save}
          </button>
        </div>
      </div>
    </div>
  );
}
