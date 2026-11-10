import localFont from "next/font/local";

/**
 * The one Edition display typeface, shared by every Edition: Instrument Serif (self-hosted, SIL OFL 1.1), a light, elegant editorial serif. Brand identity comes from colour, imagery, logo
 * and content, never from a different typeface, so every Edition keeps the same publication quality. The body face is the site's Inter, loaded by the root layout.
 */
export const editorial = localFont({
  src: [
    { path: "../../app/fonts/InstrumentSerif-latin-normal.woff2", weight: "400", style: "normal" },
    { path: "../../app/fonts/InstrumentSerif-latin-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-ed-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
export const EDITION_FONT_VARS = editorial.variable;
