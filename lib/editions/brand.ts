/**
 * The Editions brand engine. An organiser supplies ONE colour (plus a logo, a cover photograph, a name and a tagline); everything else is derived here:
 * a tinted ground and ink, hairlines, a text-safe accent, a deep tone for photographs and footers, a lighter "glow" for use on the deep tone, a tint for
 * chips, an analogous second tone, and nothing else: the typeface, corners and layout are the same for every Edition. Pure functions (no DOM, no server code) so the organiser dashboard can
 * preview exactly what visitors will see.
 *
 * Accessibility is a property of the derivation, not of the organiser's choices: every text pair the design system uses is checked here and nudged until it
 * passes WCAG AA (4.5:1 for text). A pale brand colour is never "darkened until white text works" (the old behaviour); the fill keeps the organiser's colour
 * and the text on it flips to dark ink instead.
 */
import { contrast, isHex } from "./rules";

export const DEFAULT_BRAND = "#0b5a73";

/** One typeface for every Edition (see lib/editions/fonts.ts). Shown in the studio so organisers know it is not a choice they need to make. */
export const TYPEFACE = { name: "Editorial serif", blurb: "A light, elegant serif used by every Edition, so your pages share the quality of a printed magazine" };

// ── colour maths (sRGB <-> OKLab <-> OKLCH) ─────────────────────────────────────────────────────────────────────────
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
type Lch = { L: number; C: number; h: number };

export function hexToLch(hex: string): Lch {
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  return { L, C, h: C < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}
function lchToRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
/** An in-gamut sRGB hex for the OKLCH colour; if it is out of gamut the chroma is reduced (never the lightness or hue) until it fits. */
export function lch(L: number, C: number, h: number): string {
  let lo = 0, hi = Math.max(0, C);
  if (inGamut(lchToRgb(L, hi, h))) lo = hi;
  else for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(lchToRgb(L, mid, h))) lo = mid; else hi = mid; }
  const rgb = lchToRgb(L, lo, h).map((v) => Math.round(Math.min(1, Math.max(0, fromLin(Math.min(1, Math.max(0, v))))) * 255));
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** The colour, with lightness nudged (keeping hue and chroma) until it reaches `min`:1 against `against`. Direction follows the background. */
function reach(hex: string, against: string, min: number): string {
  if (contrast(hex, against) >= min) return hex;
  const { L, C, h } = hexToLch(hex);
  const darker = contrast("#000000", against) >= contrast("#ffffff", against);
  for (let i = 1; i <= 60; i++) {
    const next = lch(Math.min(1, Math.max(0, L + (darker ? -i : i) * 0.01)), C, h);
    if (contrast(next, against) >= min) return next;
  }
  return darker ? "#000000" : "#ffffff";
}

// ── the brand ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type Brand = {
  /** The organiser's colour as entered (or the platform default). */
  base: string;
  /** The palette, by role (hex). */
  tone: { ground: string; ground2: string; ink: string; ink2: string; ink3: string; line: string; brand: string; onBrand: string; accent: string; deep: string; onDeep: string; glow: string; tint: string; alt: string };
  /** CSS custom properties for a style attribute on the brand scope. */
  vars: Record<string, string>;
  /** Plain-language checks for the dashboard. */
  checks: { label: string; ratio: number; pass: boolean }[];
  notes: string[];
};

/**
 * The brand colour as a button/fill, with readable text on it. White or dark ink, whichever reads better; only if NEITHER reaches 4.5:1 (a mid-tone such as
 * #e91e63) is the fill nudged, by the smallest lightness change that lets one of them pass, so the colour still reads as the organiser's.
 */
function fillFor(base: string, ink: string): { brand: string; onBrand: string; adjusted: boolean } {
  const pick = (c: string) => (contrast("#ffffff", c) >= contrast(ink, c) ? "#ffffff" : ink);
  if (contrast(pick(base), base) >= 4.5) return { brand: base, onBrand: pick(base), adjusted: false };
  const { L, C, h } = hexToLch(base);
  for (let i = 1; i <= 40; i++) {
    for (const dir of [-1, 1]) {
      const c = lch(Math.min(1, Math.max(0, L + dir * i * 0.005)), C, h);
      if (contrast(pick(c), c) >= 4.5) return { brand: c, onBrand: pick(c), adjusted: true };
    }
  }
  return { brand: base, onBrand: pick(base), adjusted: false };
}

/** OneShetland's own identity for platform pages (the Editions index): the navy, on the site's warm cream paper rather than a paper tinted by the navy. */
export function derivePlatformBrand(): Brand { return build(["#0a4a70"], { paperHue: 85, paperChroma: 0.012 }); }

export function deriveBrand(...candidates: (string | null | undefined)[]): Brand { return build(candidates); }

