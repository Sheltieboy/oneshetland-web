"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument, deleteDocument } from "@/lib/hubs-client";
import type { HubDocument, NoticeVisibility } from "@/lib/hubs-data";

export function DocumentsManager({ hubId, documents, accent }: { hubId: string; documents: HubDocument[]; accent: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [visibility, setVisibility] = useState<NoticeVisibility>("members");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return setError("Add a title and a link.");
    setError(null);
    setBusy(true);
    try {
      await createDocument(hubId, { title: title.trim(), url: url.trim(), visibility });
      setTitle(""); setUrl("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Add a document</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="auth-input" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (https://…)" className="auth-input" />
        <div className="flex flex-wrap gap-2">
          {(["public", "members", "committee"] as NoticeVisibility[]).map((v) => (
            <button type="button" key={v} onClick={() => setVisibility(v)}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold capitalize transition " + (visibility === v ? "text-paper" : "border-line bg-paper text-ink")}
              style={visibility === v ? { background: accent, borderColor: accent } : undefined}>
              {v}
            </button>
          ))}
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
          {busy ? "Adding…" : "Add document"}
        </button>
      </form>

      <ul className="space-y-2">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
              📄 {d.title} <span className="text-xs font-normal capitalize text-ink-muted">· {d.visibility}</span>
            </a>
            <button onClick={async () => { await deleteDocument(d.id); router.refresh(); }}
              className="rounded-pill border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sand">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
