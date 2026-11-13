// Builds lib/house-swaps-map-shapes.ts and an SVG preview from the Scottish Government
// 2011 Data Zone boundaries + OS Open Names. See README.md. Node >= 22.
//   node scripts/house-swaps-map/build.mjs [workDir=/tmp/house-swaps-map]
// workDir must contain (see README): dz/SG_DataZone_Bdry_2011.shp (+dbf/shx/prj)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const work = process.argv[2] ?? '/tmp/house-swaps-map'
const SIMPLIFY_M = Number(process.env.SIMPLIFY_M ?? 80) // Visvalingam effective-area interval, metres
const MIN_ISLAND_M2 = Number(process.env.MIN_ISLAND_M2 ?? 150000)
const WIDTH = 420
const MARGIN = 8

const regions = JSON.parse(readFileSync(join(here, 'regions.json'), 'utf8'))
const places = JSON.parse(readFileSync(join(here, 'places.json'), 'utf8'))
delete places._comment
const nameToRegion = {}
for (const [r, names] of Object.entries(regions)) for (const n of names) nameToRegion[n] = r

// 1. filter + dissolve + simplify with mapshaper (shared topology => borders match)
mkdirSync(work, { recursive: true })
const out = join(work, 'regions-bng.json')
const names = Object.keys(nameToRegion)
execFileSync('npx', ['--yes', 'mapshaper@0.7.101',
  join(work, 'dz', 'SG_DataZone_Bdry_2011.shp'),
  '-filter', `${JSON.stringify(names)}.indexOf(Name.trim())>-1`,
  '-each', `region=(${JSON.stringify(nameToRegion)})[Name.trim()]`,
  '-dissolve', 'region',
  '-filter-islands', `min-area=${MIN_ISLAND_M2}`, 'remove-empty',
  '-simplify', 'visvalingam', `interval=${SIMPLIFY_M}`, 'keep-shapes',
  '-o', out, 'format=geojson', 'force'], { stdio: 'inherit' })

const gj = JSON.parse(readFileSync(out, 'utf8'))
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

// 2. projection: BNG metres, uniform scale, y flipped
let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity
for (const f of gj.features) for (const p of polysOf(f.geometry)) for (const ring of p) for (const [e, n] of ring) {
  minE = Math.min(minE, e); maxE = Math.max(maxE, e); minN = Math.min(minN, n); maxN = Math.max(maxN, n)
}
const scale = (WIDTH - 2 * MARGIN) / (maxE - minE) // viewBox units per metre
const height = Math.ceil((maxN - minN) * scale + 2 * MARGIN)
const X = (e) => +((e - minE) * scale + MARGIN).toFixed(1)
const Y = (n) => +((maxN - n) * scale + MARGIN).toFixed(1)
const metresPerUnit = +(1 / scale).toFixed(2)

const ringPath = (ring) => {
  const pts = []
  let last = ''
  for (const [e, n] of ring.slice(0, -1)) {
    const s = `${X(e)} ${Y(n)}`
    if (s !== last) pts.push(s)
    last = s
  }
  return pts.length < 3 ? '' : 'M' + pts.join('L') + 'Z'
}

// 3. label point: pole of inaccessibility of the largest ring (grid search, outer ring only)
const pip = (x, y, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
const ringArea = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0) / 2)
function labelPoint(polys) {
  const biggest = polys.map((p) => p[0].slice(0, -1).map(([e, n]) => [X(e), Y(n)])).sort((a, b) => ringArea(b) - ringArea(a))[0]
  const xs = biggest.map((p) => p[0]), ys = biggest.map((p) => p[1])
  let best = null
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) {
    if (!pip(x, y, biggest)) continue
    let d = Infinity
    for (let i = 0; i < biggest.length; i++) d = Math.min(d, segDist(x, y, biggest[i], biggest[(i + 1) % biggest.length]))
    if (!best || d > best.d) best = { x, y, d }
  }
  return { labelX: +best.x.toFixed(1), labelY: +best.y.toFixed(1) }
}

