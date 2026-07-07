/**
 * DeviceFrame — tasteful phone / laptop mockup frames built from CSS + SVG only
 * (no images required to render). Each frame points at an image under
 * /public/business/… and falls back to a soft section-colour placeholder panel
 * with a small "preview" label when the screenshot isn't in place yet.
 *
 * Server component (no interactivity) — the fallback is CSS-only so it never
 * needs JS to look right.
 */

import fs from "node:fs";
import path from "node:path";

/** True if a file exists under /public for the given src ("/business/x.png"). */
function assetExists(src: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
  } catch {
    return false;
  }
}

type Props = {
  /** Path under /public, e.g. "/business/listing-phone.png". */
  src: string;
  alt: string;
  /** Section accent used for the placeholder tint + label. Defaults to Local violet. */
  accent?: string;
  /** Optional label shown on the fallback placeholder. */
  label?: string;
  className?: string;
};

/**
 * We can't feature-detect a missing image on the server, so we always render the
 * placeholder panel behind the image. If the image exists it covers the panel;
 * if it 404s, the img is transparent and the tinted placeholder shows through.
 */
function Placeholder({ accent, label }: { accent: string; label: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
      style={{
        background: `linear-gradient(160deg, ${accent}1f, ${accent}0a 60%, ${accent}14)`,
      }}
      aria-hidden
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m21 15-4.5-4.5L7 20" />
      </svg>
      <span className="rounded-pill px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: accent, background: `${accent}1a` }}>
        {label}
      </span>
    </div>
  );
}

export function PhoneFrame({ src, alt, accent = "#7c3aed", label = "preview", className = "" }: Props) {
  return (
    <div className={`relative mx-auto aspect-[9/19] w-full max-w-[220px] ${className}`}>
      <div className="absolute inset-0 rounded-[2.2rem] bg-navy p-[6px] shadow-lift">
        <div className="relative h-full w-full overflow-hidden rounded-[1.8rem] bg-cream">
          {/* notch */}
          <div className="absolute left-1/2 top-1.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-navy" />
          <Placeholder accent={accent} label={label} />
          {assetExists(src) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover object-top" />
          )}
        </div>
      </div>
    </div>
  );
}

export function LaptopFrame({ src, alt, accent = "#4f46e5", label = "preview", className = "" }: Props) {
  return (
    <div className={`relative mx-auto w-full max-w-[520px] ${className}`}>
      {/* screen — the screenshot fills the whole panel (its own top nav reads as
          the browser window), so there's no fake chrome bar to collide with it */}
      <div className="rounded-t-xl border-[6px] border-navy bg-navy shadow-lift">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-md bg-cream">
          <Placeholder accent={accent} label={label} />
          {assetExists(src) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover object-top" />
          )}
        </div>
      </div>
      {/* base / hinge */}
      <div className="mx-auto h-2.5 w-[112%] max-w-none -translate-x-[5%] rounded-b-xl bg-navy-dark shadow-soft" />
      <div className="mx-auto h-1.5 w-1/4 rounded-b-lg bg-navy/70" />
    </div>
  );
}
