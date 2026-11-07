/**
 * Get it done, Stage 1: delivery is real, and the resident's contact is never selected by a client.
 * Run: node --test --import ./tests/support/register.mjs tests/trades-stage1.test.mjs
 */
import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import fake from "./support/fake-supabase.mjs";
await import("./support/register-jsx.mjs");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement: h } = await import("react");
const { LeadCard } = await import("../components/trades/LeadCard.tsx");
const { Sent } = await import("../components/trades/BriefForm.tsx");
const { postBrief, respondToBrief, shareContactWithTrade, getLeadContact, markLeadViewed } = await import("../lib/trades-actions.ts");

const ORIG = { from: fake.from, rpc: fake.rpc, getUser: fake.auth.getUser, functions: fake.functions };
after(() => { fake.from = ORIG.from; fake.rpc = ORIG.rpc; fake.auth.getUser = ORIG.getUser; fake.functions = ORIG.functions; });

let log;
/** A recording client: every table call, insert, select, rpc and function invocation is logged. */
function setup({ businesses = [], rpcImpl, user = { id: "u-1" } } = {}) {
  log = { inserts: [], selects: [], rpcs: [], invokes: [] };
  fake.auth.getUser = async () => ({ data: { user } });
  fake.functions = { invoke: async (name, opts) => { log.invokes.push({ name, body: opts?.body }); return { data: null, error: null }; } };
  fake.rpc = async (fn, args) => { log.rpcs.push({ fn, args }); return rpcImpl ? rpcImpl(fn, args) : { data: null, error: null }; };
  fake.from = (table) => {
    const q = {
      _t: table, _insert: null,
      insert(v) { this._insert = v; log.inserts.push({ table, v }); return this; },
      select(c) { log.selects.push({ table, cols: c }); return this; },
      update() { return this; },
    };
    for (const m of ["eq", "in", "gte", "overlaps", "limit", "order", "is", "not"]) q[m] = () => q;
    q.single = () => q;
    q.maybeSingle = () => q;
    q.then = (res, rej) => Promise.resolve().then(() => {
      if (table === "profiles") return { data: null, error: null };
      if (table === "trade_briefs") return { data: { id: "brief-1" }, error: null };
      if (table === "local_businesses") return { data: businesses, error: null };
      return { data: [], error: null };
    }).then(res, rej);
    return q;
  };
}
const BIZ = (id) => ({ id, name: "B" + id, slug: "b" + id, trade_categories: ["joiner"], trade_availability: "now", trade_availability_set_at: new Date().toISOString(), subscription_tier: "free" });
const INPUT = { title: "Window", description: "Rotten kitchen window", trades: ["joiner"], scale: "small", urgency: "flexible", locationText: "Scalloway", contactName: "Ann", contactPhone: "01595 123456", contactEmail: "a@example.org" };

describe("postBrief", () => {
  test("sentTo is the length of the RPC result, not of our own match list", async () => {
    setup({ businesses: [BIZ("b1"), BIZ("b2"), BIZ("b3")], rpcImpl: async () => ({ data: ["b1", "b3"], error: null }) });
    const r = await postBrief(INPUT);
    assert.equal(r.ok, true); assert.equal(r.id, "brief-1"); assert.equal(r.sentTo, 2);
    const call = log.rpcs.find((c) => c.fn === "create_brief_matches");
    assert.equal(call.args.p_brief, "brief-1"); assert.equal(call.args.p_business_ids.length, 3);
    assert.deepEqual(log.invokes.map((i) => i.name), ["notify-trade-lead"]);
  });
  test("0 created: reports 0, no notification", async () => {
    setup({ businesses: [BIZ("b1")], rpcImpl: async () => ({ data: [], error: null }) });
    const r = await postBrief(INPUT);
    assert.equal(r.sentTo, 0); assert.equal(log.invokes.length, 0);
  });
  test("no candidate at all: 0 and the RPC is not needed", async () => {
    setup({ businesses: [] });
    const r = await postBrief(INPUT);
    assert.equal(r.ok, true); assert.equal(r.sentTo, 0); assert.equal(log.invokes.length, 0);
  });
  test("RPC error: job saved, no count claimed, flagged as a delivery failure, no notification", async () => {
    setup({ businesses: [BIZ("b1")], rpcImpl: async () => ({ data: null, error: { message: "boom" } }) });
    const r = await postBrief(INPUT);
    assert.equal(r.ok, true); assert.equal(r.sentTo, 0); assert.equal(r.deliveryFailed, true); assert.equal(log.invokes.length, 0);
  });
  test("never inserts into trade_brief_matches and never reads contact back; the usage query is gone", async () => {
    setup({ businesses: [BIZ("b1")], rpcImpl: async () => ({ data: ["b1"], error: null }) });
    await postBrief(INPUT);
    assert.ok(!log.inserts.some((i) => i.table === "trade_brief_matches"));
    assert.ok(!log.selects.some((s) => s.table === "trade_brief_matches" && /business_id/.test(s.cols) && !/status/.test(s.cols)), "no free-tier usage query");
    for (const s of log.selects.filter((s) => s.table === "trade_briefs")) assert.equal(s.cols, "id");
  });
});

