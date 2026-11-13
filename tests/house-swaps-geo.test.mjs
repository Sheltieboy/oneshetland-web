// Run: /Users/darrenfullerton/Claude/safe-test/run-safe.sh <repo> --experimental-strip-types tests/house-swaps-geo.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as g from '../lib/house-swaps-geo.ts'
import * as hs from '../lib/house-swaps.ts'
import * as w from '../lib/house-swaps-wizard.ts'

const json = JSON.parse(readFileSync(new URL('../lib/house-swaps-geography.json', import.meta.url), 'utf8'))

test('the TypeScript geography equals the backend JSON: 7 regions, 43 places, unique ids, valid regions', () => {
  assert.equal(g.REGIONS.length, 7)
  assert.equal(g.PLACES.length, 43)
  assert.deepEqual(g.REGIONS.map((r) => r.id), json.regions)
  assert.deepEqual(g.PLACES.map((p) => ({ id: p.id, region: p.regionId, name: p.name, official: p.official, ...(p.group ? { group: p.group } : {}) })), json.places)
  assert.equal(new Set(g.PLACE_IDS).size, 43)
  for (const p of g.PLACES) assert.ok(g.REGION_IDS.includes(p.regionId), p.id)
  assert.deepEqual(g.GROUPS.sort(), ['Burra', 'Unst', 'Whalsay', 'Yell'])
})
test('region names match the vocabulary the rest of House Swaps uses', () => {
  assert.deepEqual(g.REGIONS.map((r) => [r.id, r.name]), hs.AREAS.map((a) => [a.id, a.name]))
})
test('labels and descriptions', () => {
  assert.equal(g.placeLabel('scalloway'), 'Scalloway')
  assert.equal(g.placeLabel('nope'), '')
  assert.equal(g.regionOf('voe'), 'shetland_north')
  assert.equal(g.regionOf('x'), null)
  assert.equal(g.describeLocation('lerwick_bressay', 'lerwick'), 'Lerwick, Lerwick & Bressay')
  assert.equal(g.describeLocation('shetland_north', null), 'North Mainland')
  assert.equal(g.describeLocation('shetland_north', ''), 'North Mainland')
  assert.equal(g.describeWants({ regionIds: [], placeIds: [] }), 'Anywhere in Shetland')
  assert.equal(g.describeWants({ regionIds: ['shetland_north'], placeIds: ['scalloway'] }), 'North Mainland and Scalloway')
  assert.equal(g.describeWants({ regionIds: [], placeIds: ['yell_burravoe', 'yell_cullivoe', 'yell_mid_yell'] }), 'All of Yell')
  assert.equal(g.describeWants({ regionIds: [], placeIds: ['lerwick', 'voe', 'brae', 'walls', 'aith'] }), 'Lerwick, Brae, Voe and 2 more')
  assert.equal(g.describeWants({ regionIds: ['shetland_north'], placeIds: ['voe'] }), 'North Mainland', 'a community inside a chosen region is not listed twice')
})
test('normaliseWants drops places inside chosen regions, unknown ids and duplicates', () => {
  assert.deepEqual(g.normaliseWants({ regionIds: ['shetland_north', 'shetland_north', 'zzz'], placeIds: ['voe', 'scalloway', 'scalloway', 'nope'] }), { regionIds: ['shetland_north'], placeIds: ['scalloway'] })
})
test('search is case and diacritic insensitive over region and community names', () => {
  assert.ok(g.searchLocations('YELL').places.some((p) => p.id === 'yell_mid_yell'))
  assert.ok(g.searchLocations('yell').regions.some((r) => r.id === 'yell_unst_fetlar'))
  assert.ok(g.searchLocations('Hamnavoé').places.some((p) => p.id === 'burra_hamnavoe'))
  assert.equal(g.searchLocations('burra').places.filter((p) => p.group === 'Burra').length, 2)
  assert.equal(g.searchLocations('zzzz').places.length + g.searchLocations('zzzz').regions.length, 0)
  assert.equal(g.searchLocations('  ').places.length, 43)
})
test('wants reducers: anywhere is exclusive; region then community converts; groups; remove', () => {
  let s = g.ANYWHERE
  s = g.toggleWantRegion(s, 'shetland_central')
  assert.deepEqual(s, { anywhere: false, regionIds: ['shetland_central'], placeIds: [] })
  s = g.toggleWantPlace(s, 'scalloway')
  assert.deepEqual(s, { anywhere: false, regionIds: ['shetland_central'], placeIds: [] }, 'a community covered by a chosen whole area cannot be toggled: the area choice stands')
  assert.ok(g.coveredAlready(s, 'scalloway'), 'and the screen can say why')
  assert.equal(g.wantCount(s), 1)
  s = g.toggleAnywhere(s)
  assert.deepEqual(s, g.ANYWHERE)
  s = g.toggleWantGroup(g.toggleAnywhere(s), 'Yell')
  assert.deepEqual(s.placeIds.sort(), ['yell_burravoe', 'yell_cullivoe', 'yell_mid_yell'])
  assert.ok(g.isGroupChosen(s, 'Yell'))
  s = g.toggleWantGroup(s, 'Yell')
  assert.equal(g.wantCount(s), 0)
  const whole = g.toggleWantRegion(g.ANYWHERE, 'yell_unst_fetlar')
  assert.deepEqual(g.toggleWantGroup(whole, 'Yell'), whole, 'a group inside a chosen whole area changes nothing: the area choice stands')
  s = g.removeWant(g.toggleWantPlace(g.toggleWantRegion(g.ANYWHERE, 'shetland_north'), 'lerwick'), 'shetland_north')
  assert.deepEqual(s.regionIds, [])
  assert.deepEqual(s.placeIds, ['lerwick'])
})
test('home reducers: community implies its region; broad is the default; changing region drops a foreign community', () => {
  let h = { regionId: '', placeId: '' }
  h = g.chooseHomePlace(h, 'scalloway')
  assert.deepEqual(h, { regionId: 'shetland_central', placeId: 'scalloway' })
  assert.deepEqual(g.chooseHomePlace(h, 'scalloway'), { regionId: 'shetland_central', placeId: '' })
  assert.deepEqual(g.chooseHomeRegion(h, 'shetland_central'), h)
  assert.deepEqual(g.chooseHomeRegion(h, 'shetland_north'), { regionId: 'shetland_north', placeId: '' })
  assert.deepEqual(g.keepHomeBroad(h), { regionId: 'shetland_central', placeId: '' })
})

