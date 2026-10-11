"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTesterAction, updateTesterAction } from "@/lib/launch-testing/actions";
import type { AdminTester, Platform } from "@/lib/launch-testing/types";

const PLATFORMS: Array<{ id: Platform; label: string }> = [{ id: "ios", label: "iPhone" }, { id: "android", label: "Android" }];

function PlatformBoxes({ value, onChange }: { value: Platform[]; onChange: (v: Platform[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {PLATFORMS.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={value.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} /> {p.label}
        </label>
      ))}
      <span className="text-xs text-ink-muted">(none ticked = either)</span>
    </div>
  );
}

export function AddTester({ programmeId }: { programmeId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [platforms, setPlatforms] = useState<Platform[]>([]); const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, run] = useTransition();
  function add() {
    setMsg(null);
    run(async () => {
      const r = await addTesterAction({ programmeId, email, platforms, notes });
      if (r.ok) { setMsg({ ok: true, text: "Added. They can now open /launch-testing." }); setEmail(""); setNotes(""); setPlatforms([]); router.refresh(); }
      else setMsg({ ok: false, text: r.error });
    });
  }
  return (
    <section className="rounded-card border border-line bg-paper p-4">
      <h2 className="font-display text-lg font-bold text-ink">Add a tester</h2>
      <p className="mt-1 text-sm text-ink-soft">They must already have a OneShetland account (ask them to sign up or sign in normally first). Use the email on that account.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">Their account email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
        <label className="text-sm font-semibold text-ink">Private note <span className="font-normal text-ink-muted">(only you see it)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
      </div>
      <div className="mt-3"><p className="mb-1 text-sm font-semibold text-ink">Phone type(s) to cover</p><PlatformBoxes value={platforms} onChange={setPlatforms} /></div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={add} disabled={pending || !email.trim()} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "Adding…" : "Add tester"}</button>
        {msg && <span role="status" className={"text-sm " + (msg.ok ? "text-emerald-700" : "text-rose-700")}>{msg.text}</span>}
      </div>
    </section>
  );
}

export function TesterRow({ tester }: { tester: AdminTester }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(tester.enabled); const [platforms, setPlatforms] = useState<Platform[]>(tester.platforms); const [notes, setNotes] = useState(tester.admin_notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const name = tester.display_name || tester.full_name || "(no name)";
  function save() {
    setMsg(null);
    run(async () => { const r = await updateTesterAction({ testerId: tester.tester_id, enabled, platforms, notes }); setMsg(r.ok ? "Saved." : r.error); if (r.ok) router.refresh(); });
  }
  return (
    <li className="rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-bold text-ink">{name}</p><p className="text-sm text-ink-muted">{tester.email}</p></div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Access enabled</label>
      </div>
      <div className="mt-3"><PlatformBoxes value={platforms} onChange={setPlatforms} /></div>
      <label className="mt-3 block text-sm font-semibold text-ink">Private note
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        {msg && <span role="status" className="text-sm text-ink-soft">{msg}</span>}
      </div>
    </li>
  );
}
