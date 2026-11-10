// Test-only stand-in for next/font/google: each loader returns the shape the app reads (a CSS variable class name).
const font = (name) => (opts = {}) => ({ className: `font-${name}`, variable: `${opts.variable ?? "--font"}-cls`, style: { fontFamily: name } });
export const Instrument_Serif = font("instrument-serif"), Inter = font("inter");
