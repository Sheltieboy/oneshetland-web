"use client";

/**
 * EventPoster — the event's own picture, complete and uncropped, with a way to see it full size.
 *
 * WHY. The hero at the top of the page is CROPPED (object-cover) so that the title can sit over a
 * band of image. That is right for a photograph and wrong for a POSTER: a portrait flyer loses its
 * top and bottom, and with them the very things somebody came to read — a phone number to ring, a
 * price, the small print at the foot. This shows the whole picture, in its own proportions, and
 * opens it over the page at full size when anyone wants a closer look.
 *
 * It is deliberately not a replacement for the hero: the hero still sets the scene, this is the
 * document. Both come from the same single `cover_url`, so there is nothing extra to upload.
 *
 * No library: a fixed overlay, Escape, a backdrop click and a magnify toggle. The overlay traps
 * nothing it should not — the page behind simply stops scrolling while it is open.
 */
import { useCallback, useEffect, useState } from "react";

export function EventPoster({
  src,
  title,
  /** "poster" gives it its own heading; "bare" is for a picture that already sits in a labelled block. */
  variant = "poster",
}: {
  src: string;
  title: string;
  variant?: "poster" | "bare";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "poster" ? (
        <section className="mt-10" aria-labelledby="poster-h">
          <h2 id="poster-h" className="font-display text-2xl font-bold">
            The full picture
          </h2>
          <p className="mt-2 text-ink-soft">Everything the organiser put on it, nothing cropped away.</p>
          <PosterButton src={src} title={title} onOpen={() => setOpen(true)} />
        </section>
      ) : (
        <PosterButton src={src} title={title} onOpen={() => setOpen(true)} />
      )}
      {open ? <PosterOverlay src={src} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PosterButton({ src, title, onOpen }: { src: string; title: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative mt-5 block w-full overflow-hidden rounded-2xl border border-line bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      aria-label={`See the full picture for ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Poster for ${title}`}
        loading="lazy"
        decoding="async"
        className="mx-auto block max-h-[70vh] w-auto max-w-full object-contain transition duration-300 group-hover:scale-[1.01]"
      />
      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-pill bg-black/60 px-3 py-1.5 text-xs font-bold text-paper backdrop-blur-sm">
        <ExpandIcon /> Tap to enlarge
      </span>
    </button>
  );
}

function PosterOverlay({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  const onKey = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onKey]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Full picture for ${title}`}
      className="fixed inset-0 z-[90] flex flex-col bg-black/95"
      onClick={onClose}
    >
      <div className="flex items-center gap-3 px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-paper/80">{title}</p>
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className="inline-flex h-9 items-center gap-2 rounded-pill bg-white/15 px-3.5 text-xs font-bold text-paper hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {zoomed ? "Fit" : "Magnify"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the picture"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-paper hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <CloseIcon />
        </button>
      </div>

      <div className={`min-h-0 flex-1 ${zoomed ? "overflow-auto" : "grid place-items-center overflow-hidden"} px-4 pb-6`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Poster for ${title}`}
          onClick={(ev) => { ev.stopPropagation(); setZoomed((z) => !z); }}
          className={zoomed ? "mx-auto block w-[250%] max-w-none cursor-zoom-out" : "mx-auto block max-h-full max-w-full cursor-zoom-in object-contain"}
        />
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
