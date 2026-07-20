"use client";

import { useEffect, useRef, useState } from "react";
import { SPIK_COLOR } from "@/lib/spik-data";

/**
 * AudioInput — capture a short audio clip either by recording in the browser
 * (MediaRecorder + the device mic) or by uploading a file. Fully controlled:
 * the parent owns the resulting Blob (`value`) and gets notified via `onChange`.
 * Degrades to upload-only where getUserMedia / MediaRecorder isn't available.
 */
export function AudioInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: Blob | null;
  onChange: (b: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  // Keep an object URL in sync with the current blob for the <audio> preview.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        onChange(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          // Auto-stop at 30s — these are single words / short sentences.
          if (s >= 29) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Couldn't access the microphone. You can upload a file instead.");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("That file is too big (max 10 MB).");
      return;
    }
    setError(null);
    onChange(f);
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <p className="font-semibold text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canRecord &&
          (recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-sm bg-white" aria-hidden /> Stop · {elapsed}s
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold text-paper"
              style={{ background: SPIK_COLOR }}
            >
              <span aria-hidden>●</span> {value ? "Record again" : "Record"}
            </button>
          ))}

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand">
          <span aria-hidden>↑</span> {canRecord ? "Upload a file" : "Upload audio"}
          <input type="file" accept="audio/*" onChange={onFile} className="hidden" />
        </label>

        {value && !recording && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm font-semibold text-ink-muted underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {previewUrl && !recording && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={previewUrl} className="mt-3 w-full" />
      )}
      {error && <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
