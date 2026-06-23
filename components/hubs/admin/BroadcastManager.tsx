"use client";

import { useState } from "react";
import { broadcastToHub } from "@/lib/hubs-client";

export function BroadcastManager({ hubId, accent }: { hubId: string; accent: string }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"push" | "email" | "both">("both");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return setError("Add a subject and a message.");
    setError(null);
    setBusy(true);
    try {
      const r = await broadcastToHub(hubId, { title: title.trim(), message: message.trim(), channel });
      setResult(`Sent to ${r.members} member${r.members === 1 ? "" : "s"}.`);
      setTitle(""); setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
      <p className="text-sm text-ink-soft">Send a message to all active members of your hub.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject" className="auth-input" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Your message" className="auth-input" />
      <div className="flex flex-wrap gap-2">
        {(["both", "push", "email"] as const).map((c) => (
          <button type="button" key={c} onClick={() => setChannel(c)}
            className={"rounded-pill border px-4 py-1.5 text-sm font-semibold capitalize transition " + (channel === c ? "text-paper" : "border-line bg-paper text-ink")}
            style={channel === c ? { background: accent, borderColor: accent } : undefined}>
            {c === "both" ? "Push + email" : c}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{result}</p>}
      <button type="submit" disabled={busy} className="rounded-pill px-5 py-2.5 font-semibold text-paper disabled:opacity-50" style={{ background: accent }}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
