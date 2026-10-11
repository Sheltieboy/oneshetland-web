"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openSessionAction } from "@/lib/launch-testing/actions";
import { LIVE_WEBSITE_LABEL, PLATFORM_LABEL, describeWebContext, detectWebContext, type WebContext } from "@/lib/launch-testing/platform";
import type { Platform } from "@/lib/launch-testing/types";

const subscribeNever = () => () => {};
const readWebContext = () => JSON.stringify(detectWebContext(navigator.userAgent, window.innerWidth, window.innerHeight, navigator.maxTouchPoints > 1));

/**
 * Sets up (or refreshes) the tester's session for the platform they chose. One session per platform, so results can never mix.
 *   · Website: nothing to type. We note the browser, whether it's a computer, phone or tablet, and the window size — no more than that.
 *   · iPhone / Android: the app version and phone model.
 */
export function SessionPicker({ programmeId, platform, expected, session }: {
  programmeId: string; platform: Platform; expected: string | null;
  session: { build: string | null; device: string | null; browser: string | null; deviceClass: string | null; viewport: string | null } | null;
}) {
  const router = useRouter();
  const [build, setBuild] = useState(session?.build ?? expected ?? "");
  const [device, setDevice] = useState(session?.device ?? "");
  // Read from the browser itself (nothing on the server knows the window size). The snapshot is a string so it is stable between renders.
  const snapshot = useSyncExternalStore(subscribeNever, readWebContext, () => null);
  const ctx: WebContext | null = snapshot ? (JSON.parse(snapshot) as WebContext) : null;
  const [open, setOpen] = useState(!session);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isWeb = platform === "web";

  function go() {
    setError(null);
    start(async () => {
      const c = isWeb ? ctx ?? detectWebContext(navigator.userAgent, window.innerWidth, window.innerHeight, navigator.maxTouchPoints > 1) : null;
      const r = await openSessionAction({
        programmeId, platform, build: isWeb ? undefined : build, device: isWeb ? undefined : device,
        browser: c?.browser ?? undefined, deviceClass: c?.deviceClass ?? null, viewport: c?.viewport ?? undefined,
      });
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      router.replace(`/launch-testing?p=${platform}`);
      router.refresh();
    });
  }

  if (!open && session) {
    const summary = isWeb ? [LIVE_WEBSITE_LABEL, describeWebContext({ browser: session.browser, deviceClass: session.deviceClass as never, viewport: session.viewport })].filter(Boolean).join(" · ")
      : [session.build, session.device].filter(Boolean).join(" · ");
    return (
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 text-sm">
        <span className="min-w-0 text-ink-soft">Testing: <strong className="text-ink">{PLATFORM_LABEL[platform]}</strong>{summary ? <span className="block truncate text-xs text-ink-muted">{summary}</span> : null}</span>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 font-semibold text-teal-dark underline">Update</button>
      </div>
    );
  }

  return (
    <section className="rounded-card border border-line bg-paper p-4 shadow-soft" aria-label={`Set up ${PLATFORM_LABEL[platform]} testing`}>
      {isWeb ? (
        <>
          <h2 className="font-display text-lg font-bold text-ink">Testing the website</h2>
          <p className="mt-1 text-sm text-ink-soft">You&apos;ll be testing the <strong>{LIVE_WEBSITE_LABEL}</strong>. We note your browser and window size so we can reproduce anything you find. Nothing else about your device.</p>
          <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm text-ink" aria-live="polite">
            {ctx ? (describeWebContext(ctx) || "Browser details unavailable — that's fine.") : "Checking your browser…"}
          </p>
        </>
      ) : (
        <>
          <h2 className="font-display text-lg font-bold text-ink">Testing the {PLATFORM_LABEL[platform]} app</h2>
          <label className="mt-3 block text-sm font-semibold text-ink">
            App version you&apos;re testing
            <input value={build} onChange={(e) => setBuild(e.target.value)} maxLength={60} placeholder={expected ?? ""}
              className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" />
            {expected && <span className="mt-1 block text-xs font-normal text-ink-muted">We expect: {expected}</span>}
          </label>
          <label className="mt-3 block text-sm font-semibold text-ink">
            Phone model <span className="font-normal text-ink-muted">(optional)</span>
            <input value={device} onChange={(e) => setDevice(e.target.value)} maxLength={80} placeholder="e.g. Moto G, iPhone 15"
              className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" />
          </label>
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={go} disabled={pending}
        className="mt-4 min-h-[52px] w-full rounded-pill bg-navy px-6 text-base font-bold text-white disabled:opacity-60">
        {pending ? "One moment…" : session ? "Save" : "Start testing"}
      </button>
    </section>
  );
}
