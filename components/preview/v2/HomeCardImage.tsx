"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The picture behind a homepage event card, with a two-step safety net:
 *   1. the event's own cover (or, if it has none, the OneShetland fallback image — decided by the caller);
 *   2. if that fails to load, the OneShetland fallback image;
 *   3. only if the fallback image ALSO fails, the text-only `backdrop` (the coloured card) is shown instead.
 * `overlay` is the dark readability gradient; it is only drawn while a picture is showing.
 */
export function HomeCardImage({ src, fallbackSrc, overlay, backdrop }: { src: string; fallbackSrc: string; overlay: string; backdrop: ReactNode }) {
  const [cur, setCur] = useState(src);
  const [dead, setDead] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The server-rendered <img> can fail before React attaches onError, so also check once it has mounted.
  useEffect(() => {
    const i = ref.current;
    if (i && i.complete && i.naturalWidth === 0) {
      if (i.currentSrc.endsWith(fallbackSrc)) setDead(true);
      else setCur(fallbackSrc);
    }
  }, [fallbackSrc]);

  if (dead) return <>{backdrop}</>;
  return (
    <>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref}
          src={cur}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => (cur === fallbackSrc ? setDead(true) : setCur(fallbackSrc))}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <div className={`absolute inset-0 -z-10 ${overlay}`} />
    </>
  );
}
