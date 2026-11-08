"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSaved } from "@/components/saved/context";
import { bookmarkName, makeRef, signInHrefForSave, type SavedType } from "@/lib/saved";

export type SaveVariant =
  | "icon"    // a round white bookmark over a photo or a card corner
  | "dark"    // a pill on a dark hero (matches the Share button)
  | "light"   // a bordered pill on a light surface, with the word "Save"
  | "row";    // an icon-only bookmark inside a list row

const BASE = "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 aria-disabled:opacity-60 motion-reduce:transition-none";
const LOOK: Record<SaveVariant, string> = {
  icon: "h-11 w-11 rounded-full bg-paper/95 text-navy shadow-soft hover:bg-paper focus-visible:outline-navy",
  dark: "min-h-[44px] rounded-pill bg-black/40 px-4 py-2 text-sm text-paper backdrop-blur-sm hover:bg-black/55 focus-visible:outline-white",
  light: "min-h-[44px] rounded-pill border border-line-strong px-4 py-2 text-sm text-ink hover:bg-sand focus-visible:outline-navy",
  row: "h-11 w-11 rounded-full text-ink-soft hover:bg-sand focus-visible:outline-navy",
};

/** An inline bookmark (there is no icon library). Outline when not saved, filled when saved. */
function Bookmark({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4.2L6 21z" />
    </svg>
  );
}

/**
 * The one bookmark every page uses. Renders NOTHING unless My Saved is switched on, so with the feature off the page is exactly what it was.
 *
 * A button that reports pressed or not (aria-pressed), named after the item ("Save {title}", and the date for one date of a run), with a 44px
 * target. A tap SAVES or REMOVES explicitly (never a blind flip), shows the small "Saved" message with Undo, and the message is read out politely
 * by the provider. Signed out, a tap goes to sign-in and back with `?save=` so the save can be finished (and confirmed) afterwards.
 *
 * Place it as a SIBLING over a relatively positioned wrapper, never inside a <Link> (a button inside a link is invalid and double-fires).
 */
export function SaveButton({
  type, id, occurrenceKey = null, title, dateLabel = null, variant = "icon", label = "Save", hint, className = "",
}: {
  type: SavedType; id: string; occurrenceKey?: string | null; title: string; dateLabel?: string | null;
  variant?: SaveVariant; label?: string; /** a tooltip, e.g. "Save this date" */ hint?: string; className?: string;
}) {
  const api = useSaved();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const ref = makeRef(type, id, occurrenceKey);
  const { enabled, signedIn, track } = api;

  const valid = ref !== null;
  useEffect(() => { if (enabled && signedIn && valid) track(type, id); }, [enabled, signedIn, valid, track, type, id]);

  if (!enabled || !ref) return null;
  const saved = api.isSaved(ref);

  async function onClick() {
    if (!ref || busy) return;
    if (!signedIn) { router.push(signInHrefForSave(`${window.location.pathname}${window.location.search}`, ref)); return; }
    setBusy(true);
    try {
      const out = saved ? await api.unsave(ref) : await api.save(ref);
      if (out === "signin") router.push(signInHrefForSave(`${window.location.pathname}${window.location.search}`, ref));
    } finally { setBusy(false); }
  }

  const showText = variant === "dark" || variant === "light";
  return (
    <button
      type="button"
      data-save-button=""
      onClick={() => void onClick()}
      aria-disabled={busy || undefined}   // not `disabled`: a disabled button drops keyboard focus, and onClick already ignores a tap while busy
      aria-pressed={saved}
      aria-label={bookmarkName(title, dateLabel)}
      title={hint}
      className={`${BASE} ${LOOK[variant]} ${className}`}
    >
      <Bookmark filled={saved} />
      {showText && <span aria-hidden>{saved ? "Saved" : label}</span>}   {/* the visible word follows the state; the accessible name stays constant */}
    </button>
  );
}
