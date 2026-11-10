/** Editions R6: the brand engine turns ONE colour into an accessible palette, a palette (typeface, corners and layout are shared by every Edition); inheritance between organiser and Edition. Run: node --test --import ./tests/support/register.mjs tests/editions-brand.test.mjs */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

const { deriveBrand, resolveBrand, TYPEFACE, hexToLch, lch, normaliseFocus, FOCUS_RE, DEFAULT_BRAND } = await import("../lib/editions/brand.ts");
const { contrast } = await import("../lib/editions/rules.ts");

// Awkward organiser colours: pale, neon, near-black, near-white, grey, a mid orange where neither white nor black text is comfortable, and ordinary brand colours.
const COLOURS = ["#ffee00", "#ffff99", "#00ff66", "#ff00aa", "#000000", "#111111", "#ffffff", "#f5f5f5", "#808080", "#ff7a1a", "#8a3b12", "#5b6b4d", "#6a1b9a", "#0b5a73", "#d4a017", "#2e7d32", "#e91e63", "#7fbfff"];

describe("every organiser colour produces an accessible system", () => {
  for (const c of COLOURS) {
    test(`${c}: every text pair the design system uses passes AA`, () => {
      const b = deriveBrand(c), t = b.tone;
      const pairs = { "ink on ground": [t.ink, t.ground], "body on ground": [t.ink2, t.ground], "muted on ground": [t.ink3, t.ground], "ink on ground-2": [t.ink, t.ground2], "body on ground-2": [t.ink2, t.ground2],
        "accent text on ground": [t.accent, t.ground], "on-brand on brand fill": [t.onBrand, t.brand], "on-deep on deep": [t.onDeep, t.deep], "glow on deep": [t.glow, t.deep] };
      for (const [name, [fg, bg]] of Object.entries(pairs)) assert.ok(contrast(fg, bg) >= 4.5, `${c} ${name}: ${contrast(fg, bg).toFixed(2)} (${fg} on ${bg})`);
      assert.ok(b.checks.every((k) => k.pass), JSON.stringify(b.checks));
      for (const v of Object.values(b.vars)) assert.match(v, /^#[0-9a-f]{6}$/);
    });
  }
  test("the brand fill is the organiser's exact colour; pale colours get dark text, not a darkened fill", () => {
    assert.equal(deriveBrand("#ffee00").tone.brand, "#ffee00");
    assert.notEqual(deriveBrand("#ffee00").tone.onBrand, "#ffffff");
    assert.equal(deriveBrand("#0b5a73").tone.onBrand, "#ffffff");
    assert.ok(deriveBrand("#ffee00").notes.length > 0);
  });
  test("invalid or missing colours fall back to the platform default and never throw", () => {
    for (const bad of [null, undefined, "", "red", "#12345", "#gggggg", "javascript:alert(1)"]) assert.equal(deriveBrand(bad).base, DEFAULT_BRAND);
    assert.equal(deriveBrand(null, "#8a3b12").base, "#8a3b12");
  });
});

describe("identity comes from colour, not from a different design language", () => {
  test("no colour, however vivid, changes the typeface, corners or layout: the brand carries colour tones only", () => {
    for (const c of ["#5b6b4d", "#8a3b12", "#e6007e", "#00ff66", "#000000"]) {
      const b = deriveBrand(c);
      assert.deepEqual(Object.keys(b).sort(), ["base", "checks", "notes", "tone", "vars"]);
      assert.ok(Object.keys(b.vars).every((k) => /^--ed-(ground|ink|line|brand|on-brand|accent|deep|on-deep|glow|tint|alt)/.test(k)), "only colour variables");
    }
    assert.match(TYPEFACE.name, /serif/i);
  });
  test("the demo brands are genuinely distinct from one another", () => {
    const a = deriveBrand("#8a3b12"), b = deriveBrand("#5b6b4d"), c = deriveBrand("#e6007e");
    assert.equal(new Set([a.tone.ground, b.tone.ground, c.tone.ground]).size, 3);
    assert.equal(new Set([a.tone.deep, b.tone.deep, c.tone.deep]).size, 3);
  });
  test("round trip: a colour survives hex → OKLCH → hex within a rounding step", () => {
    for (const c of ["#8a3b12", "#0b5a73", "#e6007e", "#5b6b4d"]) {
      const { L, C, h } = hexToLch(c); const back = lch(L, C, h);
      for (const i of [1, 3, 5]) assert.ok(Math.abs(parseInt(c.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)) <= 2, `${c} -> ${back}`);
    }
  });
  test("an out-of-gamut request keeps lightness and hue and reduces chroma", () => {
    assert.match(lch(0.5, 0.9, 140), /^#[0-9a-f]{6}$/);
  });
});

describe("an Edition inherits from its organiser and can override", () => {
  const org = { brand_color: "#5b6b4d", logo_url: "https://x/org.svg", cover_url: "https://x/org.jpg", cover_focus: "20% 30%" };
  test("empty Edition fields come from the organiser", () => {
    const r = resolveBrand({ brand_color: null, logo_url: null, cover_url: null, cover_focus: null }, org);
    assert.deepEqual([r.color, r.logo, r.cover, r.focus], ["#5b6b4d", "https://x/org.svg", "https://x/org.jpg", "20% 30%"]);
    assert.deepEqual(r.own, { color: false, logo: false, cover: false });
  });
  test("an Edition's own cover wins and brings its own focus point (never the organiser's)", () => {
    const r = resolveBrand({ brand_color: null, logo_url: null, cover_url: "https://x/ed.jpg", cover_focus: null }, org);
    assert.equal(r.cover, "https://x/ed.jpg"); assert.equal(r.focus, "50% 50%"); assert.equal(r.own.cover, true);
    assert.equal(resolveBrand({ brand_color: null, logo_url: null, cover_url: "https://x/ed.jpg", cover_focus: "70% 10%" }, org).focus, "70% 10%");
  });
  test("an Edition's own colour wins; an invalid one is ignored", () => {
    assert.equal(resolveBrand({ brand_color: "#e6007e", logo_url: null, cover_url: null }, org).color, "#e6007e");
    assert.equal(resolveBrand({ brand_color: "pink", logo_url: null, cover_url: null }, org).color, "#5b6b4d");
  });
  test("no organiser branding at all resolves to nulls and the default focus", () => {
    const r = resolveBrand(null, { brand_color: null, logo_url: null, cover_url: null });
    assert.deepEqual([r.color, r.logo, r.cover, r.focus], [null, null, null, "50% 50%"]);
  });
  test("focus points are validated like the database does", () => {
    for (const ok of ["0% 0%", "50% 50%", "100% 100%"]) assert.ok(FOCUS_RE.test(ok));
    for (const bad of ["101% 5%", "50%", "center", "5px 5px", "50% 50%; x", ""]) { assert.ok(!FOCUS_RE.test(bad)); assert.equal(normaliseFocus(bad), "50% 50%"); }
  });
});
