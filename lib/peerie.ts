/**
 * Peerie Bot — the OneShetland AI assistant.
 *
 * "Peerie" is Shetland dialect for "little"; the "Bot" makes it unmistakably an
 * AI helper. This module is the single source of truth for the assistant's
 * identity and its signature "working" glow — a multicoloured wave that borrows
 * the OneShetland ring colours, so anything Peerie Bot touches lights up.
 */

export const PEERIE = {
  name: "Peerie Bot",
  role: "AI assistant",
  /** Always paired with the name so it's clear this is AI, not a person. */
  tag: "AI",
  spark: "✨",
} as const;

/**
 * The OneShetland "rings" palette — the interlocking-ring mark rendered as a
 * colour set. Reused across the ecosystem (each ring echoes a section accent).
 * Drives the AiGlow border animation.
 */
export const RING_COLOURS = [
  "#12B3D6", // spik cyan
  "#7C3AED", // cruise violet
  "#E8A020", // what's-on amber
  "#10B981", // games emerald
  "#E0722A", // local orange
  "#4F46E5", // directory indigo
  "#EC4899", // pink
] as const;

/** CSS `conic-gradient` colour stops for the glow (loops back to the first). */
export const RING_CONIC = [...RING_COLOURS, RING_COLOURS[0]].join(", ");
