"use client";

import { useState } from "react";

/** An <img> that swaps to a fallback if the source fails to load (broken link,
 *  unreachable host, or an unrenderable format like .heic). */
export function SafeImage({
  src,
  alt = "",
  className,
  fallback = null,
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setErrored(true)} />
  );
}