function build(candidates: (string | null | undefined)[], paper?: { paperHue: number; paperChroma: number }): Brand {
  const base = (candidates.find(isHex) ?? DEFAULT_BRAND).toLowerCase();
  const { L, C, h } = hexToLch(base);
  const cool = h > 170 && h < 310; // blue and green paper looks clinical, so cool hues carry half as much tint
  const tint = Math.min(C * 0.04, 0.0045) * (cool ? 0.6 : 1); // how much of the brand's hue the paper carries (barely: paper should read as cream or chalk, never as a colour)
  const ground = lch(0.972, paper ? paper.paperChroma : tint, paper ? paper.paperHue : h);
  const ground2 = lch(0.945, paper ? paper.paperChroma * 1.5 : Math.min(C * 0.07, 0.0085) * (cool ? 0.6 : 1), paper ? paper.paperHue : h);
  const ink = lch(0.2, Math.min(C * 0.25, 0.04), h);
  const ink2 = reach(lch(0.36, Math.min(C * 0.22, 0.035), h), ground, 7);
  const ink3 = reach(lch(0.5, Math.min(C * 0.2, 0.03), h), ground, 4.8);
  const line = lch(0.865, Math.min(C * 0.12, 0.018), h);
  const { brand, onBrand, adjusted } = fillFor(base, ink);
  const accent = reach(brand, ground, 4.6);
  const deep = lch(0.235, Math.min(Math.max(C * 0.62, 0.03), 0.105), h);
  const onDeep = lch(0.975, Math.min(C * 0.08, 0.012), h);
  const glow = reach(lch(0.82, Math.min(Math.max(C, 0.06), 0.15), h), deep, 7);
  const tintFill = lch(0.925, Math.min(C * 0.3, 0.05), h);
  const alt = lch(Math.min(Math.max(L, 0.5), 0.72), Math.min(Math.max(C * 0.7, 0.05), 0.13), (h + 38) % 360);
  const tone = { ground, ground2, ink, ink2, ink3, line, brand, onBrand, accent, deep, onDeep, glow, tint: tintFill, alt };

  const checks = [
    { label: "Your colour with its button text", ratio: contrast(onBrand, brand) },
    { label: "Your colour as text on the page", ratio: contrast(accent, ground) },
    { label: "Headlines on the page", ratio: contrast(ink, ground) },
    { label: "Text on photographs", ratio: contrast(onDeep, deep) },
  ].map((c) => ({ ...c, ratio: Math.round(c.ratio * 10) / 10, pass: c.ratio >= 4.5 }));

  const notes: string[] = [];
  if (adjusted) notes.push("Your colour sits where neither white nor dark text is comfortable to read, so it is shifted very slightly on buttons and fills.");
  if (accent !== brand) notes.push("Your colour is light for text, so wherever it is used as writing it is deepened slightly. Buttons and fills keep your exact colour.");
  if (onBrand !== "#ffffff") notes.push("Your colour is light, so text on it is dark rather than white.");
  if (C < 0.03) notes.push("This colour is close to grey. Pages will feel very quiet; a colour with a little more character gives richer results.");

  const vars: Record<string, string> = {
    "--ed-ground": ground, "--ed-ground-2": ground2, "--ed-ink": ink, "--ed-ink-2": ink2, "--ed-ink-3": ink3, "--ed-line": line,
    "--ed-brand": brand, "--ed-on-brand": onBrand, "--ed-accent": accent, "--ed-deep": deep, "--ed-on-deep": onDeep, "--ed-glow": glow, "--ed-tint": tintFill, "--ed-alt": alt,
  };
  return { base, tone, vars, checks, notes };
}

// ── what an Edition inherits from its organiser ─────────────────────────────────────────────────────────────────────
type BrandInputs = { brand_color: string | null; logo_url: string | null; cover_url: string | null; cover_focus?: string | null };
export type ResolvedBrand = { color: string | null; logo: string | null; cover: string | null; focus: string; own: { color: boolean; logo: boolean; cover: boolean } };

/** An Edition's own colour, logo and cover win; anything it leaves empty comes from its organiser. A focus point always belongs to the photograph it was set on. */
export function resolveBrand(edition: BrandInputs | null, organiser: BrandInputs): ResolvedBrand {
  const e = edition;
  const ownCover = !!e?.cover_url;
  return {
    color: (isHex(e?.brand_color) ? e!.brand_color : null) ?? (isHex(organiser.brand_color) ? organiser.brand_color : null),
    logo: e?.logo_url || organiser.logo_url || null,
    cover: e?.cover_url || organiser.cover_url || null,
    focus: normaliseFocus(ownCover ? e?.cover_focus : organiser.cover_focus),
    own: { color: isHex(e?.brand_color), logo: !!e?.logo_url, cover: ownCover },
  };
}

export const FOCUS_RE = /^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$/;
export const normaliseFocus = (f: string | null | undefined) => (f && FOCUS_RE.test(f) ? f : "50% 50%");
