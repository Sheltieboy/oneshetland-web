"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNotice, deleteNotice } from "@/lib/hubs-client";
import type { HubNotice, NoticeVisibility } from "@/lib/hubs-data";

const EXPIRY = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "No expiry", days: 0 },
];

export function NoticesManager({ hubId, notices, accent }: { hubId: string; notices: HubNotice[]; accent: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<NoticeVisibility>("public");
  const [expiryDays, setExpiryDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Add a title.");
    setError(null);
    setBusy(true);
    try {
      const expires_at = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000).toISOString() : null;
      await createNotice(hubId, { title: title.trim(), body: body.trim() || undefined, visibility, expires_at });
      setTitle(""); setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post notice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={post} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Post a notice</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="auth-input" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Details" className="auth-input" />
        <div className="flex flex-wrap gap-2">
          {(["public", "members"] as NoticeVisibility[]).map((v) => (
            <button type="button" key={v} onClick={() => setVisibility(v)}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold capitalize transition " + (visibility === v ? "text-paper" : "border-line bg-paper text-ink")}
              style={visibility === v ? { background: accent, borderColor: accent } : undefined}>
              {v === "public" ? "Everyone" : "Members only"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPIRY.map((e) => (
            <button type="button" key={e.label} onClick={() => setExpiryDays(e.days)}
              className={"rounded-pill border px-3 py-1.5 text-xs font-semibold transition " + (expiryDays === e.days ? "text-paper" : "border-line bg-paper text-ink-soft")}
              style={expiryDays === e.days ? { background: accent, borderColor: accent } : undefined}>
              {e.label}
            </button>
          ))}
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Posting…" : "Post notice"}
        </button>
      </form>

      <ul className="space-y-2">
        {notices.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div>
              <span className="font-semibold text-ink">{n.title}</span>
              {n.visibility === "members" && <span className="ml-2 rounded-pill bg-sand px-2 py-0.5 text-xs font-semibold text-ink-muted">Members</span>}
              {n.body && <p className="mt-1 text-sm text-ink-soft">{n.body}</p>}
            </div>
            <button onClick={async () => { await deleteNotice(n.id); router.refresh(); }}
              className="shrink-0 rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
