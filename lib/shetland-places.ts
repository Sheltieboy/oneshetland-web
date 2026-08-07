/**
 * A gazetteer of Shetland places and venues, for putting events on a map.
 *
 * Events carry a venue as free text ("Mareel - Music - Cinema and Education
 * Venue", "Voe", "Fetlar Hall") and no coordinates, so without this an event
 * can be listed but never routed to. Matching is fuzzy and deliberately
 * conservative: if we can't place it confidently we return null and the
 * planner leaves it out of the route rather than sending somebody to a guess.
 *
 * `mainland: false` means a ferry is involved. The planner will not schedule
 * those — inter-island ferry timetables aren't in the database, and inventing
 * a crossing time is how you strand a visitor on Yell.
 */

export type Place = {
  name: string;
  lat: number;
  lng: number;
  mainland: boolean;
  /** Extra strings that should match this place. */
  aliases?: string[];
};

export const PLACES: Place[] = [
  // ── Lerwick and around ──
  { name: "Lerwick", lat: 60.1546, lng: -1.1494, mainland: true, aliases: ["commercial street", "esplanade", "town hall"] },
  { name: "Mareel", lat: 60.1556, lng: -1.1436, mainland: true, aliases: ["mareel music cinema", "north ness"] },
  { name: "Shetland Museum and Archives", lat: 60.1560, lng: -1.1450, mainland: true, aliases: ["shetland museum", "hay's dock"] },
  { name: "Clickimin", lat: 60.1500, lng: -1.1600, mainland: true, aliases: ["clickimin centre", "clickimin broch"] },
  { name: "Islesburgh", lat: 60.1540, lng: -1.1530, mainland: true, aliases: ["islesburgh house"] },
  { name: "Gilbertson Park", lat: 60.1530, lng: -1.1560, mainland: true },
  { name: "Bressay", lat: 60.1500, lng: -1.0800, mainland: false, aliases: ["noss"] },

  // ── South Mainland ──
  { name: "Scalloway", lat: 60.1367, lng: -1.2769, mainland: true },
  { name: "Tingwall", lat: 60.2200, lng: -1.2400, mainland: true, aliases: ["veensgarth"] },
  { name: "Cunningsburgh", lat: 60.0500, lng: -1.2333, mainland: true },
  { name: "Sandwick", lat: 60.0033, lng: -1.2500, mainland: true, aliases: ["hoswick"] },
  { name: "Levenwick", lat: 60.0200, lng: -1.2400, mainland: true },
  { name: "Bigton", lat: 60.0100, lng: -1.3300, mainland: true, aliases: ["st ninian's isle", "st ninians"] },
  { name: "Boddam", lat: 59.9200, lng: -1.2900, mainland: true },
  { name: "Sumburgh", lat: 59.8700, lng: -1.2900, mainland: true, aliases: ["jarlshof", "sumburgh head"] },
  { name: "Virkie", lat: 59.8800, lng: -1.2900, mainland: true, aliases: ["toab"] },

  // ── West and Central Mainland ──
  { name: "Weisdale", lat: 60.2300, lng: -1.3400, mainland: true, aliases: ["weisdale mill", "bonhoga"] },
  { name: "Bixter", lat: 60.2400, lng: -1.4400, mainland: true },
  { name: "Walls", lat: 60.2300, lng: -1.5800, mainland: true },
  { name: "Aith", lat: 60.2900, lng: -1.3600, mainland: true },
  { name: "Sandness", lat: 60.2900, lng: -1.6300, mainland: true },

  // ── North Mainland ──
  { name: "Voe", lat: 60.3450, lng: -1.2600, mainland: true },
  { name: "Brae", lat: 60.3967, lng: -1.3517, mainland: true },
  { name: "Hillswick", lat: 60.4800, lng: -1.4900, mainland: true },
  { name: "Eshaness", lat: 60.4900, lng: -1.6100, mainland: true },
  { name: "Mossbank", lat: 60.4400, lng: -1.1800, mainland: true },
  { name: "Toft", lat: 60.4700, lng: -1.2000, mainland: true },

  // ── Ferry islands: placed, but never routed to (see mainland: false) ──
  { name: "Whalsay", lat: 60.3500, lng: -1.0000, mainland: false, aliases: ["symbister"] },
  { name: "Yell", lat: 60.6000, lng: -1.0500, mainland: false, aliases: ["mid yell", "ulsta", "gutcher"] },
  { name: "Unst", lat: 60.7500, lng: -0.8200, mainland: false, aliases: ["baltasound", "haroldswick"] },
  { name: "Fetlar", lat: 60.6000, lng: -0.8700, mainland: false, aliases: ["houbie", "fetlar hall"] },
  { name: "Skerries", lat: 60.4200, lng: -0.7500, mainland: false, aliases: ["out skerries"] },
  { name: "Papa Stour", lat: 60.3300, lng: -1.6800, mainland: false },
  { name: "Foula", lat: 60.1300, lng: -2.0700, mainland: false },
  { name: "Fair Isle", lat: 59.5350, lng: -1.6300, mainland: false },
];

const normalise = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Best-effort match of a venue/locality string to a place.
 *
 * Longest name first, so "Shetland Museum and Archives" wins over "Shetland"
 * and Mareel isn't swallowed by Lerwick. Returns null rather than a guess —
 * an unplaced event is still shown, just not routed.
 */
export function findPlace(...parts: (string | null | undefined)[]): Place | null {
  const hay = normalise(parts.filter(Boolean).join(" "));
  if (!hay) return null;

  const targets = PLACES.flatMap((p) =>
    [p.name, ...(p.aliases ?? [])].map((t) => ({ place: p, token: normalise(t) })),
  ).sort((a, b) => b.token.length - a.token.length);

  for (const t of targets) {
    // Word-boundary match so "Aith" doesn't match inside "Laithe".
    if (new RegExp(`(^|\\s)${t.token}(\\s|$)`).test(hay)) return t.place;
  }
  return null;
}