const order = ['lerwick_bressay', 'shetland_central', 'shetland_north', 'shetland_south', 'shetland_west', 'whalsay_skerries', 'yell_unst_fetlar']
// FOULA: the 2011 data zones put Foula in Central Shetland, but the Shetland Partnership's locality profile text places it with Shetland West.
// Move the Foula polygon (the only Central ring whose centroid lies west of BNG easting 410000) so selection and matching follow the Partnership.
function moveFoulaToWest(gj) {
  const central = gj.features.find((x) => x.properties.region === 'shetland_central')
  const west = gj.features.find((x) => x.properties.region === 'shetland_west')
  if (!central || !west) throw new Error('Foula override: region missing')
  const take = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
  const cp = take(central), wp = take(west)
  const isFoula = (poly) => { const r = poly[0]; return r.reduce((a, pt) => a + pt[0], 0) / r.length < 410000 }
  const moved = cp.filter(isFoula)
  if (moved.length !== 1) throw new Error('Foula override: expected exactly one ring west of 410000, got ' + moved.length)
  central.geometry = { type: 'MultiPolygon', coordinates: cp.filter((x) => !isFoula(x)) }
  west.geometry = { type: 'MultiPolygon', coordinates: [...wp, ...moved] }
  console.log('Foula moved from shetland_central to shetland_west')
}
moveFoulaToWest(gj)

const shapes = {}
for (const id of order) {
  const f = gj.features.find((x) => x.properties.region === id)
  if (!f) throw new Error('missing region ' + id)
  const polys = polysOf(f.geometry)
  const d = polys.map((p) => p.map(ringPath).join('')).join('')
  shapes[id] = { path: d, ...labelPoint(polys) }
}
const pts = {}
const nudged = []
const insideRegion = (x, y, polys) => polys.some((p) => {
  let c = false // even-odd across outer ring + holes
  for (const ring of p) {
    const r = ring.slice(0, -1).map(([e, n]) => [X(e), Y(n)])
    if (pip(x, y, r)) c = !c
  }
  return c
})
for (const [id, p] of Object.entries(places)) {
  let x = X(p.e), y = Y(p.n)
  const polys = polysOf(gj.features.find((f) => f.properties.region === p.region).geometry)
  if (!insideRegion(x, y, polys)) {
    // The data-zone grouping puts this settlement in a neighbouring region (or on the shoreline):
    // move the dot to the nearest point just inside its allocation-area region (max 1 km).
    let best = null
    for (const poly of polys) for (const ring of poly) {
      const r = ring.map(([e, n]) => [X(e), Y(n)])
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, ay] = r[i], [bx, by] = r[i + 1]
        const dx = bx - ax, dy = by - ay
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
        const qx = ax + t * dx, qy = ay + t * dy, d = Math.hypot(x - qx, y - qy)
        if (!best || d < best.d) best = { d, qx, qy }
      }
    }
    const metres = best.d / scale
    if (metres > 1000) throw new Error(`${id} is ${Math.round(metres)} m from region ${p.region}`)
    const ux = (best.qx - x) / (best.d || 1), uy = (best.qy - y) / (best.d || 1)
    for (let extra = 60; extra <= 600; extra += 30) {
      const nx = +(best.qx + ux * extra * scale).toFixed(1), ny = +(best.qy + uy * extra * scale).toFixed(1)
      if (insideRegion(nx, ny, polys)) { x = nx; y = ny; break }
    }
    nudged.push(`${id} moved ${Math.round(metres)} m (+inset) into ${p.region}`)
  }
  pts[id] = { x, y }
}
if (nudged.length) console.log('NUDGED:', nudged.join('; '))

// 4. emit TypeScript
const attribution =
  'Contains public sector information licensed under the Open Government Licence v3.0. ' +
  'Region boundaries: Copyright Scottish Government, contains Ordnance Survey data © Crown copyright and database right 2021 ' +
  '(Data Zone Boundaries 2011, Scottish Government; data zones grouped by the Shetland Partnership localities). ' +
  'Place locations: Contains OS data © Crown copyright and database right 2026 (OS Open Names).'
