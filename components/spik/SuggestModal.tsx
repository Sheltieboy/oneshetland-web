"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SuggestForm } from "./SuggestForm";
import { SPIK_COLOR } from "@/lib/spik-data";

export function SuggestModal({
  wordId,
  word,
  pos,
  current,
}: {
  wordId: number;
  word: string;
  pos?: string | null;
  current: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portals need the DOM; only mount on the client.
  useEffect(() => setMounted(true), []);

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Trigger panel */}
      <div className="rounded-xl p-6 text-paper shadow-soft" style={{ background: "#032f4c" }}>
        <h2 className="font-display text-2xl font-bold">Make a suggestion</h2>
        <p className="mt-2 text-paper/85">
          Know a better meaning, pronunciation, example or origin note for{" "}
          <span className="font-bold" style={{ color: SPIK_COLOR }}>{word}</span>?
          Send it in for review and help improve Spik.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-paper/80">
          <li>• Suggest one or more improvements in one go</li>
          <li>• See the current version beside your suggestion</li>
          <li>• Nothing goes live until it has been reviewed</li>
        </ul>
        <button
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-pill px-5 py-3 font-semibold text-paper shadow-soft transition hover:brightness-95"
          style={{ background: SPIK_COLOR }}
        >
          Suggest an improvement <span aria-hidden>→</span>
        </button>
      </div>

      {/* Modal — portalled to <body> so positioning is viewport-relative */}
      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Suggest an improvement for ${word}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-cream shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 text-paper" style={{ background: SPIK_COLOR }}>
              <div>
                <h2 className="font-display text-2xl font-bold leading-tight">Suggest an improvement</h2>
                <p className="text-sm text-paper/90">
                  {word}
                  {pos ? ` · ${pos}` : ""}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper/20 text-lg text-paper transition hover:bg-paper/30"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-5 py-5">
              <p className="mb-5 text-sm text-ink-soft">
                What would you like to improve? Open any field, see the current
                version, and add your suggestion — as many as you like in one go.
              </p>
              <SuggestForm
                wordId={wordId}
                word={word}
                current={current}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
