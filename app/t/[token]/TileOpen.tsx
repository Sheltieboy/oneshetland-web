"use client";

import { useEffect, useState } from "react";

/**
 * The "open in the app" control for a tapped tile.
 *
 * We try the custom scheme once on mount — if the app is installed it takes
 * over immediately and this page is never really seen. If nothing happens
 * within a moment the app almost certainly isn't there, so we stop pretending
 * and show the button plus a plain explanation.
 *
 * Deliberately no redirect to an app store: an auto-bounce to a store page for
 * someone who just tapped a card in a shop is hostile, and on desktop it's
 * simply wrong.
 */
export function TileOpen({ token }: { token: string }) {
  const [tried, setTried] = useState(false);

  const deepLink = `oneshetland-fetch://nfc/${encodeURIComponent(token)}`;

  useEffect(() => {
    // Only worth attempting on a touch device; desktop has no app to open.
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    if (!isMobile) { setTried(true); return; }
    window.location.href = deepLink;
    const t = setTimeout(() => setTried(true), 1200);
    return () => clearTimeout(t);
  }, [deepLink]);

  return (
    <div className="mt-7 w-full">
      <a
        href={deepLink}
        className="block w-full rounded-pill bg-teal-dark px-6 py-3.5 text-center text-base font-bold text-white"
      >
        Open in the OneShetland app
      </a>
      {tried && (
        <p className="mt-3 text-sm text-ink-muted">
          Nothing happened? The app may not be installed on this device yet.
        </p>
      )}
    </div>
  );
}