const q = (s) => JSON.stringify(s)
const header = `/**
 * Shetland map geometry for OneShetland House Swaps (generated - do not edit by hand).
 * Rebuild with: node scripts/house-swaps-map/build.mjs   (see scripts/house-swaps-map/README.md)
 *
 * SOURCES
 *  1. Data Zone Boundaries 2011, Scottish Government (GI-SAT), published 2021-10-05.
 *     https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneBdry_2011.zip
 *     Licence: Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
 *     Required attribution: "Copyright Scottish Government, contains Ordnance Survey data (c) Crown copyright and database right <year>".
 *  2. OS Open Names (CSV, GB), Ordnance Survey, downloaded 2026-11-13.
 *     https://api.os.uk/downloads/v1/products/OpenNames/downloads
 *     Licence: OS OpenData Licence / OGL v3.0. Attribution: "Contains OS data (c) Crown copyright and database right 2026".
 *
 * REGION DERIVATION: the 30 Shetland 2011 Data Zones (S01012387-S01012416) were dissolved into the
 * seven Shetland Partnership localities (locality profiles) as follows:
${Object.entries(regions).map(([r, n]) => ` *   ${r.padEnd(17)} = ${n.map((s) => s.replace(' - ', ' ')).join(', ')}`).join('\n')}
 * Regions are statistical (data zone) groupings of the Shetland Partnership localities, not legal boundaries.
 * Small islands are placed where the data zones put them. Islets under ${(MIN_ISLAND_M2 / 1e6).toFixed(2)} km2 were dropped.
 *
 * GEOMETRY: EPSG:27700 (British National Grid) metres, uniform scale, y down. Simplified with mapshaper
 * 0.7.101 (Visvalingam, ${SIMPLIFY_M} m interval, topology-preserving so shared borders match). Paths use the
 * even-odd fill rule (use fill-rule="evenodd" if a region has holes).
 * METRES_PER_UNIT: ${metresPerUnit}
 * ORIGIN_BNG: ${minE} ${maxN} (top-left, before ${MARGIN}-unit margin)
 *
 * PLACE POINTS: settlement-level only (never individual properties).${nudged.length ? ' Nudged just inside their region: ' + nudged.join('; ') + '.' : ''} Proxy locations
 * (${Object.entries(places).filter(([, p]) => p.proxy).map(([id]) => id).join(', ')}) use nearby OS Open Names features.
 */
`
const ts = `${header}
export const MAP_VIEWBOX = { width: ${WIDTH}, height: ${height} }

export const REGION_SHAPES: Record<string, { path: string; labelX: number; labelY: number }> = {
${order.map((id) => `  ${id}: { path: ${q(shapes[id].path)}, labelX: ${shapes[id].labelX}, labelY: ${shapes[id].labelY} },`).join('\n')}
}

export const PLACE_POINTS: Record<string, { x: number; y: number }> = {
${Object.entries(pts).map(([id, p]) => `  ${id}: { x: ${p.x}, y: ${p.y} },`).join('\n')}
}

export const MAP_ATTRIBUTION: string =
  ${q(attribution)}
`
writeFileSync(join(repo, 'lib', 'house-swaps-map-shapes.ts'), ts)
console.log('wrote lib/house-swaps-map-shapes.ts', Buffer.byteLength(ts), 'bytes; viewBox', WIDTH, height, 'm/unit', metresPerUnit)

// 5. preview SVG
const colours = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#9a6324']
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH * 1.9} ${height}" width="${WIDTH * 1.9 * 1.6}" height="${height * 1.6}">
<rect width="100%" height="100%" fill="#dff1fb"/>
${order.map((id, i) => `<path d="${shapes[id].path}" fill="${colours[i]}" fill-opacity="0.55" stroke="#222" stroke-width="0.4" fill-rule="evenodd"/>`).join('\n')}
${order.map((id) => `<text x="${shapes[id].labelX}" y="${shapes[id].labelY}" font-size="9" font-weight="bold" text-anchor="middle" fill="#000">${id}</text>`).join('\n')}
${Object.entries(pts).map(([id, p]) => `<circle cx="${p.x}" cy="${p.y}" r="1.6" fill="#000"/><text x="${p.x + 3}" y="${p.y + 2}" font-size="5.5" fill="#000">${places[id].name}</text>`).join('\n')}
</svg>`
writeFileSync(join(work, 'preview.svg'), svg)
