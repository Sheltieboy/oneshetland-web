// Throwaway-grade mock PostgREST for RENDERING the staff community-event screens and the member "My events" area (not used by any test).
// Sessions come from tests/support/mock-session.mjs (fixture names: admin | tester | member). Mutations are applied to in-memory fixtures so a
// refresh shows them. Ids starting "fail" make the matching action fail. Run: node tests/support/mock-postgrest-admin.mjs 3099
import http from "node:http";

const H = 3600_000, D = 24 * H, NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
const U = { admin: "00000000-0000-4000-8000-0000000000a1", tester: "00000000-0000-4000-8000-0000000000b2", member: "00000000-0000-4000-8000-0000000000c3" };
const occ = (id, event_id, days, status = "scheduled", note = null) => ({ id, event_id, starts_at: iso(NOW + days * D), ends_at: iso(NOW + days * D + 2 * H), status, venue: null, locality: null, note });
const ev = (o) => ({ is_hidden: o.status !== "published", source: "community_submission", is_dated_run: false, description: "Fixture.", venue: "Hall", locality: "Lerwick", ticket_url: null, contact_info: null, price_text: null, cover_url: null, ends_at: null, ...o });
const EVENTS = [
  ev({ id: "e0000001-0000-4000-8000-000000000001", title: "Cinderella - the Pantomime", status: "published", organiser_name: "Lerwick Drama Club", submission_id: "50000001-0000-4000-8000-000000000001", created_at: iso(NOW - 2 * D), starts_at: iso(NOW + 3 * D), is_dated_run: true }),
  ev({ id: "e0000002-0000-4000-8000-000000000002", title: "Unst Choir Concert", status: "cancelled", organiser_name: "Unst Choir", submission_id: "50000003-0000-4000-8000-000000000003", created_at: iso(NOW - 5 * D), starts_at: iso(NOW + 9 * D) }),
  ev({ id: "e0000003-0000-4000-8000-000000000003", title: "Old Quilt Fair", status: "archived", organiser_name: "Unst Quilters", submission_id: "50000004-0000-4000-8000-000000000004", created_at: iso(NOW - 40 * D), starts_at: iso(NOW - 30 * D) }),
  ev({ id: "e0000004-0000-4000-8000-000000000004", title: "Fail Test Event (actions fail)", status: "published", organiser_name: "Fail Club", submission_id: null, created_at: iso(NOW - 6 * D), starts_at: iso(NOW + 4 * D) }),
  ev({ id: "e0000005-0000-4000-8000-000000000005", title: "Curated Parkrun", status: "published", source: "oneshetland", organiser_name: null, submission_id: null, created_at: iso(NOW - 1 * D), starts_at: iso(NOW + 2 * D) }),
  ev({ id: "e0000006-0000-4000-8000-000000000006", title: "Hub Calendar Event", status: "published", source: null, organiser_hub_id: "h1", calendar_approved: false, organiser_name: null, submission_id: null, created_at: iso(NOW - 1 * D), starts_at: iso(NOW + 2 * D) }),
];
const OCC = [
  occ("a0000001-0000-4000-8000-000000000001", EVENTS[0].id, -3), occ("a0000002-0000-4000-8000-000000000002", EVENTS[0].id, 3), occ("a0000003-0000-4000-8000-000000000003", EVENTS[0].id, 4, "cancelled"), occ("a0000004-0000-4000-8000-000000000004", EVENTS[0].id, 5),
  occ("a0000005-0000-4000-8000-000000000005", EVENTS[1].id, 9, "cancelled"), occ("a0000006-0000-4000-8000-000000000006", EVENTS[3].id, 4), occ("fail0000-0000-4000-8000-000000000007", EVENTS[3].id, 6),
];
const sub = (n, status, event_id, o = {}) => ({ id: `5000000${n}-0000-4000-8000-00000000000${n}`, submitter_id: U.member, status, organiser_name: "Lerwick Drama Club", title: `Submission ${n}`, description: "Tea and cake.", category: "Community", venue: "Hall", locality: "Lerwick",
  cover_url: null, contact_info: "Phone 01595 000000", ticket_url: null, price_text: "Free", occurrences: [{ starts_at: iso(NOW + n * D), ends_at: iso(NOW + n * D + 2 * H) }], review_reason: null, reviewed_at: null, event_id, created_at: iso(NOW - n * D), ...o });
