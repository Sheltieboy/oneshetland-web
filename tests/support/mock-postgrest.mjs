// Throwaway-grade mock PostgREST for RENDERING the new-schema path (not used by any test). Serves fixture events in the shape the
// pages' selects return (organiser_name / source / is_dated_run / occurrences / embeds). Unknown tables answer []. Run:
//   node tests/support/mock-postgrest.mjs 3099
import http from "node:http";

const H = 3600_000, D = 24 * H, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const nm = new Date(NOW); nm.setUTCDate(1); nm.setUTCMonth(nm.getUTCMonth() + 1);
const Y = nm.getUTCFullYear(), M0 = nm.getUTCMonth();
const at = (day, h = 19) => Date.UTC(Y, M0, day, h);
const perf = (day, extra = {}) => ({ id: `occ-${day}`, starts_at: iso(at(day)), ends_at: iso(at(day, 21)), status: "scheduled", venue: null, locality: null, note: null, ...extra });
const base = (o) => ({
  category: "Music", status: "published", is_hidden: false, venue: "Mareel", locality: "Lerwick", lat: null, lng: null, ends_at: null, cover_url: null, price_text: null,
  has_tickets: false, is_featured: false, description: "A fixture event.", doors_open_at: null, formatted_address: null, accessibility_info: null, age_restriction: null,
  contact_info: null, event_notes: null, refund_policy: null, ticket_url: null, gallery_urls: null, organiser_hub_id: null, organiser_business_id: null, calendar_approved: true,
  business: null, hub: null, ticket_types: [], organiser_name: null, source: null, is_dated_run: false, occurrences: [], is_platform_event: false, ...o,
});
const pantoOcc = Array.from({ length: 15 }, (_, i) => perf(5 + i, i === 3 ? { status: "cancelled", note: "Cancelled - cast illness" } : i === 6 ? { venue: "Brae Hall", locality: "Brae", note: "Special matinee" } : {}));
// Regular Activities fixtures: one business-owned, one PLATFORM-owned (the database returns owner_name 'OneShetland' for it), and one hub-owned whose hub
// the viewer cannot read (kind 'hub', name falls back to 'OneShetland'). Next sessions are always in the future.
const act = (n, o) => ({ id: `aa000000-0000-4000-8000-00000000000${n}`, slug: `fixture-${n}`, title: o.title, description: "A fixture activity.", category: "fitness", audience: "Everyone", venue: "Hall", locality: "Lerwick", price_text: "Free",
  booking_mode: "drop_in", cover_url: null, owner_kind: o.kind, owner_id: o.id, owner_name: o.name, owner_slug: null,
  next_starts_at: iso(NOW + (n + 1) * D), next_ends_at: iso(NOW + (n + 1) * D + H), sessions_in_window: 3, cancelled_in_window: 0, upcoming: [] });
export const ACTIVITIES = [
  act(1, { title: "Business Run Club", kind: "business", id: "b1", name: "Ruth Archer Fitness" }),
  act(2, { title: "Platform Walk (no separate organiser)", kind: "platform", id: null, name: "OneShetland" }),
  act(3, { title: "Hub Craft Circle (owner unreadable)", kind: "hub", id: "h9", name: "OneShetland" }),
];
const detailRow = (a) => ({ id: a.id, slug: a.slug, title: a.title, description: a.description, category: a.category, audience: a.audience, venue: a.venue, locality: a.locality, lat: null, lng: null, cover_url: null,
  price_text: a.price_text, booking_mode: "drop_in", contact_info: null, booking_url: null, status: "published", active_from: null, active_until: null,
  organiser_business_id: a.owner_kind === "business" ? a.owner_id : null, organiser_hub_id: a.owner_kind === "hub" ? a.owner_id : null, is_platform_activity: a.owner_kind === "platform", admin_paused: false, calendar_approved: true });

