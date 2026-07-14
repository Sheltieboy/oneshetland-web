"use client";

import { useRef, useState } from "react";
import { MEMORIES } from "@/lib/memories-data";

export function VoiceRecorder({ onRecorded }: { onRecorded: (blob: Blob, durationSec: number, mimeType: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [secs, setSecs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMs = useRef(0);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const mimeType = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type: mimeType });
        const dur = Math.round((Date.now() - startMs.current) / 1000);
        setPreviewUrl(URL.createObjectURL(blob));
        onRecorded(blob, dur, mimeType);
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec;
      rec.start();
      startMs.current = Date.now();
      setState("recording"); setSecs(0);
      timer.current = setInterval(() => setSecs((s) => { if (s >= 599) stop(); return s + 1; }), 1000);
    } catch { setError("Microphone access was blocked."); }
  }
  function stop() {
    if (timer.current) clearInterval(timer.current);
    recRef.current?.stop();
    setState("done");
  }

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-card border border-line bg-paper p-4">
      {state === "idle" && (
        <button type="button" onClick={start} className="flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold text-white" style={{ background: MEMORIES }}>🎙 Record a voice note</button>
      )}
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-rose-600" />
          <span className="font-display text-lg font-bold text-ink">{mmss}</span>
          <button type="button" onClick={stop} className="ml-auto rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">Stop</button>
        </div>
      )}
      {state === "done" && previewUrl && (
        <div className="flex items-center gap-3">
          <audio controls src={previewUrl} className="h-9 flex-1" />
          <button type="button" onClick={() => { setState("idle"); setPreviewUrl(null); setSecs(0); }} className="text-sm font-semibold text-ink-muted hover:text-ink">Re-record</button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {state === "done" && <p className="mt-1 text-xs text-ink-faint">We'll transcribe this automatically once the story is saved.</p>}
    </div>
  );
}
