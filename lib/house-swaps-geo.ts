/**
 * house-swaps-geo.ts — the two-level Shetland location model for House Swaps (pure, no Next imports, unit-testable).
 *
 * BROAD REGIONS are the seven Shetland Partnership localities; COMMUNITIES are the 40 council housing allocation areas (house_swap_places in the
 * database). The ids/names mirror docs/house-swaps/geography.json in the backend repo (copied to lib/house-swaps-geography.json; a test keeps the two equal).
 * These are only labels to help members find each other: they do not affect anyone's housing application, and no address, street or postcode is ever used.
 */

export type RegionId = "lerwick_bressay" | "shetland_central" | "shetland_north" | "shetland_south" | "shetland_west" | "whalsay_skerries" | "yell_unst_fetlar";
export type Region = { id: RegionId; name: string };
export type Place = { id: string; regionId: RegionId; name: string; official: string; group?: string };

export const REGIONS: Region[] = [
  { id: "lerwick_bressay", name: "Lerwick & Bressay" },
  { id: "shetland_central", name: "Central Mainland" },
  { id: "shetland_north", name: "North Mainland" },
  { id: "shetland_south", name: "South Mainland" },
  { id: "shetland_west", name: "West Mainland / Westside" },
  { id: "whalsay_skerries", name: "Whalsay & Skerries" },
  { id: "yell_unst_fetlar", name: "Yell, Unst & Fetlar / North Isles" },
];

export const PLACES: Place[] = [
  { id: "lerwick", regionId: "lerwick_bressay", name: "Lerwick", official: "Lerwick" },
  { id: "bressay", regionId: "lerwick_bressay", name: "Bressay", official: "Bressay" },
  { id: "scalloway", regionId: "shetland_central", name: "Scalloway", official: "Scalloway" },
  { id: "burra_bridge_end_toogs", regionId: "shetland_central", name: "Burra: Bridge End & Toogs", official: "Burra—Bridge End/ Toogs", group: "Burra" },
  { id: "burra_hamnavoe", regionId: "shetland_central", name: "Burra: Hamnavoe", official: "Burra—Hamnavoe", group: "Burra" },
  { id: "tingwall", regionId: "shetland_central", name: "Tingwall", official: "Tingwall" },
  { id: "weisdale", regionId: "shetland_central", name: "Weisdale", official: "Weisdale" },
  { id: "whiteness", regionId: "shetland_central", name: "Whiteness", official: "Whiteness" },
  { id: "brae", regionId: "shetland_north", name: "Brae", official: "Brae" },
  { id: "firth", regionId: "shetland_north", name: "Firth", official: "Firth" },
  { id: "hillswick", regionId: "shetland_north", name: "Hillswick", official: "Hillswick" },
  { id: "mossbank", regionId: "shetland_north", name: "Mossbank", official: "Mossbank" },
  { id: "sullom", regionId: "shetland_north", name: "Sullom", official: "Sullom" },
  { id: "north_roe", regionId: "shetland_north", name: "North Roe", official: "North Roe" },
  { id: "ollaberry", regionId: "shetland_north", name: "Ollaberry", official: "Ollaberry" },
  { id: "eshaness", regionId: "shetland_north", name: "Eshaness", official: "Eshaness" },
  { id: "south_nesting", regionId: "shetland_north", name: "South Nesting", official: "South Nesting" },
  { id: "urafirth", regionId: "shetland_north", name: "Urafirth", official: "Urafirth" },
  { id: "vidlin", regionId: "shetland_north", name: "Vidlin", official: "Vidlin" },
  { id: "voe", regionId: "shetland_north", name: "Voe", official: "Voe" },
  { id: "bigton", regionId: "shetland_south", name: "Bigton", official: "Bigton" },
  { id: "boddam", regionId: "shetland_south", name: "Boddam", official: "Boddam" },
  { id: "cunningsburgh", regionId: "shetland_south", name: "Cunningsburgh", official: "Cunningsburgh" },
  { id: "gulberwick", regionId: "shetland_south", name: "Gulberwick", official: "Gulberwick" },
  { id: "fair_isle", regionId: "shetland_south", name: "Fair Isle", official: "Fair Isle" },
  { id: "sandwick", regionId: "shetland_south", name: "Sandwick", official: "Sandwick" },
  { id: "virkie", regionId: "shetland_south", name: "Virkie", official: "Virkie" },
  { id: "aith", regionId: "shetland_west", name: "Aith", official: "Aith" },
  { id: "bixter", regionId: "shetland_west", name: "Bixter", official: "Bixter" },
  { id: "sandness", regionId: "shetland_west", name: "Sandness", official: "Sandness" },
  { id: "skeld", regionId: "shetland_west", name: "Skeld", official: "Skeld" },
  { id: "tresta", regionId: "shetland_west", name: "Tresta", official: "Tresta" },
  { id: "walls", regionId: "shetland_west", name: "Walls", official: "Walls" },
  { id: "whalsay_brough", regionId: "whalsay_skerries", name: "Whalsay: Brough", official: "Whalsay—Brough", group: "Whalsay" },
  { id: "whalsay_symbister", regionId: "whalsay_skerries", name: "Whalsay: Symbister", official: "Whalsay-Symbister", group: "Whalsay" },
  { id: "out_skerries", regionId: "whalsay_skerries", name: "Out Skerries", official: "Out Skerries" },
  { id: "fetlar", regionId: "yell_unst_fetlar", name: "Fetlar", official: "Fetlar" },
  { id: "unst_baltasound", regionId: "yell_unst_fetlar", name: "Unst: Baltasound", official: "Unst—Baltasound", group: "Unst" },
  { id: "unst_haroldswick", regionId: "yell_unst_fetlar", name: "Unst: Haroldswick", official: "Unst—Haroldswick", group: "Unst" },
  { id: "unst_uyeasound", regionId: "yell_unst_fetlar", name: "Unst: Uyeasound", official: "Unst—Uyeasound", group: "Unst" },
  { id: "yell_burravoe", regionId: "yell_unst_fetlar", name: "Yell: Burravoe", official: "Yell—Burravoe", group: "Yell" },
  { id: "yell_cullivoe", regionId: "yell_unst_fetlar", name: "Yell: Cullivoe", official: "Yell—Cullivoe", group: "Yell" },
  { id: "yell_mid_yell", regionId: "yell_unst_fetlar", name: "Yell: Mid Yell", official: "Yell—Mid Yell", group: "Yell" },
];

