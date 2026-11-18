/**
 * Editions launch, stage 1: the two switches, a catalogue an administrator can run, and the free introductory package.
 *
 * THE DEFECT THIS CLOSES. The Editions journey was complete but an organiser could not finish it. No Edition package had ever been active and
 * none had ever been free, so "Approved: choose a package" showed an empty list and a dead end. The only way past was an administrator granting a
 * publish entitlement by hand — which bypasses edition_fulfil_order, the only thing that creates promotion rights from a package's grants. One
 * empty catalogue was the whole of "manual publishing entitlements and separate promotional rights".
 *
 * What this pins:
 *   - the free package grants NO promotion, and the paid promotion rows stay the only route to the homepage and enhanced discovery;
 *   - an administrator can create, mark free, activate and retire packages without SQL, under the same rules the database enforces;
 *   - public visibility and new organiser access are two independent switches, both failing closed;
 *   - closing registration never takes Editions away from an organiser who already has one.
 *
 * Run: node --test tests/editions-launch-stage1.test.mjs
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

await import("./support/register-jsx.mjs");
const { PUBLIC_KEY, SIGNUP_KEY, SWITCH_KEYS, SWITCHES, isOn, summary, validateSwitch } = await import("../app/admin/editions/launch/switches.ts");
const { newArgs, validateNew, validateRetire, upsertArgs, ALL_FEATURES } = await import("../app/admin/editions/commerce/catalogue.ts");
const { TABS } = await import("../app/admin/editions/helpers.ts");
const { EditionsEntryPanel } = await import("../components/editions-manage/EditionsEntryPanel.tsx");
const { EditionsLaunchAdmin: LaunchAdmin } = await import("../components/admin/EditionsLaunchAdmin.tsx");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const dataServer = read("lib/editions/data.server.ts");
const entryPanel = read("components/editions-manage/EditionsEntryPanel.tsx");
const launchAction = read("app/admin/editions/launch/actions.ts");
const commerceAction = read("app/admin/editions/commerce/actions.ts");
const hubPage = read("app/hubs/[id]/manage/editions/page.tsx");
const bizPage = read("app/business/[id]/manage/editions/page.tsx");

/* ── B1: the free package, and what it must NOT carry ──────────────────────────────────────────────────────────── */

describe("the free package", () => {
  const free = {
    code: "community_launch", name: "Community Launch", description: "Free for twelve months.", price: "",
    isFree: true, kind: "package", durationDays: "365", maxMembers: "", sort: "5", active: false,
    discoveryDays: "", homepageDays: "", grouped: false,
  };

  test("is accepted: free, twelve months, every feature, no cap", () => {
    const r = validateNew(free);
    assert.equal(r.ok, true);
    assert.equal(r.value.price, 0);
    assert.equal(r.value.isFree, true);
    assert.equal(r.value.durationDays, 365);
    assert.equal(r.value.maxMembers, null);
    const args = newArgs(r.value);
    assert.deepEqual(args.p_features, [...ALL_FEATURES]);
    assert.equal(args.p_features.length, 5);
    assert.equal(args.p_max_members, null);
  });

  test("grants NO promotion days — the thing that must never be given away by accident", () => {
    const r = validateNew(free);
    assert.deepEqual(r.value.grants, {}, "an empty grants object, not a zeroed one");
    assert.deepEqual(newArgs(r.value).p_grants, {});
  });

  test("a free package priced by mistake is refused", () => {
    const r = validateNew({ ...free, isFree: true, price: "249" });
    // ticking free zeroes the price rather than arguing about it, so the result is still free and still £0
    assert.equal(r.ok, true); assert.equal(r.value.price, 0); assert.equal(r.value.isFree, true);
  });

  test("a £0 package that is NOT marked free cannot be put on sale", () => {
    const r = validateNew({ ...free, isFree: false, price: "0", active: true });
    assert.equal(r.ok, false);
    assert.match(r.error, /only be offered if you tick/i);
  });

  test("a £0 package that is not marked free is allowed while it stays off sale", () => {
    assert.equal(validateNew({ ...free, isFree: false, price: "0", active: false }).ok, true);
  });

  test("the migration adds it switched OFF, free, 365 days, and granting nothing", () => {
    // read from the backend migration if the sibling checkout is present; skipped rather than silently passed when it is not
    let sql = null;
    for (const dir of ["oneshetland-be-ednlaunch", "oneshetland-be-houseswaps"]) {
      try { sql = readFileSync(new URL(`../../${dir}/supabase/migrations/20270106000000_editions_launch_switches_and_catalogue.sql`, import.meta.url), "utf8"); break; } catch { /* next */ }
    }
    if (!sql) { console.warn("  backend checkout not present: the migration assertions are skipped"); return; }
    // Anchor on the STATEMENT, not on text that also appears in the comment above it.
    const at = sql.indexOf("insert into public.edition_packages");
    assert.ok(at > -1, "the insert is there");
    const row = sql.slice(at, sql.indexOf("on conflict (code) do nothing", at));
    assert.ok(row.includes("'community_launch'"), "and it is the Community Launch row");
    assert.match(row, /0, 365,/, "£0 and 365 days");
    assert.match(row, /'\{\}'::jsonb, true\)/, "no grants, and explicitly free");
    assert.match(row, /, false, 5,/, "added switched off");
    assert.match(sql, /post-check: Community Launch must be added switched off/);
    assert.match(sql, /post-check: Community Launch must be free, 365 days, and grant no promotion/);
  });
});

