/**
 * product-gallery.test.mjs — photographs and videos in one product gallery.
 *
 * The thing worth testing hardest is the DERIVATION. products.photos is read in 46 places and
 * written by the mobile app and the product importer, neither of which knows about media. So the
 * gallery is derived from both, and it has to come out right after any write by any of them. These
 * tests are that rule, case by case, plus the promises the pages make.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  galleryFrom, readMedia, photosFromGallery, mediaFromGallery, moveItem, countKind,
  rejectUpload, durationLabel, isMediaItem, MEDIA_LIMITS,
} from "../lib/product-media.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/** The same file with comments stripped — for assertions about what the CODE does. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SQL = readFileSync(join(ROOT, "..", "oneshetland-be-edfinish",
  "supabase/migrations/20270319000000_product_gallery_video.sql"), "utf8");

const V = (url, poster, duration = null) => ({ kind: "video", url, poster, duration });
const I = (url) => ({ kind: "image", url });
const VID = "https://p.supabase.co/storage/v1/object/public/business-video/b/products/x.mp4";

describe("1. a product with only photographs is exactly as it was", () => {
  test("no media at all gives back the photographs, in order", () => {
    assert.deepEqual(galleryFrom([], ["a.jpg", "b.jpg"]), [
      { kind: "image", url: "a.jpg", still: "a.jpg" },
      { kind: "image", url: "b.jpg", still: "b.jpg" },
    ]);
  });
  test("and so does a null, an undefined or a nonsense media value", () => {
    for (const m of [null, undefined, {}, "[]", 7, [{ kind: "sideways" }], [null]]) {
      assert.deepEqual(galleryFrom(m, ["a.jpg"]).map((i) => i.url), ["a.jpg"], `broke on ${JSON.stringify(m)}`);
    }
  });
  test("no photographs and no media is an empty gallery, not a crash", () => {
    assert.deepEqual(galleryFrom(null, null), []);
    assert.deepEqual(galleryFrom([], []), []);
  });
  test("blank and whitespace photographs are dropped", () => {
    assert.deepEqual(galleryFrom([], ["a.jpg", "", "   ", null, 7, " b.jpg "]).map((i) => i.url), ["a.jpg", "b.jpg"]);
  });
});

describe("2. the derivation, after a write by something that does not know about media", () => {
  const media = [I("a.jpg"), V(VID, "poster.jpg", 12), I("b.jpg")];

  test("the seller's order is kept, videos and all", () => {
    assert.deepEqual(galleryFrom(media, ["a.jpg", "b.jpg"]).map((i) => `${i.kind}:${i.url}`),
      ["image:a.jpg", `video:${VID}`, "image:b.jpg"]);
  });
  test("a photograph DELETED in the mobile app disappears from the gallery", () => {
    assert.deepEqual(galleryFrom(media, ["b.jpg"]).map((i) => `${i.kind}:${i.url}`),
      [`video:${VID}`, "image:b.jpg"]);
  });
  test("a photograph ADDED by the importer or the app appears, at the end", () => {
    assert.deepEqual(galleryFrom(media, ["a.jpg", "b.jpg", "new.jpg"]).map((i) => i.url),
      ["a.jpg", VID, "b.jpg", "new.jpg"]);
  });
  test("a video SURVIVES an app edit, because the app never writes media", () => {
    assert.equal(countKind(galleryFrom(media, ["totally", "different"]), "video"), 1);
  });
  test("every photograph gone, video still there", () => {
    assert.deepEqual(galleryFrom(media, []).map((i) => i.kind), ["video"]);
  });
  test("an image is never duplicated, however the two lists overlap", () => {
    const g = galleryFrom([I("a.jpg"), I("a.jpg")], ["a.jpg"]);
    assert.equal(g.filter((i) => i.url === "a.jpg").length, 1);
  });
  test("a video's poster sitting in photos does NOT come back as a photograph too", () => {
    // photosFromGallery puts posters into photos for a video-only product; this is the other half.
    const g = galleryFrom([V(VID, "poster.jpg")], ["poster.jpg"]);
    assert.deepEqual(g.map((i) => i.kind), ["video"]);
    assert.equal(g[0].still, "poster.jpg");
  });
});

describe("3. a gallery always has something to show", () => {
  test("an image's still is itself", () => {
    assert.equal(galleryFrom([], ["a.jpg"])[0].still, "a.jpg");
  });
  test("a video's still is its poster", () => {
    assert.equal(galleryFrom([V(VID, "p.jpg")], [])[0].still, "p.jpg");
  });
  test("a video with no poster is refused by readMedia, so it can never reach the page", () => {
    assert.deepEqual(readMedia([{ kind: "video", url: VID }]), []);
    assert.deepEqual(readMedia([{ kind: "video", url: VID, poster: "  " }]), []);
    assert.equal(isMediaItem({ kind: "video", url: VID }), false);
    assert.equal(isMediaItem({ kind: "video", url: VID, poster: "p.jpg" }), true);
  });
});

describe("4. what gets saved back", () => {
  test("photos is the still images, in order", () => {
    const g = galleryFrom([I("a.jpg"), V(VID, "p.jpg"), I("b.jpg")], ["a.jpg", "b.jpg"]);
    assert.deepEqual(photosFromGallery(g), ["a.jpg", "b.jpg"]);
  });
  test("a VIDEO-ONLY gallery contributes its posters, so the product is not invisible everywhere else", () => {
    const g = galleryFrom([V(VID, "p.jpg")], []);
    assert.deepEqual(photosFromGallery(g), ["p.jpg"]);
  });
  test("media keeps the order, the poster and the duration", () => {
    const g = galleryFrom([V(VID, "p.jpg", 12), I("a.jpg")], ["a.jpg"]);
    assert.deepEqual(mediaFromGallery(g), [
      { kind: "video", url: VID, poster: "p.jpg", duration: 12 },
      { kind: "image", url: "a.jpg" },
    ]);
  });
  test("a round trip through save and load is stable", () => {
    const g1 = galleryFrom([I("a.jpg"), V(VID, "p.jpg", 9)], ["a.jpg"]);
    const g2 = galleryFrom(mediaFromGallery(g1), photosFromGallery(g1));
    assert.deepEqual(g2, g1);
  });
});

describe("5. reordering", () => {
  test("it moves one item and leaves the rest alone", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  });
  test("an out-of-range or no-op move changes nothing, and never throws", () => {
    for (const [f, t] of [[0, 0], [-1, 1], [5, 0], [0, 9]]) {
      assert.deepEqual(moveItem(["a", "b"], f, t), ["a", "b"], `${f}->${t}`);
    }
  });
  test("it does not mutate what it was given", () => {
    const src = ["a", "b"];
    moveItem(src, 0, 1);
    assert.deepEqual(src, ["a", "b"]);
  });
});

describe("6. what a seller may upload, and what they are told", () => {
  const img = (size) => ({ type: "image/jpeg", size });
  const vid = (size) => ({ type: "video/mp4", size });

  test("a sensible photograph and a sensible video are both fine", () => {
    assert.equal(rejectUpload(img(2e6), []), null);
    assert.equal(rejectUpload(vid(20e6), []), null);
  });
  test("an unsupported type is refused, naming what IS supported", () => {
    const m = rejectUpload({ type: "video/quicktime", size: 1e6 }, []);
    assert.match(m, /MP4/);
    assert.match(m, /JPEG, PNG or WebP/);
    assert.match(rejectUpload({ type: "application/pdf", size: 10 }, []), /not supported/);
  });
  test("an oversized video says how big it is and what the limit is", () => {
    const m = rejectUpload(vid(80e6), []);
    assert.match(m, /76\.3 MB|76 MB/);
    assert.match(m, /50 MB/);
    assert.match(m, /Trim it/);
  });
  test("an oversized photograph is refused separately, at the image limit", () => {
    assert.match(rejectUpload(img(12e6), []), /10 MB/);
    assert.equal(rejectUpload(img(9e6), []), null, "9 MB is under the image limit and must be allowed");
  });
  test("the per-kind counts are enforced, and say what to do", () => {
    const fiveImages = Array.from({ length: 5 }, (_, i) => ({ kind: "image", url: `${i}.jpg`, still: `${i}.jpg` }));
    assert.match(rejectUpload(img(1e6), fiveImages), /Up to 5 photographs/);
    assert.equal(rejectUpload(vid(1e6), fiveImages), null, "a video must still be allowed alongside five photographs");
    const twoVideos = [V("a", "p"), V("b", "p")].map((v) => ({ kind: "video", url: v.url, still: "p" }));
    assert.match(rejectUpload(vid(1e6), twoVideos), /Up to 2 videos/);
    assert.equal(rejectUpload(img(1e6), twoVideos), null);
  });
  test("and the whole-gallery limit is enforced last", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ kind: "image", url: `${i}.jpg`, still: `${i}.jpg` }));
    assert.match(rejectUpload(img(1e6), ten), /up to 10 items/i);
  });
  test("the limits here are the ones the database enforces", () => {
    assert.ok(SQL.includes(`jsonb_array_length(p_media) <= ${MEDIA_LIMITS.maxItems}`),
      "the gallery limit in MEDIA_LIMITS and the database CHECK disagree");
    assert.ok(SQL.includes(`= 'video') <= ${MEDIA_LIMITS.maxVideos}`),
      "the video limit in MEDIA_LIMITS and the database CHECK disagree");
    assert.match(SQL, new RegExp(String(MEDIA_LIMITS.maxVideoBytes)), "the bucket limit and MEDIA_LIMITS disagree");
  });
});

describe("7. the duration badge", () => {
  test("it reads as mm:ss", () => {
    assert.equal(durationLabel(9), "0:09");
    assert.equal(durationLabel(61), "1:01");
    assert.equal(durationLabel(600), "10:00");
  });
  test("and says nothing when we do not know", () => {
    for (const v of [null, undefined, 0, -3, NaN, Infinity, "12"]) assert.equal(durationLabel(v), null);
  });
});

describe("8. the promises the customer's gallery makes", () => {
  const g = read("components/shop/ProductGallery.tsx");

  test("no autoplay anywhere, and sound is the browser's own", () => {
    assert.doesNotMatch(g, /\bautoPlay\b/, "the gallery must never autoplay");
    // `muted` as an attribute, not the `text-ink-muted` design token.
    assert.doesNotMatch(g, /(?<![-\w])muted(?![-\w])/, "a muted autoplay is still autoplay; there should be neither");
    assert.match(g, /\bcontrols\b/, "a video must carry the browser's own controls, including volume");
  });
  test("a video is not downloaded until somebody picks it", () => {
    assert.match(g, /preload="none"/);
    assert.match(g, /poster=\{current\.still \|\| undefined\}/);
  });
  test("playsInline, so a phone plays it in the page rather than taking over the screen", () => {
    assert.match(g, /playsInline/);
  });
  test("changing item stops whatever was playing", () => {
    // This assertion used to be just "the file contains el.pause()" — and it PASSED while the
    // behaviour was broken, because the ref map was keyed by index and went stale on unmount, so
    // pause() was called on a detached element while the real one carried on with the sound. A
    // browser check caught it. These assertions pin the shape that actually works.
    assert.match(g, /const videoRef = useRef<HTMLVideoElement \| null>\(null\)/,
      "one ref, because only one item is on the stage; a map keyed by index goes stale on unmount");
    assert.doesNotMatch(g, /videoRefs/, "the stale ref-map pattern is back");
    // paused BEFORE the state change, while the element on screen is still the current one...
    const goFn = g.slice(g.indexOf("const go = useCallback"), g.indexOf("useEffect(() => {", g.indexOf("const go = useCallback")));
    assert.match(goFn, /el\.pause\(\)/, "leaving an item must pause it");
    assert.match(goFn, /el\.currentTime = 0/);
    assert.ok(goFn.indexOf("el.pause()") < goFn.indexOf("setActive"),
      "pause has to happen before the state change, or the element has already gone");
    // ...and again on cleanup, which covers unmounting the gallery altogether.
    assert.match(g, /return \(\) => \{ if \(el\) \{ el\.pause\(\); el\.currentTime = 0; \} \};/);
  });
  test("a video is obvious before you touch it", () => {
    assert.match(g, /▶/);
    assert.match(g, /Video — press play to watch, with sound\./);
  });
  test("it works by swipe, by arrow key and by thumbnail", () => {
    assert.match(g, /onTouchEnd/);
    assert.match(g, /ArrowRight/);
    assert.match(g, /ArrowLeft/);
    assert.match(g, /role="tablist"/);
    assert.match(g, /aria-selected=\{i === active\}/);
  });
  test("a sideways swipe only, so scrolling the page never changes the picture", () => {
    assert.match(g, /Math\.abs\(dx\) > 48/);
    assert.match(g, /Math\.abs\(dy\) \* 1\.5/);
  });
  test("one item needs no arrows, no counter and no thumbnails", () => {
    assert.match(g, /count > 1 && \(/);
  });
  test("the product page passes the derived gallery, not the raw photos", () => {
    const page = read("app/product/[id]/page.tsx");
    assert.match(page, /galleryFrom\(product\.media, product\.photos\)/);
    assert.doesNotMatch(page, /product\.photos\.slice/, "the old thumbnail strip is gone");
  });
});

describe("9. the seller's editor", () => {
  const m = read("components/business/ProductsManager.tsx");

  test("photographs and videos go through one handler and one list", () => {
    assert.match(m, /async function addMedia/);
    assert.match(m, /gallery: GalleryItem\[\]/);
    assert.doesNotMatch(m, /form\.photos/, "the form must no longer carry a separate photo list");
  });
  test("each file is judged against the gallery as it stands", () => {
    assert.match(m, /const no = rejectUpload\(f, gallery\)/);
    assert.match(m, /cannot sneak past a limit the first two already reached/);
  });
  test("saving writes BOTH fields, derived from the one order", () => {
    assert.match(m, /photos: photosFromGallery\(form\.gallery\)/);
    assert.match(m, /media: mediaFromGallery\(form\.gallery\)/);
  });
  test("reorder, remove and replace are all offered", () => {
    assert.match(m, /moveItem\(form\.gallery, i, i - 1\)/);
    assert.match(m, /moveItem\(form\.gallery, i, i \+ 1\)/);
    assert.match(m, /Remove this video/);
    assert.match(m, /Replace this video/);
  });
  test("a video is labelled in the editor too", () => {
    assert.match(m, /Video\{durationLabel/);
    assert.match(m, /Main/);
  });
  test("the file picker offers exactly what the buckets accept", () => {
    assert.match(m, /accept="image\/jpeg,image\/png,image\/webp,video\/mp4"/);
    assert.doesNotMatch(m, /accept="image\/\*"/, "image/* would offer HEIC and GIF, which the bucket refuses");
  });
  test("a gallery of only videos is allowed; an empty one is not", () => {
    assert.match(m, /A gallery of only videos is fine/);
    assert.match(m, /form\.gallery\.length === 0\) return setMsg/);
  });
});

describe("10. the upload path reuses what was already there", () => {
  const u = read("lib/product-video-upload.ts");
  const uc = code("lib/product-video-upload.ts");

  test("the seller's own JWT, straight to storage — no server route, no service key", () => {
    assert.match(u, /Authorization: `Bearer \$\{token\}`/);
    assert.doesNotMatch(uc, /SERVICE_ROLE|service_role/);
    assert.match(u, /storage\/v1\/object\/\$\{bucket\}\/\$\{path\}/);
  });
  test("the path convention is the existing one, so the bucket policies apply unchanged", () => {
    assert.match(u, /\$\{businessId\}\/products\//);
  });
  test("the poster is stored BEFORE the video, so a video can never be left without one", () => {
    assert.ok(u.indexOf("const poster = await putObject") < u.indexOf("const url = await putObject"));
    assert.match(u, /if the poster cannot be stored we never store the video either/);
  });
  test("the poster is a real frame, taken in the browser — no transcoding service", () => {
    assert.match(u, /canvas/);
    assert.match(u, /drawImage/);
    assert.doesNotMatch(uc, /ffmpeg|mux|cloudinary|mediaconvert/i);
  });
  test("a video we cannot read is refused with something a seller can act on", () => {
    assert.match(u, /export it as an MP4 \(H\.264\)/);
  });
  test("the bucket's own refusals are turned into plain words", () => {
    for (const code of ["413", "415", "403"]) assert.match(u, new RegExp(`status === ${code}`));
    assert.match(u, /too big for the gallery/);
  });
});

describe("11. the migration keeps the promises this feature makes", () => {
  test("media is additive, defaults to empty, and nothing existing is touched", () => {
    assert.match(SQL, /add column if not exists media jsonb not null default '\[\]'::jsonb/);
    assert.match(SQL, /this migration put media on % product\(s\): refusing to commit/);
    assert.doesNotMatch(SQL, /alter table public\.products[\s\S]{0,80}drop column photos/);
  });
  test("a video must be OUR file — no external video service, enforced in the database", () => {
    assert.match(SQL, /storage\/v1\/object\/public\/business-video\//);
    assert.match(SQL, /a video hosted somewhere else was accepted: refusing to commit/);
  });
  test("every video must have a poster", () => {
    assert.match(SQL, /kind'\s*=\s*'video' and coalesce\(btrim\(e\.value->>'poster'\), ''\) = ''/);
  });
  test("the image bucket is left exactly as it was", () => {
    assert.match(SQL, /business-media was altered: refusing to commit/);
    assert.match(SQL, /file_size_limit = 10485760/);
  });
  test("the video bucket is mp4-only and has the same four policies as the image bucket", () => {
    assert.match(SQL, /allowed_mime_types = array\['video\/mp4'\]/);
    assert.match(SQL, /has % policies, expected 4: refusing to commit/);
    for (const c of ["public read", "owner write", "owner update", "owner delete"]) {
      assert.ok(SQL.includes(`"business-video ${c}"`), `the ${c} policy is missing`);
    }
  });
  test("only the business owner may write there", () => {
    assert.match(SQL, /b\.owner_id = auth\.uid\(\)/);
    assert.match(SQL, /split_part\(storage\.objects\.name, '\/', 1\)/);
  });
});
