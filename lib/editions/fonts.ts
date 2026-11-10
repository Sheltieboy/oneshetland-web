import { Instrument_Serif } from "next/font/google";

/**
 * The one Edition display typeface, shared by every Edition: Instrument Serif, a light, elegant editorial serif. Brand identity comes from colour, imagery, logo
 * and content, never from a different typeface, so every Edition keeps the same publication quality. The body face is the site's Inter, loaded by the root layout.
 */
export const editorial = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-ed-display", display: "swap" });
export const EDITION_FONT_VARS = editorial.variable;
