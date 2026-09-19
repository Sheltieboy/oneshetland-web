/**
 * mobile-turnstile-challenge.ts — the state machine behind
 * /mobile-turnstile-challenge, the page the OneShetland app opens in an
 * ASWebAuthenticationSession to obtain a Turnstile token.
 *
 * The app is waiting on ONE thing: a redirect to
 * `oneshetland-fetch://turnstile-callback`. Everything this module does is in
 * service of making sure that redirect always happens — with a token only when
 * Cloudflare genuinely issued one, and with `?error=<reason>` otherwise. There
 * is no second protocol: the app's existing parser already treats any `error`
 * as "no valid token" (and lib/turnstile.ts in the app maps the two *_timeout
 * reasons to its timeout message).
 *
 * TERMINAL PATHS — exactly one fires, exactly once:
 *
 *   token issued                  → ?token=…
 *   widget error-callback         → ?error=challenge_failed
 *   widget timeout-callback       → ?error=challenge_timeout
 *   widget expired-callback       → ?error=challenge_expired
 *   widget unsupported-callback   → ?error=init_failed
 *   script fails to load          → ?error=script_load_failed
 *   script never finishes loading → ?error=script_load_timeout
 *   no site key / no API / no container / render() throws or returns no id
 *                                 → ?error=init_failed
 *   nothing at all within the overall deadline
 *                                 → ?error=challenge_timeout
 *
 * A failure path can never produce a token: `returnUrlFor` only writes `token`
 * for a `{ token }` outcome, and the only place that builds one is the
 * widget's success callback with a non-empty string. Timeout, expiry and
 * script failure are failures — never a pass.
 *
 * No React, no window: every dependency is injected so the whole thing runs
 * under plain node in oneshetland-delivers' test suite (same arrangement as
 * lib/subscription-confirm.ts). No secret key exists here — only the public
 * site key, handed in by the page.
 */

import type { TurnstileRenderOptions } from "./turnstile.ts";

export const RETURN_SCHEME = "oneshetland-fetch://turnstile-callback";

/** How long the Cloudflare script gets to load before we give up on it. */
export const SCRIPT_LOAD_TIMEOUT_MS = 10_000;

/**
 * Overall ceiling for the whole page. Deliberately below the app's own 30s
 * auth-session deadline, so the app is told *why* rather than just timing out
 * on its own — the app's deadline stays the backstop if this page never even
 * gets to run (blank page, no JS).
 */
export const CHALLENGE_DEADLINE_MS = 25_000;

export type ChallengeFailure =
  | "challenge_failed"
  | "challenge_timeout"
  | "challenge_expired"
  | "script_load_failed"
  | "script_load_timeout"
  | "init_failed";

export type ChallengeOutcome = { token: string } | { error: ChallengeFailure };

export function returnUrlFor(outcome: ChallengeOutcome): string {
  return "token" in outcome
    ? `${RETURN_SCHEME}?token=${encodeURIComponent(outcome.token)}`
    : `${RETURN_SCHEME}?error=${outcome.error}`;
}

/** The slice of Cloudflare's `window.turnstile` this page uses. */
export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  remove: (widgetId?: string) => void;
}

export interface ChallengeDeps {
  /** Public site key. Empty means the build is misconfigured → init_failed. */
  siteKey: string;
  loadScript: () => Promise<void>;
  getApi: () => TurnstileApi | undefined;
  getContainer: () => HTMLElement | null;
  /** Hands control back to the app (window.location.href = url). */
  redirect: (url: string) => void;
  /** Lets the page swap its UI; called once, just before the redirect. */
  onSettled?: (outcome: ChallengeOutcome) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ChallengeRun {
  /** Unmount cleanup: stops timers and removes the widget. Never redirects. */
  stop: () => void;
}

export function startMobileChallenge(deps: ChallengeDeps): ChallengeRun {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let settled = false;
  let widgetId: string | undefined;
  const timers: { script?: unknown; deadline?: unknown } = {};

  const teardown = () => {
    clearTimer(timers.script);
    clearTimer(timers.deadline);
    if (widgetId) {
      try {
        deps.getApi()?.remove(widgetId);
      } catch {
        /* the page is about to leave anyway */
      }
      widgetId = undefined;
    }
  };

  const settle = (outcome: ChallengeOutcome) => {
    if (settled) return;
    settled = true;
    teardown();
    deps.onSettled?.(outcome);
    deps.redirect(returnUrlFor(outcome));
  };
  const fail = (error: ChallengeFailure) => settle({ error });

  if (!deps.siteKey) {
    fail("init_failed");
    return { stop: () => {} };
  }

  timers.deadline = setTimer(() => fail("challenge_timeout"), CHALLENGE_DEADLINE_MS);
  timers.script = setTimer(() => fail("script_load_timeout"), SCRIPT_LOAD_TIMEOUT_MS);

  deps.loadScript().then(
    () => {
      if (settled) return;
      clearTimer(timers.script);

      const api = deps.getApi();
      const container = deps.getContainer();
      if (!api || !container) return fail("init_failed");

      let id: string | null | undefined;
      try {
        id = api.render(container, {
          sitekey: deps.siteKey,
          appearance: "interaction-only",
          theme: "light",
          size: "flexible",
          // A token is the ONLY success. An empty/absent one is a failure.
          callback: (token) => {
            if (typeof token === "string" && token.length > 0) settle({ token });
            else fail("challenge_failed");
          },
          "error-callback": () => fail("challenge_failed"),
          "expired-callback": () => fail("challenge_expired"),
          "timeout-callback": () => fail("challenge_timeout"),
          "unsupported-callback": () => fail("init_failed"),
        });
      } catch {
        return fail("init_failed");
      }
      if (!id) return fail("init_failed");

      // A callback that fired synchronously inside render() has already
      // settled; remove the widget it left behind.
      if (settled) {
        try {
          api.remove(id);
        } catch {
          /* ignore */
        }
        return;
      }
      widgetId = id;
    },
    () => fail("script_load_failed"),
  );

  return {
    stop: () => {
      settled = true;
      teardown();
    },
  };
}