/* ── B2: an administrator can run the catalogue ────────────────────────────────────────────────────────────────── */

describe("package administration, without SQL", () => {
  const base = { code: "winter_2027", name: "Winter 2027", price: "99", kind: "package", durationDays: "90", sort: "10", active: false, isFree: false, maxMembers: "", description: "", discoveryDays: "", homepageDays: "", grouped: false };

  test("a new package can be created, which was impossible before", () => {
    assert.equal(validateNew(base).ok, true);
    assert.equal(typeof newArgs(validateNew(base).value).p_code, "string");
  });

  test("the code is checked against the rows that exist, so a typo cannot overwrite Launch", () => {
    const r = validateNew(base, ["winter_2027", "launch"]);
    assert.equal(r.ok, false);
    assert.match(r.error, /already exists/i);
    assert.equal(validateNew({ ...base, code: "launch" }).ok, false, "and the full-package codes are reserved outright");
  });

  test("a bad code is refused before the database sees it", () => {
    for (const code of ["ab", "Winter-2027", "winter 2027", "", "x".repeat(41)]) {
      assert.equal(validateNew({ ...base, code }).ok, false, code);
    }
  });

  test("a package needs a publishing period; a promotion must not have one", () => {
    assert.match(validateNew({ ...base, durationDays: "" }).error, /publishing period of 1 to 800/);
    assert.match(validateNew({ ...base, durationDays: "801" }).error, /publishing period of 1 to 800/);
    const promo = validateNew({ ...base, kind: "promotion", discoveryDays: "14" });
    assert.equal(promo.ok, true);
    assert.equal(promo.value.durationDays, null);
    assert.deepEqual(newArgs(promo.value).p_features, [], "a promotion carries no features");
    assert.equal(newArgs(promo.value).p_days, null, "and never extends publishing");
  });

  test("a promotion must grant at least one day, and can never be free", () => {
    assert.match(validateNew({ ...base, kind: "promotion" }).error, /at least one day/);
    assert.match(validateNew({ ...base, kind: "promotion", discoveryDays: "14", isFree: true }).error, /sold, not given away/);
  });

  test("promotion days must be whole numbers inside a sane bound", () => {
    assert.match(validateNew({ ...base, discoveryDays: "7.5" }).error, /whole number/);
    assert.match(validateNew({ ...base, homepageDays: "many" }).error, /whole number/);
    assert.match(validateNew({ ...base, discoveryDays: "400" }).error, /365 or fewer/);
  });

  test("grouped only means anything when both kinds of day are present", () => {
    assert.equal(validateNew({ ...base, discoveryDays: "42", grouped: true }).value.grants.grouped, undefined);
    assert.equal(validateNew({ ...base, discoveryDays: "42", homepageDays: "7", grouped: true }).value.grants.grouped, true);
  });

  test("retiring needs a package and a real reason", () => {
    assert.equal(validateRetire("", "a good reason").ok, false);
    assert.match(validateRetire("launch", "no").error, /at least 5 characters/);
    const r = validateRetire("launch", "  replaced by the 2027 rate card  ");
    assert.equal(r.ok, true); assert.equal(r.reason, "replaced by the 2027 rate card");
  });

  test("the actions call the right database functions, and nothing else", () => {
    assert.match(commerceAction, /rpc\("admin_upsert_edition_package", newArgs\(v\.value\)\)/);
    assert.match(commerceAction, /rpc\("admin_retire_edition_package", \{ p_code: v\.code, p_reason: v\.reason \}\)/);
    assert.match(commerceAction, /await requireAdmin\(\);/);
    assert.doesNotMatch(commerceAction, /service_role|SERVICE_ROLE/);
  });

  test("editing an existing row still cannot change what it is", () => {
    // upsertArgs takes kind, days, features, cap and grants from the STORED row, never the form: the long-standing guard, unchanged.
    const row = { code: "launch", name: "Launch", description: null, price_pence: 24900, duration_days: 365, features: [...ALL_FEATURES], max_members: null, active: true, sort: 10, is_free: false, kind: "package", grants: {} };
    const args = upsertArgs(row, { name: "Launch", description: null, price: 24900, sort: 10, active: true });
    assert.equal(args.p_is_free, false, "an existing row's free flag comes from the row");
    assert.equal(args.p_days, 365);
    assert.deepEqual(args.p_grants, {});
  });
});