const SUBS = [
  sub(1, "approved", EVENTS[0].id, { title: "Cinderella - the Pantomime" }), sub(2, "pending", null, { title: "Burns Supper", organiser_name: "Whalsay Burns Club" }),
  sub(3, "approved", EVENTS[1].id, { title: "Unst Choir Concert", organiser_name: "Unst Choir" }), sub(4, "approved", EVENTS[2].id, { title: "Old Quilt Fair", organiser_name: "Unst Quilters" }),
];
const CHANGES = [
  { id: "c0000001-0000-4000-8000-000000000001", event_id: EVENTS[0].id, status: "pending", kind: "dates", payload: { venue: "Garrison Theatre" }, before: { venue: "Hall" }, review_reason: null, created_at: iso(NOW - D), requester_id: U.member },
  { id: "c0000002-0000-4000-8000-000000000002", event_id: EVENTS[0].id, status: "auto_approved", kind: "dates", payload: { description: "Updated text" }, before: { description: "Fixture." }, review_reason: null, created_at: iso(NOW - 2 * D), requester_id: U.member },
  { id: "c0000003-0000-4000-8000-000000000003", event_id: EVENTS[0].id, status: "rejected", kind: "dates", payload: { price_text: "£5" }, before: { price_text: null }, review_reason: "Please keep it free.", created_at: iso(NOW - 3 * D), requester_id: U.member },
  { id: "c0000004-0000-4000-8000-000000000004", event_id: EVENTS[0].id, status: "withdrawn", kind: "dates", payload: { venue: "Elsewhere" }, before: { venue: "Hall" }, review_reason: null, created_at: iso(NOW - 4 * D), requester_id: U.member },
  { id: "c0000005-0000-4000-8000-000000000005", event_id: EVENTS[0].id, status: "approved", kind: "dates", payload: { contact_info: "Phone 1" }, before: { contact_info: null }, review_reason: null, created_at: iso(NOW - 5 * D), requester_id: U.member },
];
const LOG = [{ id: 2, event_id: EVENTS[0].id, occurrence_id: OCC[2].id, actor_kind: "contributor", action: "performance_cancelled", detail: { note: null }, created_at: iso(NOW - 6 * H) }];