export const REGION_IDS: string[] = REGIONS.map((r) => r.id);
export const PLACE_IDS: string[] = PLACES.map((p) => p.id);
/** The groups of communities on one island or in one village area (Burra, Unst, Yell, Whalsay). */
export const GROUPS: string[] = [...new Set(PLACES.flatMap((p) => (p.group ? [p.group] : [])))];
export const GROUP_NOTE = "These are just to help people find each other; they don't affect anyone's housing application.";

export const regionName = (id: string | null | undefined): string => REGIONS.find((r) => r.id === id)?.name ?? "Shetland";
export const placeById = (id: string | null | undefined): Place | undefined => PLACES.find((p) => p.id === id);
export const placeLabel = (id: string | null | undefined): string => placeById(id)?.name ?? "";
export const regionOf = (placeId: string | null | undefined): RegionId | null => placeById(placeId)?.regionId ?? null;
export const placesIn = (regionId: string): Place[] => PLACES.filter((p) => p.regionId === regionId);
export const placesInGroup = (group: string): Place[] => PLACES.filter((p) => p.group === group);
export const isPlaceId = (v: string): boolean => PLACE_IDS.includes(v);

/** "Lerwick, Lerwick & Bressay" when there is a community; the region alone otherwise. */
export function describeLocation(regionId: string | null | undefined, placeId?: string | null): string {
  const place = placeById(placeId);
  const region = REGION_IDS.includes(regionId ?? "") ? regionName(regionId) : place ? regionName(place.regionId) : "";
  if (place) return region ? `${place.name}, ${region}` : place.name;
  return region;
}

export type WantSel = { regionIds: string[]; placeIds: string[] };

/** Drop unknown ids and duplicates, and any community that sits inside a region already chosen as a whole. */
export function normaliseWants(sel: WantSel): WantSel {
  const regionIds = [...new Set(sel.regionIds.filter((r) => REGION_IDS.includes(r)))];
  const placeIds = [...new Set(sel.placeIds.filter((p) => isPlaceId(p) && !regionIds.includes(regionOf(p) ?? "")))];
  return { regionIds, placeIds };
}