const good = { ...hs.EMPTY_ADVERT, have_area_id: 'shetland_central', have_bedrooms: 2, have_type: 'flat', acknowledged: true }
test('advert payload carries the two new fields and normalises wants', () => {
  const p = hs.advertPayload({ ...good, have_place_id: 'scalloway', anywhere: false, want_area_ids: ['shetland_north'], want_place_ids: ['voe', 'lerwick'] })
  assert.equal(p.have_place_id, 'scalloway')
  assert.deepEqual(p.want_area_ids, ['shetland_north'])
  assert.deepEqual(p.want_place_ids, ['lerwick'])
  const q = hs.advertPayload({ ...good, anywhere: true, want_area_ids: ['shetland_north'], want_place_ids: ['lerwick'] })
  assert.deepEqual([q.want_area_ids, q.want_place_ids, q.have_place_id], [[], [], null])
})
test('several whole areas and several communities, and nothing is ever removed by a tap meant to add (Darren, 13 Nov)', () => {
  let s = g.toggleWantRegion(g.ANYWHERE, 'shetland_west')
  s = g.toggleWantRegion(s, 'shetland_central')
  s = g.toggleWantRegion(s, 'shetland_north')
  assert.deepEqual(s.regionIds.sort(), ['shetland_central', 'shetland_north', 'shetland_west'], 'three whole areas at once')
  assert.equal(g.wantCount(s), 3)
  // A community inside one of them is refused, and takes nothing away.
  const after = g.toggleWantPlace(s, 'scalloway')
  assert.deepEqual(after, s, 'the tap changes nothing at all')
  assert.ok(g.coveredAlready(s, 'scalloway'))
  // Remove one whole area explicitly; the other two stay.
  s = g.removeWant(s, 'shetland_central')
  assert.deepEqual(s.regionIds.sort(), ['shetland_north', 'shetland_west'])
  // Now its communities can be chosen, several of them, alongside the whole areas.
  s = g.toggleWantPlace(s, 'scalloway')
  s = g.toggleWantPlace(s, 'tingwall')
  s = g.toggleWantPlace(s, 'whiteness')
  assert.deepEqual(s.placeIds.sort(), ['scalloway', 'tingwall', 'whiteness'])
  assert.deepEqual(s.regionIds.sort(), ['shetland_north', 'shetland_west'], 'the whole areas are untouched by adding communities')
  assert.equal(g.wantCount(s), 5)
  // Removing one community leaves every other choice alone.
  s = g.removeWant(s, 'tingwall')
  assert.deepEqual(s.placeIds.sort(), ['scalloway', 'whiteness'])
  assert.deepEqual(s.regionIds.sort(), ['shetland_north', 'shetland_west'])
  // Choosing a whole area that covers chosen communities absorbs them, and the screen is told which.
  const covered = g.coveredBy(s, 'shetland_central')
  assert.deepEqual(covered.sort(), ['scalloway', 'whiteness'])
  s = g.toggleWantRegion(s, 'shetland_central')
  assert.deepEqual(s.regionIds.sort(), ['shetland_central', 'shetland_north', 'shetland_west'])
  assert.deepEqual(s.placeIds, [], 'they are covered by the whole area, which asks for more places, not fewer')
})

