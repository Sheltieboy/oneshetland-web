/**
 * Is this picture a LOGO / brand mark, or a photograph? Decided deterministically, from evidence — never guessed by AI.
 *
 * A logo must be shown WHOLE (object-contain, with a little padding on a plain background): cropping it to fill a photo frame
 * cuts the mark in half. A photograph (shopfront, product, landscape, painting) keeps the normal cover crop.
 *
 * Evidence, in order:
 *   1. an explicit role on the picture itself ("logo" | "photo") — wins outright (room for an editor, or a future importer,
 *      to say so; nothing sets it today and no stored content changes);
 *   2. the address is the business's own logo field (same file, ignoring any ?query);
 *   3. the FILE NAME says so — logo, wordmark, lockup, monogram, brandmark, favicon, emblem, crest — as a whole word
 *      (camelCase is split: "AvrilLogo.png" counts, "catalogue.jpg" and "technology.jpg" do not);
 *   4. the picture's alt text says "logo".
 * Directory names are deliberately NOT evidence: our own "/business-logos/…" folder also holds shopfront photographs.
 * Anything else is a photograph.
 *
 * Pure: no framework, no network (it cannot know a picture's pixel size, so a logo with a neutral file name and no alt
 * text is treated as a photograph until something marks it).
 */
export type ImageRole = "logo" | "photo";

const WORD = /(^|[^a-z0-9])(logo|logos|logotype|wordmark|lockup|monogram|brandmark|brand[- _]mark|favicon|emblem|crest)([^a-z0-9]|$)/i;
const ALT = /(^|[^a-z0-9])(logo|logotype|wordmark|brandmark|brand mark)([^a-z0-9]|$)/i;

const fileOf = (src: string): string => {
  let p = src;
  try { p = new URL(src, "https://x.invalid").pathname; } catch { p = src.split(/[?#]/)[0]; }
  let name = p.split("/").filter(Boolean).pop() ?? "";
  try { name = decodeURIComponent(name); } catch { /* keep as is */ }
  return name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
};
const sameFile = (a: string, b: string): boolean => {
  const strip = (u: string) => u.split(/[?#]/)[0];
  return strip(a) === strip(b);
};

export function imageRole(src: string, alt?: string | null, opts: { role?: ImageRole | null; knownLogos?: (string | null | undefined)[] } = {}): ImageRole {
  if (opts.role === "logo" || opts.role === "photo") return opts.role;
  if (!src) return "photo";
  if ((opts.knownLogos ?? []).some((l) => !!l && sameFile(l, src))) return "logo";
  if (WORD.test(fileOf(src))) return "logo";
  if (alt && ALT.test(alt)) return "logo";
  return "photo";
}

/** What replaces `object-cover` for a logo: the whole mark, centred, with breathing room, on a plain white ground. */
export const LOGO_FIT = "object-contain bg-white p-[9%]";

/** The classes for an image, given its role: a logo swaps the cover crop for LOGO_FIT; anything else is untouched. */
export function fitClasses(className: string, role: ImageRole): string {
  return role === "logo" && /\bobject-cover\b/.test(className) ? className.replace(/\bobject-cover\b/, LOGO_FIT) : className;
}