export const EVENTS = [
  base({ id: "11111111-1111-4111-8111-111111111111", title: "Cinderella - the Pantomime", category: "Theatre & Performing Arts", venue: "Garrison Theatre", starts_at: pantoOcc[0].starts_at, ends_at: pantoOcc[14].ends_at,
    is_dated_run: true, organiser_name: "Lerwick Drama Club", source: "community_submission", is_platform_event: true, contact_info: "Phone 01595 000000", description: "The much-loved pantomime.", occurrences: pantoOcc }),
  base({ id: "22222222-2222-4222-8222-222222222222", title: "Aladdin (ticket link)", category: "Theatre & Performing Arts", venue: "Whiteness Hall", starts_at: iso(at(9)), ends_at: iso(at(11, 21)), is_dated_run: true,
    organiser_name: "Whiteness Players", source: "community_submission", is_platform_event: true, ticket_url: "https://example.org/tickets", occurrences: [perf(9), perf(10), perf(11)].map((o, i) => ({ ...o, id: `al${i}` })) }),
  base({ id: "33333333-3333-4333-8333-333333333333", title: "Parkrun (curated)", starts_at: iso(NOW + 2 * D), is_platform_event: true, venue: "Clickimin", category: "Sport" }),
  base({ id: "44444444-4444-4444-8444-444444444444", title: "Harry's Tasting Night", starts_at: iso(NOW + 3 * D), organiser_business_id: "b1", business: { id: "b1", name: "Harry's Department Store", logo_url: null }, has_tickets: true,
    ticket_types: [{ id: "tt1", name: "General", price_pence: 1500, description: null, quantity_available: 50, quantity_sold: 2, per_order_max: 4, is_active: true, sale_starts_at: null, sale_ends_at: null, display_order: 0 }] }),
  base({ id: "55555555-5555-4555-8555-555555555555", title: "Up Helly Aa Preview (OneShetland)", starts_at: iso(NOW + 4 * D), is_platform_event: true, source: "oneshetland" }),
  base({ id: "66666666-6666-4666-8666-666666666666", title: "Quilt Show (named)", starts_at: iso(NOW + 5 * D), is_platform_event: true, organiser_name: "Unst Quilters" }),
  base({ id: "77777777-7777-4777-8777-777777777777", title: "Winter Exhibition (ongoing)", category: "Arts & Culture", starts_at: iso(NOW - 10 * D), ends_at: iso(NOW + 30 * D) }),
  base({ id: "88888888-8888-4888-8888-888888888888", title: "Cancelled Run (all cancelled)", category: "Theatre & Performing Arts", starts_at: iso(at(12)), ends_at: iso(at(13, 21)), is_dated_run: true,
    organiser_name: "Ghost Players", source: "community_submission", occurrences: [perf(12, { id: "gc1", status: "cancelled" }), perf(13, { id: "gc2", status: "cancelled" })] }),
  // ── cancelled / hidden fixtures (events_cancelled_public_read: anyone can read a cancelled event by its link; is_hidden stays true) ──
  base({ id: "c0000001-0000-4000-8000-000000000001", title: "Cancelled Community Concert", status: "cancelled", is_hidden: true, starts_at: iso(NOW + 6 * D), is_platform_event: true,
    source: "community_submission", organiser_name: "Unst Choir", contact_info: "Phone 01957 000000", has_tickets: true, ticket_url: "https://example.org/tickets", price_text: "£8", description: "A concert that is no longer happening." }),
  base({ id: "c0000002-0000-4000-8000-000000000002", title: "Cancelled Business Tasting", status: "cancelled", is_hidden: true, starts_at: iso(NOW + 7 * D), organiser_business_id: "b1", has_tickets: true,
    business: { id: "b1", name: "Harry's Department Store", logo_url: null },
    ticket_types: [{ id: "tt9", name: "General", price_pence: 1500, description: null, quantity_available: 50, quantity_sold: 2, per_order_max: 4, is_active: true, sale_starts_at: null, sale_ends_at: null, display_order: 0 }] }),
  base({ id: "c0000003-0000-4000-8000-000000000003", title: "Cancelled Hub Quiz (islands)", status: "cancelled", is_hidden: true, starts_at: iso(NOW + 8 * D), organiser_hub_id: "h1", hub_visibility: "islands", hub: { id: "h1", name: "Bressay Hall Hub", logo_url: null, brand_color: null } }),
  base({ id: "c0000004-0000-4000-8000-000000000004", title: "Cancelled Hub Quiz (members only)", status: "cancelled", is_hidden: true, starts_at: iso(NOW + 8 * D), organiser_hub_id: "h1", hub_visibility: "members", hub: { id: "h1", name: "Bressay Hall Hub", logo_url: null, brand_color: null } }),
  base({ id: "c0000005-0000-4000-8000-000000000005", title: "Cancelled Panto Run", status: "cancelled", is_hidden: true, category: "Theatre & Performing Arts", venue: "Garrison Theatre", starts_at: iso(at(20)), ends_at: iso(at(22, 21)), is_dated_run: true,
    organiser_name: "Lerwick Drama Club", source: "community_submission", is_platform_event: true, contact_info: "Phone 01595 000000",
    occurrences: [perf(20, { id: "cp1" }), perf(21, { id: "cp2" }), perf(22, { id: "cp3", status: "cancelled", note: "Cancelled earlier" })] }),
  base({ id: "d0000001-0000-4000-8000-000000000001", title: "Draft Event", status: "draft", is_hidden: true, starts_at: iso(NOW + 9 * D) }),
  base({ id: "d0000002-0000-4000-8000-000000000002", title: "Postponed Event", status: "postponed", is_hidden: true, starts_at: iso(NOW + 9 * D) }),
];