test('the advert payload saves every chosen destination, and reopening keeps them all', () => {
  let s = g.toggleWantRegion(g.ANYWHERE, 'shetland_west')
  s = g.toggleWantRegion(s, 'shetland_north')
  s = g.toggleWantPlace(s, 'scalloway')
  s = g.toggleWantPlace(s, 'tingwall')
  const payload = hs.advertPayload({ ...good, anywhere: false, want_area_ids: s.regionIds, want_place_ids: s.placeIds })
  assert.deepEqual([...payload.want_area_ids].sort(), ['shetland_north', 'shetland_west'])
  assert.deepEqual([...payload.want_place_ids].sort(), ['scalloway', 'tingwall'])
  const reopened = hs.advertFromListing({
    have_area_id: 'shetland_central', have_place_id: null, have_bedrooms: 2, have_type: 'flat', have_features: [], landlord_type: null,
    headline: null, description: null, want_area_ids: payload.want_area_ids, want_place_ids: payload.want_place_ids,
    want_min_bedrooms: null, want_max_bedrooms: null, want_types: [], want_features: [], want_notes: null,
  })
  assert.deepEqual([...reopened.want_area_ids].sort(), ['shetland_north', 'shetland_west'])
  assert.deepEqual([...reopened.want_place_ids].sort(), ['scalloway', 'tingwall'])
  assert.equal(reopened.anywhere, false)
})

