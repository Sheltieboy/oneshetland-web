/**
 * Fetch v2 web — the shared client (lib/fetch-api.ts): right function, right body, stable errors, no writes, no client money.
 * A fake transport records every call; nothing touches a network or a database.
 * Run: node --test tests/fetch-api.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FetchApi, FETCH_RPCS, FETCH_EDGES, FETCH_MESSAGES, fetchMessage, ADULT_CONFIRMATION_VERSION } from "../lib/fetch-api.ts";

const ID = "11111111-1111-4111-8111-111111111111";
function fake(reply = {}) {
  const calls = [];
  const t = {
    rpc: async (fn, args) => { calls.push({ via: "rpc", fn, args }); return reply.rpc ? reply.rpc(fn, args) : { data: { ok: true }, error: null }; },
    invoke: async (fn, body) => { calls.push({ via: "edge", fn, body }); return reply.invoke ? reply.invoke(fn, body) : { data: { ok: true }, error: null }; },
    read: async (table, columns, filter) => { calls.push({ via: "read", table, columns, filter }); return reply.read ? reply.read(table) : { data: [], error: null }; },
  };
  return { api: new FetchApi(t), calls };
}
const MONEY = /pence|price|amount|fee|total|hold|capture|authoris/i;

test("every method calls only an allow-listed function, edge function or public/party-readable table", async () => {
  const { api, calls } = fake();
  const place = { region_id: ID, address: "1 Example Quay" };
  await Promise.all([
    api.eligibility(), api.confirmAdult(), api.regions(), api.categories(), api.quote({ size_class: "small", pickup: place, destination: place }),
    api.create({ idempotency_key: "abcdefgh12", size_class: "small", pickup: place, destination: place, category_slug: "parcel", item_description: "Box",
      contact_phone: "07000 000000", scheduling_mode: "asap" }),
    api.myRequests(), api.detail(ID), api.headingThatWay(ID), api.timeline(ID), api.cancelOpen(ID), api.askToCancel(ID, "why"), api.extend(ID), api.ready(ID),
    api.payment(ID, "complete"), api.apply({ vehicle_class: "van", max_size_class: "bulky" }), api.setAreas([ID, "not-a-uuid"]), api.verification(),
    api.setVehicle({ vehicle_class: "car", max_size_class: "medium" }), api.evidenceBeginUpload("insurance", "image/jpeg", 10), api.evidenceSubmit(ID), api.evidenceView(ID),
    api.board(true), api.myRuns(), api.createRun({ origin_region_id: ID, destination_region_id: ID, departure_start: "x", departure_end: "y" }), api.cancelRun(ID),
    api.accept(ID, true), api.myJobs(), api.arrived(ID), api.collected(ID), api.refreshHold(ID), api.release(ID, "changed_plans"), api.agreeToCancel(ID),
    api.declineToCancel(ID), api.deliver(ID, true), api.cannotDeliver(ID, "recipient_absent"), api.reportReturn(ID), api.messages(ID), api.sendMessage(ID, "hi", "ref12345"),
    api.reportProblem(ID, "damaged", "", "ref12345"), api.myIssues(ID), api.photos(ID), api.setItemPhoto(ID, ID, "hide_from_board"),
    api.photoBeginUpload(ID, "item", "image/png", 10, { showOnBoard: true }), api.photoSubmit(ID), api.photoView(ID, true),
  ]);
  for (const c of calls) {
    if (c.via === "rpc") assert.ok(FETCH_RPCS.includes(c.fn), c.fn);
    if (c.via === "edge") assert.ok(FETCH_EDGES.includes(c.fn), c.fn);
    if (c.via === "read") assert.ok(["fetch_request_events", "regions", "delivery_categories"].includes(c.table), c.table);
  }
  // Every allow-listed function is actually used (no dead entries that could widen the surface later).
  for (const fn of FETCH_RPCS) assert.ok(calls.some((c) => c.fn === fn), `unused ${fn}`);
  for (const fn of FETCH_EDGES) assert.ok(calls.some((c) => c.fn === fn), `unused ${fn}`);
  // Areas: only ids are sent.
  assert.deepEqual(calls.find((c) => c.fn === "fetch_v2_set_my_areas").args, { p_areas: [ID] });
  assert.equal(calls.find((c) => c.fn === "fetch_v2_confirm_adult").args.p_version, ADULT_CONFIRMATION_VERSION);
  // The timeline reads only safe columns of this job's events.
  const tl = calls.find((c) => c.table === "fetch_request_events");
  assert.equal(tl.columns, "id, event, created_at, actor_role");
  assert.deepEqual(tl.filter, { column: "request_id", value: ID });
});

test("the client never sends a money value: create/quote/accept/payment/driver bodies hold no price, fee, hold or amount", async () => {
  const { api, calls } = fake();
  const place = { region_id: ID, address: "1 Example Quay" };
  // Even if a caller smuggles money fields in, they are not forwarded.
  await api.create({ idempotency_key: "abcdefgh12", size_class: "bulky", pickup: place, destination: place, category_slug: "furniture", item_description: "Sofa",
    contact_phone: "07000 000000", scheduling_mode: "asap", total_fee_pence: 1, max_authorisation_pence: 1, status: "matched", driver_id: ID, pickup_lat: 60 });
  await api.quote({ size_class: "small", pickup: place, destination: place, expected_total_pence: 1 });
  await api.accept(ID, true); await api.payment(ID, "complete"); await api.deliver(ID, false); await api.release(ID, "other", "n");
  for (const c of calls.filter((x) => x.via === "edge")) {
    for (const k of Object.keys(c.body)) assert.ok(!MONEY.test(k), `${c.fn} sends ${k}`);
    assert.ok(!("status" in c.body) && !("driver_id" in c.body) && !("pickup_lat" in c.body), c.fn);
  }
  const create = calls.find((c) => c.fn === "fetch-v2-create").body;
  assert.equal(create.idempotency_key, "abcdefgh12");
  assert.equal(create.needed_by, null); assert.equal(create.flexible_until, null);
});

test("a retried post sends the same idempotency key (the server makes it the same Fetch)", async () => {
  const { api, calls } = fake({ invoke: (fn) => ({ data: { ok: true, request_id: ID, already: calls.filter((c) => c.fn === fn).length > 1 }, error: null }) });
  const input = { idempotency_key: "same-key-123", size_class: "small", pickup: { region_id: ID, address: "a" }, destination: { region_id: ID, address: "b" },
    category_slug: "parcel", item_description: "Box", contact_phone: "07000 000000", scheduling_mode: "asap" };
  const a = await api.create(input), b = await api.create(input);
  assert.equal(a.data.request_id, b.data.request_id); assert.equal(b.data.already, true);
  assert.deepEqual(calls.map((c) => c.body.idempotency_key), ["same-key-123", "same-key-123"]);
});

test("refusals arrive as stable codes with plain-English messages; unknown codes never leak", async () => {
  const { api } = fake({ invoke: (fn) => (fn === "fetch-v2-create" ? { data: null, error: { code: "payment_method_required" } }
    : fn === "fetch-v2-accept" ? { data: null, error: { code: "already_taken" } } : { data: null, error: { code: "some_internal_thing" } }),
    rpc: (fn) => (fn === "fetch_v2_extend" ? { data: { ok: false, code: "extension_limit" }, error: null }
      : fn === "fetch_v2_request_detail" ? { data: null, error: { message: "Fetch request not found" } }
      : fn === "fetch_v2_board" ? { data: null, error: { message: "Fetch is not available" } }
      : fn === "fetch_v2_mark_collected" ? { data: null, error: { message: "Driver can take Fetch jobs (driver_verification_expired)" } }
      : { data: null, error: { message: "permission denied for function" } }) });
  const place = { region_id: ID, address: "a" };
  const c = await api.create({ idempotency_key: "abcdefgh12", size_class: "small", pickup: place, destination: place, category_slug: "p", item_description: "b", contact_phone: "0", scheduling_mode: "asap" });
  assert.deepEqual([c.ok, c.code], [false, "payment_method_required"]); assert.match(c.message, /add a payment card/);
  assert.equal((await api.accept(ID, true)).code, "already_taken");
  assert.equal((await api.payment(ID, "complete")).code, "server_error");
  assert.equal((await api.extend(ID)).code, "extension_limit");
  assert.equal((await api.detail(ID)).code, "not_found");
  assert.equal((await api.board()).code, "fetch_unavailable");
  assert.equal((await api.collected(ID)).code, "driver_verification_expired");
  assert.equal((await api.myRuns()).code, "unauthorised");
  assert.equal((await api.detail("not-a-uuid")).code, "not_found");
  for (const [code, msg] of Object.entries(FETCH_MESSAGES)) {
    assert.ok(!/stripe|paymentintent|rpc|sql|edge function|null|undefined|_/i.test(msg), `${code}: ${msg}`);
  }
  assert.equal(fetchMessage("anything_else"), FETCH_MESSAGES.server_error);
});

test("a thrown transport becomes a polite server_error, never an exception in a page", async () => {
  const boom = { rpc: async () => { throw new Error("x"); }, invoke: async () => { throw new Error("x"); }, read: async () => ({ data: null, error: { message: "x" } }) };
  const api = new FetchApi(boom);
  assert.equal((await api.eligibility()).code, "server_error");
  assert.equal((await api.accept(ID, true)).code, "server_error");
  assert.equal((await api.regions()).code, "server_error");
});