describe("respondToBrief / share / contact / viewed", () => {
  test("respond uses the RPC, never touches trade_briefs, and notifies only on a real 'interested'", async () => {
    setup({ rpcImpl: async () => ({ data: { status: "interested", changed: true }, error: null }) });
    const r = await respondToBrief("m-1", "interested");
    assert.deepEqual(r, { ok: true, status: "interested" });
    assert.deepEqual(log.rpcs[0], { fn: "respond_to_trade_match", args: { p_match: "m-1", p_response: "interested", p_reason: null } });
    assert.ok(!("contact" in r));
    assert.equal(log.selects.filter((x) => x.table !== "profiles").length, 0, "no table read at all (only the sign-in profile lookup)");
    assert.deepEqual(log.invokes, [{ name: "notify-trade-response", body: { match_id: "m-1", kind: "interested" } }]);
  });
  test("an unchanged reply (already answered) does not notify again", async () => {
    setup({ rpcImpl: async () => ({ data: { status: "interested", changed: false }, error: null }) });
    await respondToBrief("m-1", "interested");
    assert.equal(log.invokes.length, 0);
  });
  test("decline passes the reason and does not notify", async () => {
    setup({ rpcImpl: async () => ({ data: { status: "declined", changed: true }, error: null }) });
    await respondToBrief("m-1", "declined", "too_far");
    assert.equal(log.rpcs[0].args.p_reason, "too_far"); assert.equal(log.invokes.length, 0);
  });
  test("a failing notification never fails the reply", async () => {
    setup({ rpcImpl: async () => ({ data: { status: "interested", changed: true }, error: null }) });
    fake.functions = { invoke: () => Promise.reject(new Error("down")) };
    assert.equal((await respondToBrief("m-1", "interested")).ok, true);
  });
  test("an RPC error is returned as an error", async () => {
    setup({ rpcImpl: async () => ({ data: null, error: { message: "This job is no longer open" } }) });
    const r = await respondToBrief("m-1", "interested");
    assert.equal(r.ok, false); assert.match(r.error, /no longer open/);
  });
  test("share calls share_brief_contact then notifies the trade", async () => {
    setup({ rpcImpl: async () => ({ data: { shared: true }, error: null }) });
    assert.equal((await shareContactWithTrade("m-2")).ok, true);
    assert.deepEqual(log.rpcs[0], { fn: "share_brief_contact", args: { p_match: "m-2" } });
    assert.deepEqual(log.invokes, [{ name: "notify-trade-response", body: { match_id: "m-2", kind: "shared" } }]);
  });
  test("share failure: no notification", async () => {
    setup({ rpcImpl: async () => ({ data: null, error: { message: "nope" } }) });
    assert.equal((await shareContactWithTrade("m-2")).ok, false); assert.equal(log.invokes.length, 0);
  });
  test("getLeadContact and markLeadViewed call their RPCs", async () => {
    setup({ rpcImpl: async (fn) => fn === "get_trade_lead_contact" ? { data: { name: "Ann", phone: "1", email: null }, error: null } : { data: null, error: null } });
    assert.deepEqual((await getLeadContact("m-3")).contact, { name: "Ann", phone: "1", email: null });
    assert.equal((await markLeadViewed("m-3")).ok, true);
    assert.deepEqual(log.rpcs.map((c) => c.fn), ["get_trade_lead_contact", "mark_trade_lead_viewed"]);
    setup({ rpcImpl: async () => ({ data: null, error: null }) });
    assert.equal((await getLeadContact("m-3")).contact, null);
  });
  test("signed out: nothing is called", async () => {
    setup({ user: null });
    assert.equal((await respondToBrief("m", "interested")).ok, false);
    assert.equal((await shareContactWithTrade("m")).ok, false);
    assert.equal(log.rpcs.length, 0);
  });
});

