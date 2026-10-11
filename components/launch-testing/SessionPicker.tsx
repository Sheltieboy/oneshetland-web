"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openSessionAction } from "@/lib/launch-testing/actions";
import type { Platform } from "@/lib/launch-testing/types";

const LABEL: Record<Platform, string> = { ios: "iPhone", android: "Android" };

/** "Which phone are you testing on?" — creates (or updates) the tester's session for that phone type, then reloads the page on it. */
export function SessionPicker({ programmeId, allowed, expectedIos, expectedAndroid, sessions, current }: {
  programmeId: string; allowed: Platform[]; expectedIos: string | null; expectedAndroid: string | null;
  sessions: Array<{ platform: Platform; build: string | null; device: string | null }>; current: Platform | null;
}) {
  const router = useRouter();
  const choices = (allowed.length ? allowed : (["ios", "android"] as Platform[]));
  const [platform, setPlatform] = useState<Platform>(current && choices.includes(current) ? current : choices[0]);
  const existing = sessions.find((s) => s.platform === platform);
  const expected = platform === "ios" ? expectedIos : expectedAndroid;
  const [build, setBuild] = useState(existing?.build ?? expected ?? "");
  const [device, setDevice] = useState(existing?.device ?? "");
  const [open, setOpen] = useState(!current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(p: Platform) {
    setPlatform(p);
    const s = sessions.find((x) => x.platform === p);
    setBuild(s?.build ?? (p === "ios" ? expectedIos : expectedAndroid) ?? "");
    setDevice(s?.device ?? "");
  }

  function go() {
    setError(null);
    start(async () => {
      const r = await openSessionAction({ programmeId, platform, build, device });
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      router.replace(`/launch-testing?p=${platform}`);
      router.refresh();
    });
  }

  if (!open && current) {
    return (
      <div className="flex items-center justify-between rounded-card border border-line bg-paper px-4 py-3 text-sm">
        <span className="text-ink-soft">Testing on <strong className="text-ink">{LABEL[current]}</strong></span>
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-teal-dark underline">Change</button>
      </div>
    );
  }

  return (
    <section className="rounded-card border border-line bg-paper p-4 shadow-soft" aria-label="Which phone are you testing on?">
      <h2 className="font-display text-lg font-bold text-ink">Which phone are you testing on?</h2>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Phone type">
        {choices.map((p) => (
          <button key={p} type="button" onClick={() => pick(p)} aria-pressed={platform === p}
            className={"min-h-[52px] rounded-card border-2 px-3 text-base font-bold " + (platform === p ? "border-navy bg-navy text-white" : "border-line bg-paper text-ink")}>
            {LABEL[p]}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink">
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
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={go} disabled={pending}
        className="mt-4 min-h-[52px] w-full rounded-pill bg-navy px-6 text-base font-bold text-white disabled:opacity-60">
        {pending ? "One moment…" : current ? "Save" : "Start testing"}
      </button>
    </section>
  );
}
