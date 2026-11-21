"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { durationLabel, type GalleryItem } from "@/lib/product-media";

/**
 * ProductGallery — photographs and videos in ONE gallery, on the product page.
 *
 * Decisions worth knowing about:
 *
 * · NO AUTOPLAY WITH SOUND, ever. A video only plays when somebody asks it to, and it carries the
 *   browser's own controls so the volume, the scrubber and fullscreen are the ones they already know.
 *   Moving to another item pauses whatever was playing, so two things can never play at once and
 *   sound never follows you around the gallery.
 * · `preload="none"` until the viewer picks that item, so landing on a product page downloads a
 *   poster image and not a 50 MB file. That is the whole efficiency story on mobile data.
 * · A video is OBVIOUS before you touch it: a play button over the poster, a VIDEO label, and the
 *   length when we know it. The thumbnail strip marks them too.
 * · Swipe on touch, arrow keys on a keyboard, and the thumbnails work as a proper tab list — the old
 *   gallery's thumbnails did nothing at all when you clicked them.
 */
export function ProductGallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [active, setActive] = useState(0);
  // ONE ref, because only one item is on the stage at a time. An earlier version kept a map keyed by
  // index and it did not work: React calls the ref callback with null on unmount, under the NEW
  // index, so the map kept a stale entry and the element that was actually playing was never
  // paused. A detached <video> carries on playing, so the sound followed you through the gallery.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const count = items.length;

  // Leaving an item stops it. Done here, before the state change, so the element is still the one
  // on screen — and again in the effect cleanup, which covers unmounting the gallery altogether.
  const go = useCallback((next: number) => {
    if (count === 0) return;
    const el = videoRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setActive(((next % count) + count) % count);
  }, [count]);

  useEffect(() => {
    const el = videoRef.current;
    return () => { if (el) { el.pause(); el.currentTime = 0; } };
  }, [active]);

  if (count === 0) {
    return <div className="grid aspect-square w-full place-items-center rounded-card border border-line bg-cream text-5xl">🛍️</div>;
  }

  const current = items[active];

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-card border border-line bg-cream"
        onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null;
          if (!s || count < 2) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - s.x, dy = t.clientY - s.y;
          // Only a deliberate sideways swipe, so scrolling the page never changes the picture.
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(active + (dx < 0 ? 1 : -1));
        }}
      >
        <div
          role="group"
          aria-label={`${title} — item ${active + 1} of ${count}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
          }}
          className="outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {current.kind === "video" ? (
            <video
              ref={(el) => { videoRef.current = el; }}
              key={current.url}
              src={current.url}
              poster={current.still || undefined}
              controls
              playsInline
              preload="none"
              className="aspect-square w-full bg-black object-contain"
            />
          ) : (
            <SafeImage
              src={current.url}
              className="aspect-square w-full object-cover"
              fallback={<div className="grid aspect-square w-full place-items-center text-5xl">🛍️</div>}
            />
          )}
        </div>

        {count > 1 && (
          <>
            <button type="button" aria-label="Previous item" onClick={() => go(active - 1)}
              className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg font-bold text-ink shadow-soft backdrop-blur hover:bg-white">‹</button>
            <button type="button" aria-label="Next item" onClick={() => go(active + 1)}
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg font-bold text-ink shadow-soft backdrop-blur hover:bg-white">›</button>
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-pill bg-ink/70 px-2.5 py-0.5 text-xs font-semibold text-white">
              {active + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <div role="tablist" aria-label={`${title} gallery`} className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <button
              key={`${item.kind}:${item.url}`}
              role="tab"
              type="button"
              aria-selected={i === active}
              aria-label={item.kind === "video" ? `Video ${i + 1}` : `Photograph ${i + 1}`}
              onClick={() => go(i)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? "border-teal" : "border-line"}`}
            >
              <SafeImage src={item.still} className="h-full w-full object-cover" fallback={<span className="grid h-full w-full place-items-center bg-cream text-xl">🛍️</span>} />
              {item.kind === "video" && (
                <>
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-ink/35">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 pl-0.5 text-[11px] text-ink">▶</span>
                  </span>
                  {durationLabel(item.duration) && (
                    <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 rounded bg-ink/80 px-1 text-[10px] font-semibold text-white">
                      {durationLabel(item.duration)}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {current.kind === "video" && (
        <p className="mt-2 text-xs text-ink-muted">Video — press play to watch, with sound.</p>
      )}
    </div>
  );
}
