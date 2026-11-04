import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { noticeShareImage, noticeMetadata, NOTICE_SHARE_IMAGE } from "../lib/notice-share-image.ts";

const CATS = { travel_transport: "travel", health: "health", public_services: "council", consultations_funding: "consultations", community: "community", schools_education: "community", appeals_volunteering: "community", lost_found: "community", other: "community" };

test("every category maps to its image, everything else to Community", () => {
  for (const [c, f] of Object.entries(CATS)) assert.equal(noticeShareImage(c), `/social/notices/notice-${f}.jpg`, c);
  for (const c of [null, undefined, "", "weird"]) assert.equal(noticeShareImage(c), "/social/notices/notice-community.jpg");
});
test("every mapped image file exists in public/", () => {
  for (const f of new Set([...Object.values(NOTICE_SHARE_IMAGE), "community"])) assert.ok(existsSync(new URL(`../public/social/notices/notice-${f}.jpg`, import.meta.url)), f);
});
test("notice metadata: og:url and canonical are the notice, image is the category card, title/description are the notice's own", () => {
  const m = noticeMetadata({ id: "abc", title: "NHS Shetland announces winter vaccination clinics", body: "Clinics run from Monday.", categoryId: "health" });
  assert.equal(m.openGraph.url, "/notices/abc");
  assert.equal(m.alternates.canonical, "/notices/abc");
  assert.deepEqual(m.openGraph.images[0], { url: "/social/notices/notice-health.jpg", width: 1200, height: 630, alt: "OneShetland notice" });
  assert.equal(m.openGraph.title, "NHS Shetland announces winter vaccination clinics");
  assert.equal(m.twitter.card, "summary_large_image");
});
test("long titles/bodies are clipped, not broken", () => {
  const m = noticeMetadata({ id: "x", title: "word ".repeat(60), body: "text ".repeat(200), categoryId: null });
  assert.ok(m.title.length <= 90 && m.description.length <= 200);
});
test("the notice page wires generateMetadata through noticeMetadata", () => {
  const src = readFileSync(new URL("../app/notices/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(src, /generateMetadata/); assert.match(src, /noticeMetadata\(/);
});
