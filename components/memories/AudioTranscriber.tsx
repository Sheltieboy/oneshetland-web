"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MEMORIES, type TranscriptStatus } from "@/lib/memories-data";

export function AudioTranscriber({ mediaId, url, durationSeconds, initialStatus, initialTranscript }: {
  mediaId: string; url: string; durationSeconds: number | null;
  initialStatus: TranscriptStatus | null; initialTranscript: string | null;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = useState(initialTranscript ?? "");
  const [status, setStatus] = useState<TranscriptStatus>(initialStatus ?? "none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  async function run() {
    if (busy) return;
    setBusy(true); setError(null); setStatus("pending");
    try {
      const sb = createClient();
      const { data, error: fnErr } = await sb.functions.invoke("transcribe-audio", { body: { media_id: mediaId } });
      if (fnErr) {
        let detail = fnErr.message;
        try { const ctx = await (fnErr as { context?: { json?: () => Promise<{ error?: string; detail?: string }> } }).context?.json?.(); if (ctx?.error) detail = ctx.detail ? `${ctx.error}: ${ctx.detail}` : ctx.error; } catch { /* */ }
        throw new Error(detail);
      }
      const text = (data?.transcript ?? "").trim();
      if (text) { setTranscript(text); setStatus("done"); router.refresh(); }
      else if (data?.error) { setError(data.error); setStatus("failed"); }
      else { setStatus("failed"); setError("No speech could be transcribed."); }
    } catch (e) {
      setStatus("failed"); setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally { setBusy(false); }
  }

  // Auto-transcribe once if it hasn't been done yet.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    if (status !== "done" && !transcript) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4">
      <p className="mb-2 text-sm font-semibold text-ink">🎙 Voice note{durationSeconds ? ` · ${durationSeconds}s` : ""}</p>
      <audio src={url} controls className="w-full" />
      {status === "done" && transcript && (
        <p className="mt-3 border-l-4 pl-3 text-sm italic text-ink-soft" style={{ borderColor: MEMORIES }}>“{transcript}”</p>
      )}
      {busy && <p className="mt-2 text-sm text-ink-faint">Transcribing… this takes a few seconds.</p>}
      {!busy && status === "failed" && (
        <div className="mt-2">
          <p className="text-sm text-ink-faint">{error || "Transcription unavailable."}</p>
          <button onClick={run} className="mt-1 rounded-pill border border-line-strong px-3 py-1 text-xs font-semibold text-ink hover:bg-sand">Try transcribing again</button>
        </div>
      )}
    </div>
  );
}