/* ── B3 and B4: two switches, independent, both closed by default ──────────────────────────────────────────────── */

describe("the two launch switches", () => {
  test("there are exactly two, and they are the keys the database accepts", () => {
    assert.deepEqual([...SWITCH_KEYS], ["editions.enabled", "editions.signup_open"]);
    assert.equal(SWITCHES.length, 2);
    assert.deepEqual(SWITCHES.map((s) => s.key), [PUBLIC_KEY, SIGNUP_KEY]);
  });

  test("both read as OFF unless the stored value is exactly 'true'", () => {
    for (const v of [undefined, "", "false", "FALSE ", "yes", "1", "on"]) {
      assert.equal(isOn({ [PUBLIC_KEY]: v }, PUBLIC_KEY), false, String(v));
    }
    assert.equal(isOn({ [PUBLIC_KEY]: "true" }, PUBLIC_KEY), true);
    assert.equal(isOn({ [PUBLIC_KEY]: " TRUE " }, PUBLIC_KEY), true, "the same tolerance the database applies");
  });

  test("they are genuinely independent", () => {
    const cfg = { [PUBLIC_KEY]: "true", [SIGNUP_KEY]: "false" };
    assert.equal(isOn(cfg, PUBLIC_KEY), true);
    assert.equal(isOn(cfg, SIGNUP_KEY), false);
    assert.notEqual(summary(true, false), summary(true, true));
    assert.notEqual(summary(false, true), summary(false, false));
  });

  test("every state has a sentence that says what is true, including both-off", () => {
    for (const [p, s] of [[false, false], [true, false], [false, true], [true, true]]) {
      assert.ok(summary(p, s).length > 40, `${p}/${s}`);
    }
    assert.match(summary(false, false), /closed/i);
    assert.match(summary(false, false), /existing organisers/i, "off must not read as broken");
  });

  test("each switch says what turning it on does, before it is turned on", () => {
    for (const s of SWITCHES) {
      assert.ok(s.turningOn.length >= 2, s.key);
      assert.ok(s.whileOff.length > 20, s.key);
    }
    assert.match(SWITCHES[0].turningOn.join(" "), /visible to visitors/i);
    assert.match(SWITCHES[1].whileOff, /keeps full access|keep full access/i);
  });

  test("the setter refuses anything that is not one of the two, true or false", () => {
    assert.equal(validateSwitch("editions.commerce.enabled", true).ok, false);
    assert.equal(validateSwitch("anything", true).ok, false);
    assert.equal(validateSwitch(PUBLIC_KEY, "true").ok, false, "a string is not a boolean");
    assert.deepEqual(validateSwitch(PUBLIC_KEY, true), { ok: true, key: PUBLIC_KEY, value: "true" });
    assert.deepEqual(validateSwitch(SIGNUP_KEY, false), { ok: true, key: SIGNUP_KEY, value: "false" });
  });

  test("the action goes through the audited database function, as an administrator", () => {
    assert.match(launchAction, /await requireAdmin\(\)/);
    assert.match(launchAction, /rpc\("admin_set_editions_switch", \{ p_key: v\.key, p_value: v\.value \}\)/);
    assert.match(launchAction, /revalidatePath\("\/", "layout"\)/, "the header reads the public switch on every request");
    assert.doesNotMatch(launchAction, /service_role|SERVICE_ROLE/);
  });

  test("it has a place in the admin interface", () => {
    const launch = TABS.find((t) => t.key === "launch");
    assert.ok(launch, "a Launch tab exists");
    assert.equal(launch.href, "/admin/editions/launch");
  });
});