// ── signed-in member fixtures for the ownership journey (/whats-on/add, /account/event-submissions) ─────────────────────────────────
// A session cookie whose access_token payload carries { fx: "<name>" } picks the fixture (see tests/support/mock-session.mjs).
const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const sub = (n, status) => ({ id: `5b000000-0000-4000-8000-00000000000${n}`, submitter_id: "x", status, organiser_name: "Unst Quilters", title: `Winter Fair ${n}`, description: "Tea.", category: "Community", venue: "Hall", locality: "Unst",
  cover_url: null, contact_info: null, ticket_url: null, price_text: "Free", occurrences: [{ starts_at: iso(NOW + n * D), ends_at: iso(NOW + n * D + 2 * H), status: "scheduled", note: null }], review_reason: null, reviewed_at: null, event_id: null, created_at: iso(NOW - n * D) });
const hubRow = (id, name, slug, role) => ({ role, hub: { id, name, slug, type: "community", logo_url: null, brand_color: null, is_active: true } });
export const MEMBERS = {
  none: { id: U("11"), businesses: [], hubs: [], subs: [] },
  business: { id: U("12"), businesses: [{ id: "b1", name: "Ruth Archer Fitness", slug: "ruth-archer-fitness", logo_url: null, is_active: true }], hubs: [], subs: [] },
  hub: { id: U("13"), businesses: [], hubs: [hubRow("h1", "Bressay Hall Hub", "bressay-hall", "owner")], subs: [] },
  committee: { id: U("14"), businesses: [], hubs: [hubRow("h2", "Aith Choir", "aith-choir", "committee")], subs: [] },
  both: { id: U("15"), businesses: [{ id: "b1", name: "Ruth Archer Fitness", slug: "ruth-archer-fitness", logo_url: null, is_active: true }, { id: "b2", name: "Anderson Bakery", slug: null, logo_url: null, is_active: false }], hubs: [hubRow("h1", "Bressay Hall Hub", "bressay-hall", "owner"), hubRow("h2", "Aith Choir", "aith-choir", "committee")], subs: [] },
  many: { id: U("16"), businesses: [], hubs: [], subs: [sub(1, "approved"), sub(2, "pending"), sub(3, "changes_requested"), sub(4, "withdrawn")] },
  fail: { id: U("17"), businesses: [], hubs: "ERROR", subs: [] },     // the hub read fails: the journey must degrade to independent-only
};
const memberOf = (req) => {
  try {
    const tok = (req.headers.authorization ?? "").replace(/^Bearer /i, "").split(".")[1];
    const fx = JSON.parse(Buffer.from(tok, "base64url").toString()).fx;
    return MEMBERS[fx] ?? null;
  } catch { return null; }
};

