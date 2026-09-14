"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadTurnstile, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

/**
 * Turnstile — Cloudflare Turnstile (Managed mode) widget.
 *
 * Renders the challenge, calls `onToken(token)` when it passes, and
 * `onToken(null)` whenever the token stops being valid (expiry, error) so the
 * caller can disable its submit button again. A token is single-use — the
 * caller must call `reset()` (via the ref) after ANY submit attempt, success
 * or failure, before the widget can be used again.
 *
 * No secret key anywhere here or in any file this imports — only the public
 * site key, read from NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */

export interface TurnstileHandle {
  reset: () => void;
}

export const Turnstile = forwardRef<TurnstileHandle, {
  onToken: (token: string | null) => void;
  onError?: () => void;
}>(function Turnstile({ onToken, onError }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    TURNSTILE_SITE_KEY ? "loading" : "failed",
  );

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      onToken(null);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setStatus("failed");
      onError?.();
      return;
    }
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onToken(token),
          "error-callback": () => {
            onToken(null);
            setStatus("failed");
            onError?.();
          },
          "expired-callback": () => onToken(null),
          "timeout-callback": () => onToken(null),
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("failed");
          onError?.();
        }
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      {status === "failed" && (
        <p className="mt-2 text-sm text-rose-600">
          Couldn&apos;t load the verification check. Please refresh the page and try again.
        </p>
      )}
    </div>
  );
});
