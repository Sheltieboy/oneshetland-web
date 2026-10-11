"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProgrammeAction } from "@/lib/launch-testing/actions";
import type { Programme } from "@/lib/launch-testing/types";

export function ProgrammeForm({ programme }: { programme: Programme }) {
  const router = useRouter();
  const [status, setStatus] = useState(programme.status);
  const [ios, setIos] = useState(programme.expected_ios_build ?? "");
  const [android, setAndroid] = useState(programme.expected_android_version ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, run] = useTransition();
  function save() {
    setMsg(null);
    run(async () => {
      const r = await updateProgrammeAction(programme.id, { status, expected_ios_build: ios, expected_android_version: android });
      setMsg(r.ok ? "Saved." : r.error);
      if (r.ok) router.refresh();
    });
  }
  return (
    <details className="rounded-card border border-line bg-paper p-4">
      <summary className="cursor-pointer text-sm font-bold text-ink">Programme settings</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-ink">Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Programme["status"])} className="mt-1 w-full rounded-lg border border-line px-3 py-2">
            <option value="draft">Draft (testers cannot see it)</option><option value="active">Active</option><option value="completed">Completed</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">Expected iOS build
          <input value={ios} onChange={(e) => setIos(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
        <label className="text-sm font-semibold text-ink">Expected Android version
          <input value={android} onChange={(e) => setAndroid(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        {msg && <span className="text-sm text-ink-soft" role="status">{msg}</span>}
      </div>
    </details>
  );
}
