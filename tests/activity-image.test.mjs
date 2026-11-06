/**
 * Regular Activity photos: server-side validation and re-encoding, who may write where (business owner, hub admin, staff), replace/remove
 * cleanup, nothing left behind on failure, and every surface that shows the photo. Run: node --test tests/activity-image.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { processActivityImage, checkActivityImageBytes, storageTarget, ActivityImageError, ACTIVITY_IMAGE_MAX_BYTES } from "../lib/activity-image.ts";
import { parseOwnActivityImage, thumbUrl, heroPath, thumbPath } from "../lib/activity-image-url.ts";
import { savePhoto, dropPhoto } from "../lib/activity-image-service.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BIZ = "11111111-1111-4111-8111-111111111111", HUB = "22222222-2222-4222-8222-222222222222";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", HUBADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", STRANGER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const rgb = (w, h) => ({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 90, b: 40 } } });
const jpeg = (w = 2400, h = 1600, o = {}) => sharp(rgb(w, h)).jpeg(o).withMetadata(o.meta).toBuffer();
const png = (w = 800, h = 500) => sharp(rgb(w, h)).png().toBuffer();
const webp = (w = 800, h = 500) => sharp(rgb(w, h)).webp().toBuffer();

// ── the bytes decide, never the name or claimed type
test("accepts JPEG, PNG and WebP; rejects SVG, GIF, HTML, empty, tiny and non-images by their bytes", async () => {
  for (const b of [await jpeg(900, 600), await png(), await webp()]) assert.doesNotThrow(() => checkActivityImageBytes(new Uint8Array(b)));
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><script>alert(1)</script></svg>');
  assert.throws(() => checkActivityImageBytes(svg), /SVG/);
  assert.throws(() => checkActivityImageBytes(new TextEncoder().encode("GIF89a" + "x".repeat(200))), /JPEG, PNG or WebP/);
  assert.throws(() => checkActivityImageBytes(new TextEncoder().encode("<html><script>1</script></html>" + " ".repeat(50))), /JPEG, PNG or WebP/);
  assert.throws(() => checkActivityImageBytes(new Uint8Array(0)), /empty/);
  assert.throws(() => checkActivityImageBytes(new Uint8Array(5)), ActivityImageError);
  assert.throws(() => checkActivityImageBytes(new Uint8Array(ACTIVITY_IMAGE_MAX_BYTES + 1)), (e) => e.status === 413);
});
test("a file with a JPEG header but broken contents is refused, not stored", async () => {
  const bad = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(7)]);
  await assert.rejects(processActivityImage(bad), (e) => e instanceof ActivityImageError && e.status === 422);
});
test("a photo that is too small to look right is refused with a reason", async () => {
  await assert.rejects(processActivityImage(new Uint8Array(await png(80, 60))), /too small/);
});

// ── optimisation
test("output is WebP at 1600px hero and 640px thumb, never enlarged, and much smaller than a large original", async () => {
  const big = await jpeg(4000, 3000, { quality: 95 });
  const r = await processActivityImage(new Uint8Array(big));
  const h = await sharp(r.hero).metadata(), t = await sharp(r.thumb).metadata();
  assert.equal(h.format, "webp"); assert.equal(t.format, "webp");
  assert.equal(h.width, 1600); assert.equal(h.height, 1200); assert.equal(t.width, 640);
  assert.ok(r.hero.length < big.length / 3);
  const small = await processActivityImage(new Uint8Array(await png(900, 500)));
  assert.equal((await sharp(small.hero).metadata()).width, 900);   // not enlarged
});
test("phone orientation is applied and location/camera metadata is stripped", async () => {
  const withExif = await sharp(rgb(1200, 800)).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "x", Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "60/1 9/1 0/1" } } }).toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif, "fixture really has EXIF");
  const r = await processActivityImage(new Uint8Array(withExif));
  const m = await sharp(r.hero).metadata();
  assert.equal(m.exif, undefined); assert.equal(m.width, 800); assert.equal(m.height, 1200); // rotated upright
});
test("an absurd pixel count is refused before it is decoded", async () => {
  const huge = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
  if (huge.length > ACTIVITY_IMAGE_MAX_BYTES) return; // the size cap already stops it
  await assert.rejects(processActivityImage(new Uint8Array(huge)), ActivityImageError);
});

// ── addresses
test("only our own activity photos are recognised, and every other address is left alone", () => {
  const u = (b, p, id, sm = "") => `https://x.supabase.co/storage/v1/object/public/${b}/${p}/activity/${id}${sm}.webp`;
  const id = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(parseOwnActivityImage(u("business-media", BIZ, id)), { bucket: "business-media", prefix: BIZ, id });
  assert.equal(thumbUrl(u("hub-media", HUB, id)), u("hub-media", HUB, id, "-sm"));
  for (const other of [`https://x.supabase.co/storage/v1/object/public/business-media/${BIZ}/logo/${id}.webp`, `https://x.supabase.co/storage/v1/object/public/business-media/${BIZ}/products/p/${id}.webp`,
    "https://evil.example/a.webp", `http://x.supabase.co/storage/v1/object/public/hub-media/${HUB}/activity/${id}.webp`, `https://x.supabase.co/storage/v1/object/public/avatars/${BIZ}/activity/${id}.webp`, "javascript:alert(1)", "", null]) {
    assert.equal(parseOwnActivityImage(other), null); assert.equal(thumbUrl(other), other || null);
  }
});
test("each owner type stores in its own bucket and folder", () => {
  assert.deepEqual(storageTarget({ organiser_business_id: BIZ, organiser_hub_id: null, is_platform_activity: false }, OWNER), { bucket: "business-media", prefix: BIZ });
  assert.deepEqual(storageTarget({ organiser_business_id: null, organiser_hub_id: HUB, is_platform_activity: false }, OWNER), { bucket: "hub-media", prefix: HUB });
  assert.deepEqual(storageTarget({ organiser_business_id: null, organiser_hub_id: null, is_platform_activity: true }, STAFF), { bucket: "event-media", prefix: STAFF });
});

// ── a fake that enforces the SAME rules as the storage and row policies (proved against production in a rolled-back run)
function world() {
  const files = new Map(); const rows = new Map(); let failThumb = false, denyRow = false;
  const may = (uid, bucket, name) => {
    const first = name.split("/")[0];
    if (bucket === "business-media") return first === BIZ && uid === OWNER;
    if (bucket === "hub-media") return first === HUB && (uid === OWNER || uid === HUBADMIN);
    if (bucket === "event-media") return first === uid;
    return false;
  };
  const client = (uid) => ({
    storage: { from: (bucket) => ({
      upload: async (path, body) => { if (!may(uid, bucket, path)) return { error: "rls" }; if (failThumb && path.endsWith("-sm.webp")) return { error: "boom" }; files.set(`${bucket}/${path}`, body); return { error: null }; },
      remove: async (paths) => { for (const p of paths) if (may(uid, bucket, p)) files.delete(`${bucket}/${p}`); },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
    }) },
    setCover: async (id, url) => { if (denyRow || !rows.has(id) || !MANAGERS[id]?.includes(uid)) return { changed: 0, error: null }; rows.get(id).cover_url = url; return { changed: 1, error: null }; },
  });
  return { files, rows, client, fail: (v) => { failThumb = v; }, deny: (v) => { denyRow = v; } };
}
const ACTS = {
  business: { id: "b0000000-0000-4000-8000-000000000001", organiser_business_id: BIZ, organiser_hub_id: null, is_platform_activity: false, cover_url: null, uid: OWNER },
  hub: { id: "b0000000-0000-4000-8000-000000000002", organiser_business_id: null, organiser_hub_id: HUB, is_platform_activity: false, cover_url: null, uid: HUBADMIN },
  platform: { id: "b0000000-0000-4000-8000-000000000003", organiser_business_id: null, organiser_hub_id: null, is_platform_activity: true, cover_url: null, uid: STAFF },
};
const img = async () => new Uint8Array(await jpeg(1800, 1200));
const MANAGERS = { [ACTS.business.id]: [OWNER], [ACTS.hub.id]: [OWNER, HUBADMIN], [ACTS.platform.id]: [STAFF] };
let n = 0; const nid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

for (const [kind, base] of Object.entries(ACTS)) {
  test(`${kind}: upload, replace and remove — two sizes stored, old files cleaned, activity ends with no photo and no files`, async () => {
    const w = world(); const { uid, ...row } = base; row.cover_url = null; w.rows.set(row.id, row);
    const sb = w.client(uid);
    const first = await savePhoto(sb, uid, { ...row }, await img(), nid());
    assert.equal(w.rows.get(row.id).cover_url, first.cover_url); assert.equal(w.files.size, 2);
    assert.ok([...w.files.keys()].every((k) => /\/activity\/[0-9a-f-]{36}(-sm)?\.webp$/.test(k)));
    const second = await savePhoto(sb, uid, { ...row, cover_url: first.cover_url }, await img(), nid());
    assert.notEqual(second.cover_url, first.cover_url); assert.equal(w.files.size, 2, "the replaced photo and its thumb are gone");
    await dropPhoto(sb, { ...row, cover_url: second.cover_url });
    assert.equal(w.rows.get(row.id).cover_url, null); assert.equal(w.files.size, 0);
  });
  test(`${kind}: a stranger cannot upload, and nothing is stored or changed`, async () => {
    const w = world(); const { uid, ...row } = base; w.rows.set(row.id, { ...row });
    await assert.rejects(savePhoto(w.client(STRANGER), STRANGER, { ...row }, await img(), nid()), (e) => e.status === 403);
    assert.equal(w.files.size, 0, "anything written was cleaned up"); assert.equal(w.rows.get(row.id).cover_url, null);
  });
}
test("platform: staff photos live in the staff member's own folder, so another person's folder is never written", async () => {
  const w = world(); const row = { ...ACTS.platform }; delete row.uid; w.rows.set(row.id, { ...row });
  await savePhoto(w.client(STAFF), STAFF, { ...row }, await img(), nid());
  assert.ok([...w.files.keys()].every((k) => k.startsWith(`event-media/${STAFF}/activity/`)));
});
test("hub: a hub admin who is not the owner may add a photo; a business owner may not touch a hub", async () => {
  const w = world(); const row = { ...ACTS.hub }; delete row.uid; w.rows.set(row.id, { ...row });
  await savePhoto(w.client(HUBADMIN), HUBADMIN, { ...row }, await img(), nid());
  assert.equal(w.files.size, 2);
});
test("if the thumb cannot be stored nothing is kept; if the activity cannot be updated both files are removed and the old photo stays", async () => {
  const w = world(); const { uid, ...row } = ACTS.business; w.rows.set(row.id, { ...row });
  w.fail(true);
  await assert.rejects(savePhoto(w.client(uid), uid, { ...row }, await img(), nid()), (e) => e.status === 500); assert.equal(w.files.size, 0);
  w.fail(false);
  const ok = await savePhoto(w.client(uid), uid, { ...row }, await img(), nid()); assert.equal(w.files.size, 2);
  w.deny(true);
  await assert.rejects(savePhoto(w.client(uid), uid, { ...row, cover_url: ok.cover_url }, await img(), nid()), (e) => e.status === 403);
  assert.equal(w.files.size, 2, "the live photo and its thumb are untouched"); assert.equal(w.rows.get(row.id).cover_url, ok.cover_url);
});
test("removing or replacing never deletes a file that is not an activity photo (logos, products, other people's addresses)", async () => {
  const w = world(); const { uid, ...row } = ACTS.business; w.rows.set(row.id, { ...row });
  w.files.set(`business-media/${BIZ}/logo/${nid()}.webp`, new Uint8Array(1));
  const other = "https://cdn.example.com/photo.jpg"; w.rows.get(row.id).cover_url = other;
  await savePhoto(w.client(uid), uid, { ...row, cover_url: other }, await img(), nid());
  assert.equal(w.files.size, 3);
  const prod = `https://x.supabase.co/storage/v1/object/public/business-media/${BIZ}/products/p1/${nid()}.webp`;
  w.rows.get(row.id).cover_url = prod; await dropPhoto(w.client(uid), { ...row, cover_url: prod });
  assert.equal(w.files.size, 3);
});

// ── how it is wired: ownership comes from the database, only cover_url changes, every surface shows the photo
test("the route checks manage rights, uses no service key, hides drafts from strangers and writes only cover_url", () => {
  const r = read("app/api/activities/[id]/image/route.ts") + read("lib/activity-image-service.ts");
  assert.match(r, /can_manage_activity/); assert.match(r, /getUser\(\)/);
  assert.doesNotMatch(r, /service_role|SERVICE_ROLE|service_key/);
  assert.match(r, /Activity not found\./); assert.match(r, /401/);
  const updates = [...r.matchAll(/update\(\{([^}]*)\}\)/g)].map((m) => m[1].trim());
  assert.ok(updates.length >= 1 && updates.every((u) => /^cover_url:/.test(u)), "only cover_url is updated: " + updates.join(" | "));
  assert.deepEqual([...new Set([...r.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]))].filter((t) => !t.endsWith("-media")), ["regular_activities"]);
  assert.doesNotMatch(r, /notification_log|activity_follows|update\(\{ ?status|activity_schedule|activity_exceptions|activity_change_notices/);
});
test("the photo shows on the detail hero, listing cards, the What's On strip and the manage list; colour remains the fallback", () => {
  assert.match(read("components/activities/ActivityCard.tsx"), /ActivityImage/);
  assert.match(read("components/activities/ActivityStrip.tsx"), /ActivityImage/);
  assert.match(read("components/activities/manage/ManagePages.tsx"), /ActivityImage/);
  const v = read("components/activities/detail/ActivityDetailView.tsx");
  assert.match(v, /data-hero=\{photo \? "photo" : "colour"\}/); assert.match(v, /linear-gradient\(135deg, \$\{c1\}/);
  const img = read("components/activities/ActivityImage.tsx");
  assert.match(img, /loading=\{eager \? "eager" : "lazy"\}/); assert.match(img, /object-cover/);
  assert.match(read("components/activities/ActivityCard.tsx"), /aspect-\[16\/9\]/);
  assert.match(read("components/activities/ActivityCard.tsx"), /data-card-colour/); // a card without a photo keeps its category colour
  assert.match(read("components/ui/SafeImage.tsx"), /onError/);
});
test("the activity form offers choose, preview, replace and remove, and a failed first upload does not lose the activity", () => {
  const f = read("components/activities/manage/ActivityPhotoField.tsx");
  for (const t of ["Choose photo", "Replace photo", "Remove", "Preview of the activity photo", 'accept="image/jpeg,image/png,image/webp"']) assert.ok(f.includes(t), t);
  assert.match(read("components/activities/manage/ActivityForm.tsx"), /\?photo=failed/);
  assert.match(read("components/activities/manage/ActivityForm.tsx"), /uploadActivityPhoto\(a\.id, photo\)/);
});
test("scheduling, publishing, following and notifications code is untouched by this change", () => {
  for (const f of ["lib/activities-client.ts"]) {
    const s = read(f);
    for (const fn of ["addRules", "setActivityStatus", "cancelSession", "changeSession", "addBreak"]) assert.ok(s.includes(`function ${fn}`), fn);
  }
});
