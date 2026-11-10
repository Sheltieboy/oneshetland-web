/**
 * The site's three typefaces are self-hosted (SIL OFL 1.1), so a production build never downloads fonts. A Netlify build failed on 10 Nov 2026 inside Next's Turbopack
 * Google Fonts loader ("next/font/google queries must have exactly one entry"); these tests keep the build independent of Google Fonts and the licences in place.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const bytes = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const tracked = execSync("git ls-files -- app components lib", { cwd: new URL("..", import.meta.url), encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx)$/.test(f));

describe("no code path downloads fonts at build time", () => {
  test("next/font/google is not used anywhere in app, components or lib", () => {
    const offenders = tracked.filter((f) => existsSync(new URL(`../${f}`, import.meta.url)) && /next\/font\/google/.test(read(f)));
    assert.deepEqual(offenders, []);
  });
  test("the root layout and the Edition display face use next/font/local with the committed files", () => {
    const layout = read("app/layout.tsx"), ed = read("lib/editions/fonts.ts");
    assert.match(layout, /from "next\/font\/local"/); assert.match(ed, /from "next\/font\/local"/);
    for (const w of ["400", "500", "600", "700", "900"]) for (const s of ["normal", "italic"]) assert.match(layout, new RegExp(`Fraunces-latin-${s}\\.woff2", weight: "${w}", style: "${s}"`), `Fraunces ${w} ${s}`);
    assert.match(layout, /Inter-latin-variable\.woff2", weight: "100 900"/);
    assert.match(layout, /variable: "--font-fraunces"/); assert.match(layout, /variable: "--font-inter"/);
    assert.match(ed, /variable: "--font-ed-display"/); assert.match(ed, /InstrumentSerif-latin-normal\.woff2/); assert.match(ed, /InstrumentSerif-latin-italic\.woff2/);
    assert.match(layout, /display: "swap"/); assert.match(ed, /display: "swap"/);
  });
});

describe("the font files are real woff2 files, unchanged from the ones the site already served, with their licences", () => {
  // sha-256 of the files fetched from fonts.gstatic.com on 10 Nov 2026 (the same bytes the live site serves: the build's content hashes match the live preloads).
  const files = {
    "app/fonts/Fraunces-latin-normal.woff2": "88e17be075f1be50", "app/fonts/Fraunces-latin-italic.woff2": "c9745ee907c02cdd", "app/fonts/Inter-latin-variable.woff2": "c940764593d0fe5d",
    "app/fonts/InstrumentSerif-latin-normal.woff2": "60c06664b5a95c7d", "app/fonts/InstrumentSerif-latin-italic.woff2": "6ee678c33f388dd7",
  };
  for (const [f, sha] of Object.entries(files)) {
    test(f, () => {
      const b = bytes(f);
      assert.equal(b.subarray(0, 4).toString("latin1"), "wOF2", "a woff2 file");
      assert.ok(statSync(new URL(`../${f}`, import.meta.url)).size > 10000);
      assert.equal(createHash("sha256").update(b).digest("hex").slice(0, 16), sha);
    });
  }
  test("each family ships its SIL Open Font License, and FONTS.md says where the files came from", () => {
    for (const [f, holder] of [["OFL-fraunces.txt", /Fraunces Project Authors/], ["OFL-inter.txt", /Inter Project Authors/], ["OFL-instrumentserif.txt", /Instrument Serif Project Authors/]]) {
      const t = read(`app/fonts/${f}`); assert.match(t, holder); assert.match(t, /SIL OPEN FONT LICENSE Version 1\.1/);
    }
    const md = read("app/fonts/FONTS.md"); assert.match(md, /Fraunces/); assert.match(md, /Inter/); assert.match(md, /Instrument Serif/); assert.match(md, /SIL Open Font License 1\.1/);
  });
});
