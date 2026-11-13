// Run: /Users/darrenfullerton/Claude/safe-test/run-safe.sh <repo> --experimental-strip-types tests/house-swaps-map-shapes.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { MAP_VIEWBOX, REGION_SHAPES, PLACE_POINTS, MAP_ATTRIBUTION } from '../lib/house-swaps-map-shapes.ts'

const file = new URL('../lib/house-swaps-map-shapes.ts', import.meta.url)
const src = readFileSync(file, 'utf8')
const metresPerUnit = Number(/METRES_PER_UNIT:\s*([\d.]+)/.exec(src)?.[1])

// The expected regions and communities come from the canonical geography file, so this test can never drift from it.
const geo = JSON.parse(readFileSync(new URL('../lib/house-swaps-geography.json', import.meta.url), 'utf8'))
const REGIONS = geo.regions
const PLACES = Object.fromEntries(REGIONS.map((r) => [r, geo.places.filter((p) => p.region === r).map((p) => p.id)]))

const TOLERANCE_M = 600

function parsePath(d) {
  const rings = []
  const re = /([MLZ])([^MLZ]*)/g
  let m, cur = null
  while ((m = re.exec(d))) {
    if (m[1] === 'Z') { assert.ok(cur && cur.length >= 3, 'ring too short'); rings.push(cur); cur = null; continue }
    const nums = m[2].trim().split(/[\s,]+/).map(Number)
    assert.equal(nums.length, 2, `bad ${m[1]} args`)
    assert.ok(nums.every(Number.isFinite))
    if (m[1] === 'M') { assert.equal(cur, null, 'M before closing previous ring'); cur = [nums] } else { assert.ok(cur, 'L without M'); cur.push(nums) }
  }
  assert.equal(cur, null, 'unclosed ring')
  assert.equal(d.replace(/[MLZ\d.\s,-]/g, ''), '', 'unexpected path characters')
  return rings
}
const inside = (x, y, rings) => {
  let c = false // even-odd over all rings
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const distToRings = (x, y, rings) => {
  let best = Infinity
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
  }
  return best
}

test('ids present', () => {
  assert.deepEqual(Object.keys(REGION_SHAPES).sort(), [...REGIONS].sort())
  const all = Object.values(PLACES).flat()
  assert.equal(all.length, 43)
  assert.deepEqual(Object.keys(PLACE_POINTS).sort(), [...all].sort())
})

test('file size and attribution', () => {
  assert.ok(statSync(file).size < 90 * 1024)
  assert.ok(MAP_ATTRIBUTION.length > 0 && MAP_ATTRIBUTION.includes('Open Government Licence'))
  assert.ok(Number.isFinite(metresPerUnit) && metresPerUnit > 0)
})

test('paths parse and stay inside the viewBox', () => {
  for (const id of REGIONS) {
    const s = REGION_SHAPES[id]
    const rings = parsePath(s.path)
    assert.ok(rings.length >= 1)
    for (const r of rings) for (const [x, y] of r) {
      assert.ok(x >= 0 && x <= MAP_VIEWBOX.width && y >= 0 && y <= MAP_VIEWBOX.height, `${id} out of viewBox`)
    }
    assert.ok(Number.isFinite(s.labelX) && Number.isFinite(s.labelY))
    assert.ok(inside(s.labelX, s.labelY, rings), `${id} label point is outside its region`)
  }
})

test('every place point lies inside its own region (<= 600 m coastal tolerance)', () => {
  const tolerant = []
  for (const [region, ids] of Object.entries(PLACES)) {
    const rings = parsePath(REGION_SHAPES[region].path)
    for (const id of ids) {
      const p = PLACE_POINTS[id]
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
      assert.ok(p.x >= 0 && p.x <= MAP_VIEWBOX.width && p.y >= 0 && p.y <= MAP_VIEWBOX.height, `${id} outside viewBox`)
      if (inside(p.x, p.y, rings)) continue
      const m = distToRings(p.x, p.y, rings) * metresPerUnit
      tolerant.push(`${id}: ${Math.round(m)} m outside ${region}`)
      assert.ok(m <= TOLERANCE_M, `${id} is ${Math.round(m)} m outside ${region}`)
    }
  }
  if (tolerant.length) console.log('needed coastal tolerance:', tolerant.join('; '))
})

test("Foula is drawn in Shetland West, not Shetland Central (the Shetland Partnership's locality definition)", async () => {
  const { REGION_SHAPES } = await import("../lib/house-swaps-map-shapes.ts");
  // Foula's centre in map units: British National Grid E 396095, N 1138920 -> (E - origin)/metresPerUnit + margin
  const O_E = 393619.5, O_N = 1218623.7035000008, MPU = 188.44, MARGIN = 8;
  const fx = (396095 - O_E) / MPU + MARGIN, fy = (O_N - 1138920) / MPU + MARGIN;
  const rings = (d) => d.split("M").filter((s) => s.trim()).map((s) => {
    const n = (s.match(/-?\d+\.?\d*/g) ?? []).map(Number); const r = [];
    for (let i = 0; i + 1 < n.length; i += 2) r.push([n[i], n[i + 1]]);
    return r;
  });
  const inside = (pt, ring) => { let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    } return c; };
  const hits = (region) => rings(REGION_SHAPES[region].path).some((r) => inside([fx, fy], r));
  assert.equal(hits("shetland_west"), true, "Foula should be part of Shetland West");
  assert.equal(hits("shetland_central"), false, "Foula should no longer be part of Shetland Central");
});
