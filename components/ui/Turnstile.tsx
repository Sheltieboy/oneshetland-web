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
 *
 * HOW IT PRESENTS, AND WHY
 *
 * All three presentation options are Cloudflare's own render parameters, set
 * here rather than fought with CSS — the widget is a cross-origin iframe and
 * nothing outside it can style its contents.
 *
 *   appearance: "interaction-only"
 *     The widget stays invisible unless Cloudflare actually needs the visitor
 *     to do something. It previously defaulted to "always", so every visitor
 *     got a permanent 300x65 Cloudflare panel sitting in the middle of a form
 *     that is otherwise ours. The security is unchanged: the check still runs
 *     for everyone, the token still arrives through `callback`, and the submit
 *     button is still gated on holding one. What changes is that people who
 *     are never challenged never see a box.
 *
 *   theme: "light"
 *     Was defaulting to "auto", which follows the VISITOR'S dark-mode setting,
 *     not the page's. A visitor on a dark-mode phone got a black Cloudflare
 *     panel on our light sign-in page. These auth pages are light in both
 *     schemes, so the widget is pinned to match them rather than the device.
 *
 *   size: "flexible"
 *     Fills the form width (min 300px) instead of a fixed 300px box, so when a
 *     challenge does appear it lines up with the inputs above and below it
 *     rather than sitting narrow and off-centre.
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
          appearance: "interaction-only",
          theme: "light",
          size: "flexible",
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