// What an anonymous visitor may read: published and not hidden, plus (migration 20261230020000) a CANCELLED event by its link when it is not a members-only hub event.
const visible = (e) => (e.status === "published" && !e.is_hidden) || (e.status === "cancelled" && (!e.organiser_hub_id || ["hub", "islands"].includes(e.hub_visibility)));

const P = (v) => v.split(".").slice(1).join(".");
function filter(rows, q) {
  let r = rows;
  for (const [k, raw] of q.entries()) {
    const val = P(raw), op = raw.split(".")[0];
    if (k === "id" && op === "eq") r = r.filter((e) => e.id === val);
    if (k === "category" && op === "in") { const set = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")); r = r.filter((e) => set.includes(e.category)); }
    if (k === "is_dated_run" && op === "eq") r = r.filter((e) => String(e.is_dated_run) === val);
    if (k === "starts_at" && op === "gte") r = r.filter((e) => Date.parse(e.starts_at) >= Date.parse(val));
    if (k === "starts_at" && op === "lte") r = r.filter((e) => Date.parse(e.starts_at) <= Date.parse(val));
    if (k === "starts_at" && op === "lt") r = r.filter((e) => Date.parse(e.starts_at) < Date.parse(val));
    if (k === "ends_at" && op === "gte") r = r.filter((e) => e.ends_at && Date.parse(e.ends_at) >= Date.parse(val));
    if (k === "organiser_business_id" && op === "eq") r = r.filter((e) => e.organiser_business_id === val);
    if (k === "status" && op === "in") r = r.filter((e) => val.includes(e.status));
    if (k === "status" && op === "eq") r = r.filter((e) => e.status === val);
    if (k === "is_hidden" && op === "eq") r = r.filter((e) => String(e.is_hidden) === val);
  }
  return r.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
  const m = memberOf(req);
  if (u.pathname === "/auth/v1/user" && m) return send(200, { id: m.id, email: "member@example.com", aud: "authenticated", role: "authenticated" });
  if (m && u.pathname === "/rest/v1/local_businesses") return send(200, m.businesses);
  if (m && u.pathname === "/rest/v1/hub_members" && (u.searchParams.get("select") ?? "").replace(/\s/g, "") === "role,status") {
    const mine = Array.isArray(m.hubs) ? m.hubs.find((r) => r.hub.id === (u.searchParams.get("hub_id") ?? "").replace(/^eq\./, "")) : null;
    return mine ? send(200, { role: mine.role, status: "active" }) : (/pgrst\.object/.test(req.headers.accept ?? "") ? send(406, { code: "PGRST116", message: "no rows" }) : send(200, []));
  }
  if (u.pathname === "/rest/v1/hubs" && (u.searchParams.get("slug") || u.searchParams.get("id"))) {
    const key = (u.searchParams.get("slug") ?? u.searchParams.get("id")).replace(/^eq\./, "");
    const all = Object.values(MEMBERS).flatMap((x) => (Array.isArray(x.hubs) ? x.hubs : [])).map((r) => r.hub).find((h) => h.slug === key || h.id === key);
    if (all) return send(200, { ...all, is_verified: false, owner_id: null, description: null, island: null, member_count: 0 });
  }
  if (m && u.pathname === "/rest/v1/hub_members") return m.hubs === "ERROR" ? send(500, { code: "XX000", message: "boom" }) : send(200, m.hubs);
  if (m && u.pathname === "/rest/v1/event_submissions") return send(200, m.subs.map((x) => ({ ...x, submitter_id: m.id })));
  if (m && u.pathname === "/rest/v1/rpc/event_submissions_open") return send(200, true);
  if (m && u.pathname === "/rest/v1/rpc/submit_event_submission") return send(200, "5b000000-0000-4000-8000-0000000000ff");
  if (m && u.pathname === "/rest/v1/profiles") return send(200, []);
  if (u.pathname === "/auth/v1/user") return send(200, { id: "00000000-0000-4000-8000-000000000001", email: "organiser@example.com", aud: "authenticated", role: "authenticated" });
  if (u.pathname.startsWith("/functions/v1/")) return send(200, { ok: true });
  if (u.pathname === "/rest/v1/event_updates" && req.method === "POST") return send(201, { id: "upd1" });
  if (u.pathname === "/rest/v1/events" && req.method === "PATCH") { res.writeHead(204, { "access-control-allow-origin": "*" }); return res.end(); }
  const single = /pgrst\.object/.test(req.headers.accept ?? "");
  if (u.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = u.pathname.split("/").pop();
    if (fn === "event_payout_ready") return send(200, true);
    if (fn === "get_event_orders") return send(200, { can_refund: true, is_admin: false, total_orders: 2, orders: [{ id: "o1", status: "paid", total_pence: 3000, tickets_count: 2 }, { id: "o2", status: "paid", total_pence: 1500, tickets_count: 1 }] });
    if (fn === "report_event_cancelled") return send(400, { code: "P0001", message: "People have bought tickets for this event through OneShetland, so we need to help you tell them and arrange refunds. Please contact OneShetland.", hint: "has_ticket_buyers" });
    if (fn === "regular_activities_listing") return send(200, ACTIVITIES);
    if (fn === "activity_sessions") return send(200, ACTIVITIES.map((a) => ({ activity_id: a.id, rule_id: null, exception_id: null, occurrence_date: a.next_starts_at.slice(0, 10), original_starts_at: a.next_starts_at, starts_at: a.next_starts_at, ends_at: a.next_ends_at, status: "scheduled", venue: null, locality: null, note: null, is_extra: false })));
    if (fn === "get_event_social_stats") return send(200, [{ going_count: 0, booked_recent: 0 }]);
    return send(200, null);
  }
  if (u.pathname === "/rest/v1/regular_activities") {
    const slug = (u.searchParams.get("slug") ?? "").replace(/^eq\./, "");
    const a = ACTIVITIES.find((x) => x.slug === slug);
    return a ? send(200, detailRow(a)) : send(406, { code: "PGRST116", message: "no rows" });
  }
  if (u.pathname === "/rest/v1/hubs" || u.pathname === "/rest/v1/local_businesses_public") {
    const id = (u.searchParams.get("id") ?? "").replace(/^eq\./, "");
    return id === "b1" ? send(200, { id: "b1", name: "Ruth Archer Fitness", slug: "ruth-archer-fitness" }) : send(406, { code: "PGRST116", message: "no rows" });   // anything else: not readable
  }
  if (u.pathname === "/rest/v1/events") {
    const cols = u.searchParams.get("select") ?? "";
    let rows = filter(EVENTS.filter(visible), u.searchParams).map((e) => {
      const { occurrences, is_platform_event: _p, ...rest } = e; void _p;
      const out = /occurrences:event_occurrences/.test(cols) ? { ...rest, occurrences } : rest;
      if (!/organiser_name/.test(cols)) { delete out.organiser_name; delete out.source; delete out.is_dated_run; }
      return out;
    });
    const lim = Number(u.searchParams.get("limit"));
    if (lim) rows = rows.slice(0, lim);
    if (single) return rows[0] ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" });
    return send(200, rows);
  }
  if (single) return send(406, { code: "PGRST116", message: "no rows" });
  return send(200, []);
}).listen(Number(process.argv[2] ?? 3099), () => console.log("mock postgrest up"));
