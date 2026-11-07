/**
 * "Who is organising this?" journey: state machine, organiser shaping, links, hub suggestion, copy, and source-level guarantees.
 * Run: node --test --import ./tests/support/register.mjs tests/event-ownership.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  shapeOrganisers, initialState, reduce, currentStep, stepKey, resolveOrganiser, organiserEventsHref, organiserActivitiesHref, signInHref,
  allJourneyLinks, shouldSuggestHub, HUB_SUGGESTION_THRESHOLD, START_HUB_HREF, ADD_BUSINESS_HREF,
} from "../lib/event-ownership.ts";
import * as copy from "../lib/event-ownership-copy.ts";
import { SHARED_CATEGORIES } from "../lib/event-categories.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const BIZ = { id: "b-1", name: "Ruth Archer Fitness", slug: "ruth-archer-fitness", logo_url: "https://cdn.example/logo.png", is_active: true, owner_id: "u1", stripe_customer_id: "cus_secret", email: "x@y.z" };
const BIZ2 = { id: "b-2", name: "Anderson Bakery", slug: null, logo_url: null, is_active: false };
const HUB = { id: "h-1", name: "Bressay Hall Hub", slug: "bressay-hall", type: "community", logo_url: null, brand_color: "#123456", is_active: true };
const HUB2 = { id: "h-2", name: "Aith Choir", slug: "aith-choir", is_active: true };
const FOREIGN = { kind: "business", id: "someone-elses-business" };
const FIXTURES = {
  none: shapeOrganisers([], []),
  business: shapeOrganisers([BIZ], []),
  hub: shapeOrganisers([], [HUB]),
  committee: shapeOrganisers([], [HUB2]),
  both: shapeOrganisers([BIZ, BIZ2], [HUB, HUB2]),
};
const run = (organisers, actions, cat = null) => actions.reduce((s, a) => reduce(s, a, organisers), initialState(cat));
const eventSlug = SHARED_CATEGORIES.find((c) => c.route === "event").slug;
const activitySlug = SHARED_CATEGORIES.find((c) => c.route === "activity").slug;
const askSlug = SHARED_CATEGORIES.find((c) => c.route === "ask").slug;

describe("organiser shaping: only authorised, only minimal", () => {
  test("businesses first then hubs, A to Z; only id, name, slug and an https logo survive", () => {
    const o = FIXTURES.both;
    assert.deepEqual(o.map((x) => `${x.kind}:${x.name}`), ["business:Anderson Bakery", "business:Ruth Archer Fitness", "hub:Aith Choir", "hub:Bressay Hall Hub"]);
    for (const x of o) assert.deepEqual(Object.keys(x).sort(), ["id", "kind", "logoUrl", "name", "slug"]);
    const json = JSON.stringify(o);
    assert.doesNotMatch(json, /cus_secret|owner_id|x@y\.z|brand_color|stripe/);
  });
  test("an unlisted business is still the owner's to manage; an inactive hub is not offered", () => {
    assert.ok(FIXTURES.both.some((x) => x.id === "b-2"));
    assert.equal(shapeOrganisers([], [{ ...HUB, is_active: false }]).length, 0);
  });
  test("malformed rows, odd ids, unsafe logos, duplicates and non-arrays are dropped without throwing", () => {
    const o = shapeOrganisers([null, 5, {}, { id: "a b", name: "x" }, { id: "../x", name: "x" }, { id: "ok", name: "  " }, { id: "dup", name: "One", logo_url: "javascript:alert(1)" }, { id: "dup", name: "Two" }], "nope");
    assert.deepEqual(o.map((x) => [x.id, x.name, x.logoUrl]), [["dup", "One", null]]);
    assert.deepEqual(shapeOrganisers(undefined, null), []);
    assert.equal(shapeOrganisers([{ id: "ok", name: "A", logo_url: "http://insecure.example/x.png" }], [])[0].logoUrl, null);
    assert.equal(shapeOrganisers([], [{ id: "h", name: "H", slug: "Bad Slug/../" }])[0].slug, null);
  });
  test("a foreign id never resolves, so it can never reach an outcome", () => {
    const s = run(FIXTURES.business, [{ type: "organiser", choice: FOREIGN }]);
    assert.equal(s.organiser, null);
    const forged = { ...initialState(eventSlug), organiser: FOREIGN };
    assert.equal(resolveOrganiser(forged, FIXTURES.business), null);
    assert.equal(currentStep(forged, FIXTURES.business).step, "organiser");
    // the same id as a different kind is also foreign
    assert.equal(run(FIXTURES.business, [{ type: "organiser", choice: { kind: "hub", id: "b-1" } }]).organiser, null);
  });
});

describe("state machine: every member x outcome", () => {
  const members = Object.entries(FIXTURES);
  for (const [name, organisers] of members) {
    test(`${name}: organiser step comes first, independent is always available`, () => {
      assert.equal(currentStep(initialState(), organisers).step, "organiser");
      const s = run(organisers, [{ type: "organiser", choice: { kind: "independent" } }]);
      assert.equal(currentStep(s, organisers).step, "category");
    });
    test(`${name}: independent + event -> the existing form; independent + activity -> no form, explanation`, () => {
      const base = [{ type: "organiser", choice: { kind: "independent" } }];
      const ev = currentStep(run(organisers, [...base, { type: "category", slug: eventSlug }]), organisers);
      assert.equal(ev.outcome, "independent_event"); assert.equal(ev.href, null);
      const ac = currentStep(run(organisers, [...base, { type: "category", slug: activitySlug }]), organisers);
      assert.equal(ac.outcome, "independent_activity"); assert.equal(ac.href, null);
      // the ask category: weekly -> activity explanation, dates -> event form
      const w = currentStep(run(organisers, [...base, { type: "category", slug: askSlug }, { type: "answer", value: "weekly" }]), organisers);
      assert.equal(w.outcome, "independent_activity");
      const d = currentStep(run(organisers, [...base, { type: "category", slug: askSlug }, { type: "answer", value: "dates" }]), organisers);
      assert.equal(d.outcome, "independent_event");
      assert.equal(currentStep(run(organisers, [...base, { type: "category", slug: askSlug }]), organisers).step, "ask");
    });
    for (const o of organisers) {
      test(`${name}: ${o.kind} "${o.name}" -> event editor and activity editor links`, () => {
        const pick = [{ type: "organiser", choice: { kind: o.kind, id: o.id } }];
        const ev = currentStep(run(organisers, [...pick, { type: "category", slug: eventSlug }]), organisers);
        assert.equal(ev.outcome, "organiser_event"); assert.equal(ev.href, organiserEventsHref(o)); assert.equal(ev.organiser.id, o.id);
        const ac = currentStep(run(organisers, [...pick, { type: "category", slug: activitySlug }]), organisers);
        assert.equal(ac.outcome, "organiser_activity"); assert.equal(ac.href, organiserActivitiesHref(o));
        const w = currentStep(run(organisers, [...pick, { type: "category", slug: askSlug }, { type: "answer", value: "weekly" }]), organisers);
        assert.equal(w.outcome, "organiser_activity");
      });
    }
  }
  test("an ordinary member (no business, no hub) can never reach any outcome that offers an activity editor or form", () => {
    for (const slug of SHARED_CATEGORIES.map((c) => c.slug)) for (const answer of [null, "dates", "weekly"]) {
      const acts = [{ type: "organiser", choice: { kind: "independent" } }, { type: "category", slug }, ...(answer ? [{ type: "answer", value: answer }] : [])];
      const st = currentStep(run(FIXTURES.none, acts), FIXTURES.none);
      if (st.step === "outcome" && st.outcome.endsWith("activity")) { assert.equal(st.outcome, "independent_activity"); assert.equal(st.href, null); }
    }
  });
  test("every shared category yields a defined step for every organiser kind", () => {
    for (const c of SHARED_CATEGORIES) for (const o of FIXTURES.both) {
      const st = currentStep(run(FIXTURES.both, [{ type: "organiser", choice: { kind: o.kind, id: o.id } }, { type: "category", slug: c.slug }]), FIXTURES.both);
      assert.ok(["outcome", "ask"].includes(st.step));
    }
  });
});

describe("navigation: back, change, deep links, restart", () => {
  const O = FIXTURES.both;
  const pick = { type: "organiser", choice: { kind: "hub", id: "h-1" } };
  test("back unwinds in the order decided: answer, category, organiser", () => {
    let s = run(O, [pick, { type: "category", slug: askSlug }, { type: "answer", value: "weekly" }]);
    assert.equal(currentStep(s, O).outcome, "organiser_activity");
    s = reduce(s, { type: "back" }, O); assert.equal(currentStep(s, O).step, "ask");
    s = reduce(s, { type: "back" }, O); assert.equal(currentStep(s, O).step, "category");
    s = reduce(s, { type: "back" }, O); assert.equal(currentStep(s, O).step, "organiser");
    assert.deepEqual(reduce(s, { type: "back" }, O), s);
  });
  test("changing the organiser keeps the category and re-routes to the new organiser", () => {
    let s = run(O, [pick, { type: "category", slug: eventSlug }]);
    assert.match(currentStep(s, O).href, /^\/hubs\/bressay-hall\//);
    s = reduce(s, { type: "changeOrganiser" }, O);
    assert.equal(currentStep(s, O).step, "organiser");
    s = reduce(s, { type: "organiser", choice: { kind: "business", id: "b-1" } }, O);
    assert.equal(currentStep(s, O).href, "/business/b-1/manage/events");
    s = reduce(s, { type: "organiser", choice: { kind: "independent" } }, O);
    assert.equal(currentStep(s, O).outcome, "independent_event");
  });
  test("a ?category= deep link still starts at the organiser question, then lands on the right outcome", () => {
    for (const [slug, expected] of [["theatre_performing_arts", "organiser_event"], [activitySlug, "organiser_activity"]]) {
      let s = initialState(slug);
      assert.equal(currentStep(s, O).step, "organiser");
      s = reduce(s, pick, O);
      assert.equal(currentStep(s, O).outcome, expected);
      s = reduce(s, { type: "back" }, O);                       // back from the outcome goes to the organiser step, the link's category is kept
      assert.equal(currentStep(s, O).step, "organiser"); assert.equal(s.slug, slug);
    }
    const ask = reduce(initialState(askSlug), pick, O);
    assert.equal(currentStep(ask, O).step, "ask");
  });
  test("an unknown or hostile deep-link category is ignored", () => {
    for (const bad of ["nope", "__proto__", "constructor", "", null, undefined, 5]) assert.equal(initialState(bad).slug, null);
  });
  test("unknown categories and answers change nothing", () => {
    const s = run(O, [pick]);
    assert.deepEqual(reduce(s, { type: "category", slug: "hacker" }, O), s);
    assert.deepEqual(reduce(s, { type: "answer", value: "weekly-ish" }, O), s);
  });
  test("'really a one-off event' turns an ask category into a dated event, and sends an activity-only category back to the list", () => {
    const ind = { type: "organiser", choice: { kind: "independent" } };
    const a = run(O, [ind, { type: "category", slug: askSlug }, { type: "answer", value: "weekly" }, { type: "oneOff" }]);
    assert.equal(currentStep(a, O).outcome, "independent_event");
    const b = run(O, [ind, { type: "category", slug: activitySlug }, { type: "oneOff" }]);
    assert.equal(currentStep(b, O).step, "category");
  });
  test("changing the kind of thing keeps the organiser and returns to the list", () => {
    const s = reduce(run(O, [pick, { type: "category", slug: eventSlug }]), { type: "changeCategory" }, O);
    assert.equal(currentStep(s, O).step, "category"); assert.equal(s.organiser.id, "h-1");
  });
  test("restart clears everything", () => {
    assert.deepEqual(run(O, [pick, { type: "category", slug: eventSlug }, { type: "restart" }]), initialState());
  });
  test("the step key changes exactly when the visible step changes (focus is moved on it)", () => {
    const k = (s) => stepKey(currentStep(s, O));
    const s1 = run(O, [pick]); const s2 = reduce(s1, { type: "category", slug: eventSlug }, O);
    assert.notEqual(k(initialState()), k(s1)); assert.notEqual(k(s1), k(s2));
    assert.notEqual(stepKey(currentStep(run(O, [pick, { type: "category", slug: eventSlug }]), O)), stepKey(currentStep(run(O, [{ type: "organiser", choice: { kind: "hub", id: "h-2" } }, { type: "category", slug: eventSlug }]), O)));
  });
});

describe("link builders target routes that exist", () => {
  const dirs = { event: "app/business/[id]/manage/events/page.tsx", bizAct: "app/business/[id]/manage/activities/new/page.tsx", hubEv: "app/hubs/[id]/manage/events/page.tsx", hubAct: "app/hubs/[id]/manage/activities/new/page.tsx" };
  test("the four editors exist, with the exact shapes the builders emit", () => {
    for (const p of Object.values(dirs)) assert.ok(existsSync(new URL("../" + p, import.meta.url)), p);
    assert.equal(organiserEventsHref({ kind: "business", id: "B", slug: "s" }), "/business/B/manage/events");
    assert.equal(organiserActivitiesHref({ kind: "business", id: "B", slug: "s" }), "/business/B/manage/activities/new");
    assert.equal(organiserEventsHref({ kind: "hub", id: "H", slug: "club" }), "/hubs/club/manage/events");
    assert.equal(organiserActivitiesHref({ kind: "hub", id: "H", slug: null }), "/hubs/H/manage/activities/new");
  });
  test("every link the journey can emit resolves to a route in the app directory", () => {
    const routeFile = (href) => {
      const path = href.split("?")[0].split("/").filter(Boolean);
      const walk = (dir, i) => {
        if (i === path.length) return existsSync(new URL(`../${dir}/page.tsx`, import.meta.url));
        const base = new URL(`../${dir}/`, import.meta.url);
        for (const cand of [path[i], "[id]", "[slug]"]) if (existsSync(new URL(`../${dir}/${cand}`, import.meta.url)) && walk(`${dir}/${cand}`, i + 1)) return true;
        void base; return false;
      };
      return walk("app", 0);
    };
    const links = allJourneyLinks([{ kind: "business", id: "b-1", slug: null }, { kind: "hub", id: "h-1", slug: "x" }, { kind: "hub", id: "h-2", slug: null }]);
    assert.ok(links.length > 8);
    for (const l of links) assert.ok(l.startsWith("/") && !l.startsWith("//"), l);
    for (const l of links) assert.ok(routeFile(l), `no route for ${l}`);
  });
  test("sign-in keeps the way back, only for a real category", () => {
    assert.equal(signInHref(null), "/sign-in?next=%2Fwhats-on%2Fadd");
    assert.equal(signInHref("theatre_performing_arts"), "/sign-in?next=%2Fwhats-on%2Fadd%3Fcategory%3Dtheatre_performing_arts");
    assert.equal(signInHref("evil//x"), "/sign-in?next=%2Fwhats-on%2Fadd");
  });
});

describe("hub suggestion rule", () => {
  const st = (n, extra = []) => [...Array(n).fill("approved"), ...extra];
  test("threshold is three non-withdrawn submissions", () => {
    assert.equal(HUB_SUGGESTION_THRESHOLD, 3);
    assert.equal(shouldSuggestHub({ statuses: st(2), managesHub: false }), false);
    assert.equal(shouldSuggestHub({ statuses: st(3), managesHub: false }), true);
    assert.equal(shouldSuggestHub({ statuses: ["pending", "rejected", "changes_requested"], managesHub: false }), true);
  });
  test("withdrawn ones do not count", () => assert.equal(shouldSuggestHub({ statuses: st(2, ["withdrawn", "withdrawn"]), managesHub: false }), false));
  test("the one just sent counts on the thank-you screen", () => {
    assert.equal(shouldSuggestHub({ statuses: st(2), managesHub: false, justSubmitted: true }), true);
    assert.equal(shouldSuggestHub({ statuses: st(1), managesHub: false, justSubmitted: true }), false);
  });
  test("never when they already run a hub, and silent when we could not check", () => {
    assert.equal(shouldSuggestHub({ statuses: st(9), managesHub: true }), false);
    assert.equal(shouldSuggestHub({ statuses: st(9), managesHub: null }), false);
  });
});

describe("copy", () => {
  const all = copy.ALL_COPY_FOR_TESTS();
  test("plain words: no jargon, no 'wee'", () => {
    for (const s of all) assert.doesNotMatch(s, /\bwee\b|payload|\bAPI\b|\bRPC\b|whitelist|moderat|queue|trusted organiser|\bslug\b/i, s);
  });
  test("nothing says or implies a regular activity can be submitted independently", () => {
    for (const s of [copy.ACTIVITY_PANEL_TITLE, copy.ACTIVITY_PANEL_WHY, copy.ACTIVITY_PANEL_NEED]) assert.doesNotMatch(s, /independent/i, s);
    assert.match(copy.ACTIVITY_PANEL_TITLE, /needs a business or a hub/);
    assert.match(copy.ACTIVITY_PANEL_WHY, /who runs it/); assert.match(copy.ACTIVITY_PANEL_WHY, /changes, cancellations and messages/);
    assert.match(copy.ACTIVITY_PANEL_NEED, /business or a hub/);
    assert.equal(copy.START_HUB_LABEL, "Start a free hub"); assert.equal(copy.ADD_BUSINESS_LABEL, "Add your business");
    assert.equal(START_HUB_HREF, "/hubs/new"); assert.equal(ADD_BUSINESS_HREF, "/directory/new");
    assert.doesNotMatch(copy.OPT_INDEPENDENT_HINT, /activit/i, "the independent option is for one-off events only");
  });
  test("no false notification, instant-publishing or approval claims", () => {
    for (const s of all) assert.doesNotMatch(s, /we'?ll (let|tell|notify|email)|notif|instant|immediately|straight away|guarantee|automatic|will be (published|approved)/i, s);
  });
  test("the hub suggestion is accurate and gentle", () => {
    assert.match(copy.HUB_SUGGESTION_BODY, /own page/); assert.match(copy.HUB_SUGGESTION_BODY, /events and regular activities in one place/);
    assert.match(copy.HUB_SUGGESTION_BODY, /don't need one for a one-off/);
    assert.match(copy.HUB_SUGGESTION_CHECK, /still checked/); assert.match(copy.HUB_SUGGESTION_CHECK, /unless the hub is verified/);
  });
  test("the continue labels name the organiser", () => {
    assert.equal(copy.continueEventsLabel("Ruth Archer Fitness"), "Continue to Ruth Archer Fitness's events");
    assert.equal(copy.continueActivitiesLabel("Bressay Hall Hub"), "Continue to Bressay Hall Hub's regular activities");
  });
});

describe("source-level guarantees", () => {
  const door = read("components/events/front-door/FrontDoor.tsx");
  const loader = read("lib/event-organisers.server.ts");
  const page = read("app/whats-on/add/page.tsx");
  const ownership = read("lib/event-ownership.ts");
  test("organisers come only from the two authorised loaders, server-side; the client never queries", () => {
    assert.match(loader, /getMyBusinessesBasic\(userId, \{ includeUnlisted: true \}\)/);
    assert.match(loader, /getMyHubs\(\)/);
    assert.doesNotMatch(loader, /\.from\(/);
    assert.doesNotMatch(door, /supabase|fetch\(|localStorage|sessionStorage/);
    assert.match(page, /loadMyOrganisers\(account\.id\)\.catch/);
  });
  test("getMyHubs returns exactly the roles that may manage a hub's events and activities (owner, committee, active)", () => {
    const hubs = read("lib/hubs-server.ts");
    assert.match(hubs, /\.in\("role", \["owner", "committee"\]\)\s*\.eq\("status", "active"\)/);
    assert.match(hubs, /role === "owner" \|\| role === "committee"/);   // isHubAdmin, which requireHubAdmin uses
  });
  test("the pure module has no I/O", () => assert.doesNotMatch(ownership, /fetch\(|supabase|process\.env|from "react"|server-only/));
  test("the journey does not touch the SubmissionForm's validation, limits or switch", () => {
    assert.match(page, /submissionsOpen\(/);
    assert.match(read("components/events/front-door/SubmissionForm.tsx"), /submitEvent\(/);
  });
  test("signed-out visitors see sign-in first with the way back kept and the 18+ line", () => {
    assert.match(door, /signInHref\(initialCategory\)/);
    assert.match(copy.SIGN_IN_FIRST_BODY, /18 or over/);
  });
});
