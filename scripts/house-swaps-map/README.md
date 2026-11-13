# House Swaps map geometry

Generates `lib/house-swaps-map-shapes.ts` (7 Shetland Partnership locality polygons + 40 settlement dots).

## Sources and licences
- **Data Zone Boundaries 2011**, Scottish Government (GI-SAT), published 2021-10-05.
  `https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneBdry_2011.zip` (19 MB). Open Government Licence v3.0.
  Attribution: "Copyright Scottish Government, contains Ordnance Survey data (c) Crown copyright and database right <year>".
- **OS Open Names** (CSV, GB), Ordnance Survey, `https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect` (103 MB, no key). OS OpenData licence (OGL v3.0 compatible).
  Attribution: "Contains OS data (c) Crown copyright and database right 2026".
The exact combined string is `MAP_ATTRIBUTION` in the generated file. Raw downloads stay in `/tmp`, never committed.

## Steps
```
mkdir -p /tmp/house-swaps-map/dz && cd /tmp/house-swaps-map
curl -L -o dz.zip https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneBdry_2011.zip && unzip -o dz.zip -d dz
cd <repo> && node scripts/house-swaps-map/build.mjs /tmp/house-swaps-map
```
`build.mjs` runs `npx mapshaper@0.7.101` (filter the 30 Shetland zones S01012387-S01012416 by name, dissolve to
region per `regions.json`, drop islets < 0.15 km2, Visvalingam simplify 80 m with keep-shapes; shared topology means
region borders match exactly), then projects and writes the TS file and `/tmp/house-swaps-map/preview.svg`.
Tunables: `SIMPLIFY_M`, `MIN_ISLAND_M2`.

## Projection
EPSG:27700 metres (source CRS), uniform scale, y flipped, viewBox width 420, 8-unit margin (about 188 m per unit).
Header of the generated file records `METRES_PER_UNIT` and the BNG origin.

## Place points
`places.json`: BNG coordinates from OS Open Names (settlement level only). `proxy: true` entries used a nearby feature because
Open Names has no settlement of that name (bressay, tingwall, fair_isle, virkie). `build.mjs` nudges a dot just inside its
intended region when the data-zone grouping puts the settlement on the other side of a border (Weisdale village lies in
Shetland West data zones; allocation area is Shetland Central) or on the shoreline.

Regions are statistical (data zone) groupings of the locality profiles, not legal boundaries. Foula, Burra, Trondra and Papa
go to Shetland Central/West as the data zones place them (Foula: Central; Papa Stour: West; Fair Isle: South).

Test: `tests/house-swaps-map-shapes.test.mjs`.