const fxOf = (req) => { try { const t = (req.headers.authorization ?? "").replace(/^Bearer /i, "").split(".")[1]; return JSON.parse(Buffer.from(t, "base64url").toString()).fx; } catch { return null; } };
const parseVal = (raw) => { const i = raw.indexOf("."); return [raw.slice(0, i), raw.slice(i + 1)]; };
function applyFilters(rows, q) {
  let r = rows;
  for (const [k, raw] of q.entries()) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const [op, val] = parseVal(raw);
    if (op === "eq") r = r.filter((x) => String(x[k]) === val);
    else if (op === "neq") r = r.filter((x) => String(x[k]) !== val);
    else if (op === "in") { const set = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")); r = r.filter((x) => set.includes(String(x[k]))); }
    else if (op === "ilike") { const re = new RegExp("^" + val.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i"); r = r.filter((x) => re.test(String(x[k] ?? ""))); }
    else if (op === "not") { /* not.is.null etc: keep simple */ const [, v2] = parseVal(val); if (v2 === "null") r = r.filter((x) => x[k] != null); }
  }
  const ord = q.get("order"); if (ord) { const [c, d] = ord.split("."); r = [...r].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (d === "desc" ? -1 : 1)); }
  const lim = Number(q.get("limit")); return lim ? r.slice(0, lim) : r;
}
const body = (req) => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), fx = fxOf(req), uid = U[fx] ?? null;
  const single = /pgrst\.object/.test(req.headers.accept ?? "");
  const send = (code, b, extra = {}) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...extra }); res.end(b === undefined ? "" : JSON.stringify(b)); };
  const list = (rows, total) => { if (/count=exact/.test(req.headers.prefer ?? "")) return send(200, req.method === "HEAD" ? undefined : rows, { "content-range": `0-${Math.max(0, rows.length - 1)}/${total ?? rows.length}` }); return single ? (rows[0] ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "no rows" })) : send(200, rows); };
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
  const p = u.pathname;
  if (p === "/auth/v1/user") return uid ? send(200, { id: uid, email: `${fx}@example.com`, aud: "authenticated", role: "authenticated" }) : send(401, { message: "no" });
  if (p.startsWith("/rest/v1/rpc/")) {
    const fn = p.split("/").pop(), a = await body(req);
    if (fn === "event_submissions_tester") return send(200, fx === "tester");
    if (fn === "event_submissions_open") return send(200, true);
    if (fn === "my_event_organiser_trusted") return send(200, false);
    if (fn === "admin_event_submission_counts") return send(200, [{ pending: SUBS.filter((s) => s.status === "pending").length, changes_requested: 0, oldest_pending_at: iso(NOW - 3 * D) }]);
    if (fn === "admin_event_change_counts") return send(200, [{ pending: CHANGES.filter((c) => c.status === "pending").length, auto_approved_7d: 1 }]);
    if (fn === "admin_list_event_submissions") return send(200, SUBS.filter((s) => s.status === a.p_status).map((s) => ({ id: s.id, submitter_id: s.submitter_id, status: s.status, organiser_name: s.organiser_name, title: s.title, category: s.category, occurrence_count: 1, first_starts_at: s.occurrences[0].starts_at, created_at: s.created_at })));
    if (fn === "admin_list_event_changes") return send(200, CHANGES.filter((c) => c.status === a.p_status).map((c) => ({ id: c.id, event_id: c.event_id, event_title: EVENTS.find((e) => e.id === c.event_id).title, requester_id: c.requester_id, status: c.status, kind: c.kind, payload: c.payload, created_at: c.created_at })));
    if (fn === "admin_set_occurrence_status") {
      if (String(a.p_occurrence).startsWith("fail")) return send(403, { code: "42501", message: "Only OneShetland staff can do this" });
      const o = OCC.find((x) => x.id === a.p_occurrence); if (!o) return send(404, { code: "P0002", message: "No such occurrence" });
      o.status = a.p_status; return send(200, { id: o.id, event_id: o.event_id, status: o.status, note: o.note });
    }
    if (fn === "withdraw_event_change") { const c = CHANGES.find((x) => x.id === a.p_id); if (c) c.status = "withdrawn"; return send(200, "withdrawn"); }
    return send(200, null);
  }
  const t = p.replace("/rest/v1/", "");
  if (t === "profiles") {
    const rows = [{ id: U.admin, role: "admin", display_name: "Darren Admin", full_name: null }, { id: U.tester, role: "customer", display_name: "Tess Tester", full_name: null }, { id: U.member, role: "customer", display_name: "Ann Member", full_name: "Ann Member" }];
    return list(applyFilters(rows, u.searchParams));
  }
  if (t === "events") {
    if (req.method === "PATCH") {
      const b = await body(req), rows = applyFilters(EVENTS, u.searchParams).filter((e) => !e.id.startsWith("e0000004"));
      rows.forEach((e) => { Object.assign(e, b); e.is_hidden = e.status !== "published"; });
      return send(200, rows);
    }
    const cols = u.searchParams.get("select") ?? "";
    let rows = applyFilters(EVENTS, u.searchParams);
    if (/organiser_hub_id/.test([...u.searchParams.keys()].join())) rows = EVENTS.filter((e) => e.organiser_hub_id && e.calendar_approved === false);
    rows = rows.map((e) => (/occurrences:event_occurrences/.test(cols) ? { ...e, occurrences: OCC.filter((o) => o.event_id === e.id) } : e));
    return list(rows);
  }
  if (t === "event_occurrences") return list(applyFilters(OCC, u.searchParams));
  if (t === "event_submissions") {
    const mine = (u.searchParams.get("submitter_id") ?? "").replace(/^eq\./, "");   // "my" submissions: whoever asks owns the fixtures (so any fixture user can see them)
    if (mine) { const q = new URLSearchParams(u.searchParams); q.delete("submitter_id"); return list(applyFilters(SUBS, q).map((x) => ({ ...x, submitter_id: mine }))); }
    return list(applyFilters(SUBS, u.searchParams));
  }
  if (t === "event_change_log") return list(applyFilters(LOG, u.searchParams));
  if (t === "event_change_requests") return list(applyFilters(CHANGES, u.searchParams));
  return single ? send(406, { code: "PGRST116", message: "no rows" }) : list([]);
}).listen(Number(process.argv[2] ?? 3099), () => console.log("admin mock postgrest up"));