test('validation: place must belong to the region; communities alone satisfy the wants rule', () => {
  assert.ok(hs.validateAdvert({ ...good, have_place_id: 'voe' }).errors.have_area_id)
  assert.ok(hs.validateAdvert({ ...good, have_place_id: 'scalloway' }).ok)
  assert.ok(hs.validateAdvert({ ...good, anywhere: false, want_place_ids: ['voe'] }).ok)
  assert.ok(hs.validateAdvert({ ...good, anywhere: false }).errors.want_area_ids)
})
test('advertFromListing: old broad-region adverts open with a region and no community; communities prefill', () => {
  const old = { headline: null, description: null, have_area_id: 'shetland_central', have_bedrooms: 2, have_type: 'flat', have_features: [], landlord_type: null, want_area_ids: ['shetland_north'], want_min_bedrooms: null, want_max_bedrooms: null, want_types: [], want_features: [], want_notes: null }
  const f = hs.advertFromListing(old)
  assert.equal(f.have_place_id, ''); assert.deepEqual(f.want_place_ids, []); assert.equal(f.anywhere, false)
  const f2 = hs.advertFromListing({ ...old, have_place_id: 'scalloway', want_area_ids: [], want_place_ids: ['voe'] })
  assert.equal(f2.have_place_id, 'scalloway'); assert.deepEqual(f2.want_place_ids, ['voe']); assert.equal(f2.anywhere, false)
  assert.equal(hs.advertFromListing({ ...old, want_area_ids: [] }).anywhere, true)
})
test('display helpers: community, region, wants', () => {
  assert.equal(hs.homeLocationText({ have_area_id: 'shetland_central', have_area_name: 'Central Mainland', have_place_id: 'scalloway', have_place_name: 'Scalloway' }), 'Scalloway, Central Mainland')
  assert.equal(hs.homeLocationText({ have_area_name: 'Central Mainland', have_place_name: 'Scalloway' }), 'Scalloway, Central Mainland')
  assert.equal(hs.homeLocationText({ have_area_id: 'shetland_central', have_area_name: 'Central Mainland' }), 'Central Mainland')
  assert.equal(hs.wantsText({ want_area_ids: [], want_place_ids: [] }), 'Anywhere in Shetland')
  assert.equal(hs.wantsText({ want_area_names: ['Central Mainland'] }), 'Central Mainland')
  assert.equal(hs.wantsText({ want_area_ids: ['shetland_north'], want_place_ids: ['scalloway'] }), 'North Mainland and Scalloway')
  assert.equal(hs.displayHeadline({ headline: null, have_bedrooms: 2, have_type: 'flat', have_area_name: 'Central Mainland', have_place_name: 'Scalloway' }), '2-bedroom flat in Scalloway')
  assert.equal(hs.advertPreview({ ...good, have_place_id: 'scalloway' }).haveLine, '2 bedrooms · Flat · Scalloway, Central Mainland')
})
test('browse query: old URLs keep working; a community implies its region; want accepts regions and communities', () => {
  assert.deepEqual([hs.parseBrowseQuery({ area: 'shetland_north' }).area, hs.parseBrowseQuery({ area: 'shetland_north' }).place], ['shetland_north', null])
  const q = hs.parseBrowseQuery({ place: 'scalloway', area: 'shetland_north', want: 'voe' })
  assert.deepEqual([q.area, q.place, q.want], ['shetland_central', 'scalloway', 'voe'])
  assert.equal(hs.parseBrowseQuery({ place: 'bogus' }).place, null)
  assert.equal(hs.parseBrowseQuery({ want: 'bogus' }).want, null)
  assert.equal(hs.browseHref(q), '/house-swaps?place=scalloway&want=voe')
  assert.equal(hs.activeFilterCount(q), 2)
  assert.deepEqual(hs.activeFilterChips(q).map((c) => c.label), ['Home in Scalloway, Central Mainland', 'Looking to move to Voe, North Mainland'])
})

test('wizard: step validation is friendly and per step; server errors find the right step', () => {
  const e = hs.EMPTY_ADVERT
  assert.deepEqual(Object.keys(w.validateStep(1, e).errors).sort(), ['have_area_id', 'have_bedrooms', 'have_type'])
  assert.ok(w.validateStep(1, good).ok)
  assert.ok(w.validateStep(2, e).ok, 'step 2 is optional while anywhere is on')
  assert.ok(w.validateStep(2, { ...e, anywhere: false }).errors.want_area_ids)
  assert.deepEqual(Object.keys(w.validateStep(3, e).errors), ['acknowledged'])
  assert.ok(w.validateStep(3, { ...good, acknowledged: false, headline: 'call 01595 123456' }).errors.headline)
  assert.equal(w.firstStepWithError({ acknowledged: 'x', have_type: 'y' }), 1)
  assert.equal(w.firstStepWithError({ acknowledged: 'x' }), 3)
  assert.equal(w.firstStepWithError({}), null)
  assert.equal(w.clampStep(0), 1); assert.equal(w.clampStep(9), 3)
  assert.equal(w.WIZARD_STEPS.length, 3)
})