describe("no client reads the resident's contact from trade_briefs", () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" || f === ".next" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  const root = new URL("..", import.meta.url).pathname;
  test("contact_* appears under app/ lib/ components/ only in the postBrief insert payload and comments", () => {
    const hits = [];
    for (const dir of ["app", "lib", "components"]) for (const f of walk(join(root, dir))) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (!/contact_(name|phone|email)/.test(line)) return;
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        hits.push(`${f.slice(root.length)}:${i + 1}:${line.trim()}`);
      });
    }
    for (const h of hits) {
      const [f, , ...rest] = h.split(":"); const text = rest.join(":");
      if (f === "lib/trades-actions.ts") assert.match(text, /^contact_(name|phone|email): (input\.|phone,)/, `only the insert payload may name contact: ${h}`);
      else assert.ok(!/trade_brief/.test(readFileSync(join(root, f), "utf8")), `contact column named in a trade file: ${h}`);
    }
  });
  test("no select string on trade_briefs or an embedded trade_briefs(...) names contact or uses *", () => {
    for (const dir of ["app", "lib", "components"]) for (const f of walk(join(root, dir))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/trade_briefs\(([^)]*)\)/g)) assert.ok(!/contact|\*/.test(m[1]), `${f}: ${m[0]}`);
      for (const m of src.matchAll(/from\("trade_briefs"\)\s*\.select\(\s*["'`]([^"'`]*)["'`]/g)) assert.ok(!/contact|\*/.test(m[1]), `${f}: ${m[0]}`);
    }
  });
});

describe("LeadCard states", () => {
  const brief = { title: "Window", description: "Rotten window", trades: ["joiner"], scale: "small", urgency: "flexible", location: "Scalloway", createdAt: new Date().toISOString(), closed: false };
  const html = (p) => renderToStaticMarkup(h(LeadCard, { matchId: "m", brief, contact: null, alreadyAnswered: false, status: "sent", ...p }));

  test("new / seen", () => {
    assert.match(html({ isNew: true }), />New</);
    assert.match(html({ status: "viewed" }), />Seen</);
  });
  test("interested, not yet shared: waiting for the customer, no contact", () => {
    const out = html({ status: "interested", alreadyAnswered: true, contact: { name: "LEAK", phone: "LEAK", email: "LEAK" } });
    assert.match(out, /waiting for the customer to share their details/);
    assert.ok(!out.includes("LEAK") && !out.includes("tel:"), "contact is ignored unless the customer shared it");
  });
  test("shared: shows the fetched contact with tel and mailto links", () => {
    const out = html({ status: "interested", alreadyAnswered: true, contactShared: true, contact: { name: "Ann", phone: "01595 123456", email: "a@example.org" } });
    assert.match(out, /Customer shared their details/);
    assert.match(out, /href="tel:01595 123456"/); assert.match(out, /href="mailto:a@example.org"/); assert.match(out, /Ann/);
  });
  test("shared but contact failed to load: no contact, honest note", () => {
    const out = html({ status: "interested", alreadyAnswered: true, contactShared: true, contact: null });
    assert.ok(!out.includes("tel:")); assert.match(out, /load them just now/);
  });
  test("declined", () => {
    assert.match(html({ status: "declined", alreadyAnswered: true }), /You declined/);
  });
  test("job details are shown without any contact", () => {
    const out = html({});
    assert.match(out, /Window/); assert.match(out, /Scalloway/); assert.match(out, /Rotten window/);
  });
});

describe("BriefForm wording", () => {
  const src = readFileSync(new URL("../components/trades/BriefForm.tsx", import.meta.url), "utf8");
  test("consent text and town-or-area helper are present", () => {
    assert.match(src, /We never show your name, phone or email to a trade automatically/);
    assert.match(src, /you choose whether to share your details/);
    assert.match(src, /town or area/i);
  });
  test("Sent screen never claims a count when there is none", () => {
    assert.ok(!/Sent to/.test(renderToStaticMarkup(h(Sent, { sentTo: 0 }))));
    assert.match(renderToStaticMarkup(h(Sent, { sentTo: 0 })), /Your job is saved. No matching trade is available to tell yet/);
    assert.ok(!/Sent to/.test(renderToStaticMarkup(h(Sent, { sentTo: 0, deliveryFailed: true }))));
    assert.match(renderToStaticMarkup(h(Sent, { sentTo: 3 })), /Sent to 3 trades/);
    assert.match(renderToStaticMarkup(h(Sent, { sentTo: 1 })), /Sent to 1 trade</);
  });
});
