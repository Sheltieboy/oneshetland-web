/**
 * Responsive renditions for organiser photographs. The uploader stores four JPEGs side by side, `<uuid>-w640.jpg`, `-w960.jpg`, `-w1280.jpg` and `-w1920.jpg`, and saves the
 * 1920 address as the image URL. A page that finds that naming offers all four to the browser (`srcset` with `sizes`), so a phone downloads a few dozen kilobytes instead of
 * the full 1920 pixel file. Any other address (older uploads, other hosts, logos) is returned unchanged with no srcset, so nothing can point at a rendition that does not exist.
 */
export const IMAGE_WIDTHS = [640, 960, 1280, 1920] as const;
const FULL = /^(https?:\/\/[^\s<>"']+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-w1920\.jpg$/i;

export type ResponsiveImage = { src: string; srcSet?: string; sizes?: string };

export function responsiveImage(url: string, sizes = "100vw"): ResponsiveImage {
  const m = FULL.exec(url);
  if (!m) return { src: url };
  const base = m[1];
  return { src: url, srcSet: IMAGE_WIDTHS.map((w) => `${base}-w${w}.jpg ${w}w`).join(", "), sizes };
}

/** The object-name suffix for a rendition of a given width. */
export const renditionName = (uuid: string, width: number) => `${uuid}-w${width}`;
