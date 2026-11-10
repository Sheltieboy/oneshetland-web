import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { responsiveImage, IMAGE_WIDTHS, renditionName } from "../lib/editions/images.ts";

const U = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BASE = `http://127.0.0.1:54810/storage/v1/object/public/edition-media/org/cover/${U}`;

test("a photograph uploaded with renditions advertises every width", () => {
  const r = responsiveImage(`${BASE}-w1920.jpg`, "100vw");
  assert.equal(r.src, `${BASE}-w1920.jpg`); assert.equal(r.sizes, "100vw");
  for (const w of IMAGE_WIDTHS) assert.match(r.srcSet, new RegExp(`-w${w}\\.jpg ${w}w`));
});
test("anything else is returned unchanged with no srcset (so no rendition can 404)", () => {
  for (const u of [`${BASE}.jpg`, `${BASE}-w1920.png`, "https://upload.wikimedia.org/x/1280px-a.jpg", `${BASE}-w640.jpg`, "", "/local.jpg"]) {
    const r = responsiveImage(u); assert.deepEqual(r, { src: u });
  }
});
test("rendition names match what the uploader writes, and the hero, cards and journal use the helper", () => {
  assert.equal(renditionName(U, 640), `${U}-w640`);
  const up = readFileSync(new URL("../components/editions-manage/ImageUpload.tsx", import.meta.url), "utf8");
  assert.match(up, /\[640, 960, 1280\]/); assert.match(up, /renditionName\(uuid, 1920\)/); assert.deepEqual([...IMAGE_WIDTHS], [640, 960, 1280, 1920]);
  for (const f of ["editorial/Masthead.tsx", "EditionCard.tsx", "PartnerCard.tsx", "Journal.tsx", "UpdatesList.tsx"]) assert.match(readFileSync(new URL(`../components/editions/${f}`, import.meta.url), "utf8"), /responsiveImage\(/, f);
  assert.match(readFileSync(new URL("../components/editions/editorial/Masthead.tsx", import.meta.url), "utf8"), /fetchPriority="high"/);
});