/** "Anywhere in Shetland", or a compact list: "North Mainland, Brae and Voe", "All of Yell and Scalloway", "Lerwick, Voe, Brae and 2 more". */
export function describeWants(sel: WantSel, max = 3): string {
  const { regionIds, placeIds } = normaliseWants(sel);
  if (!regionIds.length && !placeIds.length) return "Anywhere in Shetland";
  const items: string[] = regionIds.map(regionName);
  const left = new Set(placeIds);
  for (const g of GROUPS) {
    const ps = placesInGroup(g);
    if (ps.length > 1 && ps.every((p) => left.has(p.id))) { ps.forEach((p) => left.delete(p.id)); items.push(`All of ${g}`); }
  }
  for (const p of PLACES) if (left.has(p.id)) items.push(p.name);
  if (items.length <= max) return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
}

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Case/diacritic-insensitive search over region and community names (and a community's official name and group). Empty query matches everything. */
export function searchLocations(query: string): { regions: Region[]; places: Place[] } {
  const q = fold(query);
  if (!q) return { regions: REGIONS, places: PLACES };
  const hit = (...parts: (string | undefined)[]) => parts.some((s) => s && fold(s).includes(q));
  return {
    regions: REGIONS.filter((r) => hit(r.name)),
    places: PLACES.filter((p) => hit(p.name, p.official, p.group)),
  };
}

// ── Selection reducers (pure; the pickers and the map share them) ─────────────────────────────────────────────────────────────────────────────

/** What "wants" looks like while editing: anywhere is its own switch, mutually exclusive with the rest. */
export type WantState = WantSel & { anywhere: boolean };
export const ANYWHERE: WantState = { anywhere: true, regionIds: [], placeIds: [] };

/**
 * What is held is exactly what is shown and saved: no hidden state. A choice only ever leaves the list when the member removes it,
 * or when they choose the whole area that covers it (which asks for MORE places, not fewer, and is announced on screen).
 */
export const effectiveWants = (s: WantSel): WantSel => normaliseWants(s);
/** Communities already covered by a whole area that is being chosen, so the screen can say what just happened. */
export const coveredBy = (s: WantSel, regionId: string): string[] => s.placeIds.filter((p) => regionOf(p) === regionId);
/** True when this community cannot be chosen on its own because the whole area around it is already chosen. */
export const coveredAlready = (s: WantSel, placeId: string): boolean => {
  const p = placeById(placeId);
  return !!p && s.regionIds.includes(p.regionId);
};
const wantNorm = (s: WantState): WantState => {
  const n = normaliseWants(s);
  return { anywhere: !n.regionIds.length && !n.placeIds.length ? s.anywhere : false, ...n };
};

export function toggleAnywhere(s: WantState): WantState {
  return s.anywhere ? { anywhere: false, regionIds: [], placeIds: [] } : ANYWHERE;
}
export function toggleWantRegion(s: WantState, regionId: string): WantState {
  if (!REGION_IDS.includes(regionId)) return s;
  const has = s.regionIds.includes(regionId);
  return wantNorm({ anywhere: false, regionIds: has ? s.regionIds.filter((r) => r !== regionId) : [...s.regionIds, regionId], placeIds: s.placeIds });
}
/**
 * Add or remove one community. A community inside a whole area that is already chosen CANNOT be toggled here: the choice stands
 * until the member removes the whole area themselves, so nothing of theirs is ever taken away by a tap meant to add something.
 */
export function toggleWantPlace(s: WantState, placeId: string): WantState {
  const p = placeById(placeId);
  if (!p || s.regionIds.includes(p.regionId)) return s;
  if (s.placeIds.includes(placeId)) return wantNorm({ ...s, anywhere: false, placeIds: s.placeIds.filter((x) => x !== placeId) });
  return wantNorm({ ...s, anywhere: false, placeIds: [...s.placeIds, placeId] });
}
/** True when every community in the group is chosen by name (not merely covered by a whole region). */
export const isGroupChosen = (s: WantState, group: string): boolean => {
  const eff = effectiveWants(s);
  return placesInGroup(group).every((p) => eff.placeIds.includes(p.id));
};
/** "All of Yell": selects every community in the group, or clears them if they are all already chosen. From a whole region it converts to just the group. */
export function toggleWantGroup(s: WantState, group: string): WantState {
  const ps = placesInGroup(group);
  if (!ps.length) return s;
  if (isGroupChosen(s, group)) {
    const drop = new Set(ps.map((p) => p.id));
    return wantNorm({ anywhere: false, regionIds: s.regionIds, placeIds: s.placeIds.filter((x) => !drop.has(x)) });
  }
  if (ps.some((p) => s.regionIds.includes(p.regionId))) return s; // already covered by a whole area the member chose
  return wantNorm({ anywhere: false, regionIds: s.regionIds, placeIds: [...new Set([...s.placeIds, ...ps.map((p) => p.id)])] });
}
/** The x on a chip removes exactly that one destination and nothing else. */
export function removeWant(s: WantState, id: string): WantState {
  if (isPlaceId(id)) return wantNorm({ ...s, anywhere: false, placeIds: s.placeIds.filter((x) => x !== id) });
  if (!REGION_IDS.includes(id)) return s;
  return wantNorm({ anywhere: false, regionIds: s.regionIds.filter((r) => r !== id), placeIds: s.placeIds });
}
/** How many places the advert actually asks for: whole regions plus communities outside them. */
export function wantCount(s: WantState): number {
  const eff = effectiveWants(s);
  return eff.regionIds.length + eff.placeIds.length;
}

export type HomeState = { regionId: string; placeId: string };
/** Choosing a region keeps the chosen community only if it is inside that region. */
export function chooseHomeRegion(s: HomeState, regionId: string): HomeState {
  if (!REGION_IDS.includes(regionId)) return s;
  return { regionId, placeId: regionOf(s.placeId) === regionId ? s.placeId : "" };
}
/** Choosing a community also chooses its region; choosing the same one again keeps the region and goes back to "just keep it broad". */
export function chooseHomePlace(s: HomeState, placeId: string): HomeState {
  const r = regionOf(placeId);
  if (!r) return s;
  return { regionId: r, placeId: s.placeId === placeId ? "" : placeId };
}
export const keepHomeBroad = (s: HomeState): HomeState => ({ regionId: s.regionId, placeId: "" });
