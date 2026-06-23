"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Right-side slide-over panel, portalled to <body>.
 * Closes on backdrop click + Escape.
 * Use for supplementary content that layers over the current page
 * (member directory, search results, etc.) per the OneShetland web UX rule.
 */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  accent = "#6b47bf",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-cream shadow-xl transition-transform duration-300 sm:max-w-md ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 text-paper" style={{ background: accent }}>
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-paper/90">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper/20 text-lg text-paper transition hover:bg-paper/30"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