/* ── B4: public visibility no longer decides who may START ─────────────────────────────────────────────────────── */

describe("public visibility and organiser registration are separate", () => {
  test("access is decided by the signup switch, never by the public one", () => {
    assert.match(dataServer, /export const getEditionsSignupOpen = cache\(/);
    assert.match(dataServer, /rpc\("editions_signup_open"\)/);
    assert.match(dataServer, /allowed: signupOpen \|\| isStaff \|\| isMember/);
    assert.doesNotMatch(dataServer, /allowed: enabled \|\| isStaff \|\| isMember/, "the old meaning must be gone");
  });

  test("both helpers fail closed", () => {
    for (const fn of ["getEditionsEnabled", "getEditionsSignupOpen"]) {
      const body = dataServer.slice(dataServer.indexOf(`export const ${fn} = cache(`), dataServer.indexOf("});", dataServer.indexOf(`export const ${fn} = cache(`)));
      assert.match(body, /return !error && data === true;/, fn);
      assert.match(body, /catch \{ return false; \}/, fn);
    }
  });

  test("an existing organiser keeps access whatever the switches say", () => {
    assert.match(dataServer, /isStaff \|\| isMember/);
    assert.match(dataServer, /closing registration must never take Editions away/i, "and the reason is written down");
  });

  test("the start button is gated, and the gate is explained rather than just hidden", () => {
    assert.match(entryPanel, /canStart = true/, "default open, so a caller that forgets the prop does not break an existing organiser");
    assert.match(entryPanel, /\{canStart \? \(/);
    assert.match(entryPanel, /not open for new organisers just yet/i);
    // an organiser that already exists returns before canStart is ever consulted
    const beforeState = entryPanel.slice(0, entryPanel.indexOf("canStart ? ("));
    assert.match(beforeState, /if \(state\) \{/, "the already-started branch comes first");
  });

  test("both management pages read the switch and pass it", () => {
    for (const [name, src] of [["hub", hubPage], ["business", bizPage]]) {
      assert.match(src, /getEditionsSignupOpen/, name);
      assert.match(src, /canStart=\{signupOpen\}/, name);
    }
  });

  test("the database enforces it too: the website is the explanation, not the gate", () => {
    let sql = null;
    for (const dir of ["oneshetland-be-ednlaunch", "oneshetland-be-houseswaps"]) {
      try { sql = readFileSync(new URL(`../../${dir}/supabase/migrations/20270106000000_editions_launch_switches_and_catalogue.sql`, import.meta.url), "utf8"); break; } catch { /* next */ }
    }
    if (!sql) { console.warn("  backend checkout not present: the migration assertions are skipped"); return; }
    assert.match(sql, /if not \(public\.editions_signup_open\(\) or public\.edition_staff\(\)\) then/);
    assert.match(sql, /hint = 'signup_closed'/);
    // the existing-organiser return must come BEFORE the guard, or today's organisers would be locked out
    const retAt = sql.indexOf("if v_org.id is not null then return");
    const gateAt = sql.indexOf("if not (public.editions_signup_open()");
    assert.ok(retAt > -1 && gateAt > retAt, "an existing organiser is returned before the switch is consulted");
  });
});

/* ── what the organiser actually sees ──────────────────────────────────────────────────────────────────────────── */

describe("the start panel, rendered", () => {
  const noop = async () => ({ ok: true, slug: "x" });
  const panel = (props) => renderToStaticMarkup(h(EditionsEntryPanel, { kind: "hub", parentId: "11111111-1111-4111-8111-111111111111", parentName: "ZZ Harbour Gala", state: null, start: noop, ...props }));

  test("with registration open: the start button is there, as it always was", () => {
    const html = panel({ canStart: true });
    assert.match(html, /Start Editions for ZZ Harbour Gala/);
    assert.doesNotMatch(html, /not open for new organisers/i);
  });

  test("with registration closed: no button, and a sentence that explains rather than a dead end", () => {
    const html = panel({ canStart: false });
    assert.doesNotMatch(html, /<button[^>]*>\s*Start Editions/);
    assert.match(html, /not open for new organisers just yet/i);
    assert.match(html, /get in touch/i, "it says what to do next");
    assert.match(html, /ZZ Harbour Gala/, "and it is about their own Hub, not a generic notice");
  });

  test("a Business or Hub that ALREADY runs Editions is untouched by the switch", () => {
    for (const canStart of [true, false]) {
      const html = panel({ canStart, state: { slug: "zz-harbour-gala", editions: 2, inReview: 1 } });
      assert.match(html, /Open Editions tools/, `canStart=${canStart}`);
      assert.match(html, /href="\/organise\/zz-harbour-gala"/, `canStart=${canStart}`);
      assert.doesNotMatch(html, /not open for new organisers/i, `canStart=${canStart}`);
    }
  });

  test("the default is open, so an older caller that passes no flag keeps working", () => {
    assert.match(panel({}), /Start Editions for ZZ Harbour Gala/);
  });
});

/* ── what the administrator actually sees ──────────────────────────────────────────────────────────────────────── */

describe("the launch screen, rendered", () => {
  const screen = (config) => renderToStaticMarkup(h(LaunchAdmin, { config }));

  test("it renders at all", () => {
    assert.ok(LaunchAdmin, "the launch screen could not even be imported");
  });

  test("both off: each switch reads Off, and the summary says so without sounding broken", () => {
    const html = screen({});
    assert.equal((html.match(/>Off</g) ?? []).length, 2, "two switches, both off");
    assert.match(html, /Editions is closed/);
    assert.match(html, /Existing organisers and OneShetland staff can still work on theirs/);
    assert.doesNotMatch(html, />On</, "nothing is on");
  });

  test("turning one on is behind a confirmation, so it is never a stray click", () => {
    const html = screen({});
    assert.match(html, /Switch on…/);
    assert.doesNotMatch(html, /Yes, switch it on/, "the consequences are shown only after asking");
  });

  test("public on, registration closed: the normal launch state reads correctly", () => {
    const html = screen({ "editions.enabled": "true" });
    assert.match(html, />On</);
    assert.match(html, />Off</);
    assert.match(html, /New organisers cannot start Editions yet/);
    assert.match(html, /Switch off/, "and it can be closed again in one click, with no confirmation");
  });

  test("the two switches are shown as separate controls, not one", () => {
    const html = screen({});
    assert.match(html, /Editions are visible to the public/);
    assert.match(html, /New organisers may start Editions/);
  });
});
