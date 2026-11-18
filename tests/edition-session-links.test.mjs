/**
 * Programme items that follow their What's On listing: what the web asks the database for, what the manage screen
 * offers, and the promises the migration itself has to keep.
 * Run: node --test tests/edition-session-links.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { sessionWhere } from "../lib/editions/types.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

/** The paired backend migration, if the sibling checkout is here. Skipped honestly when it is not. */
const MIGRATION = "20270307000000_edition_sessions_linked_events.sql";
function migration() {
  const base = new URL("../../", import.meta.url).pathname;
  for (const d of readdirSync(base).filter((n) => n.startsWith("oneshetland-be"))) {
    const p = `${base}${d}/supabase/migrations/${MIGRATION}`;
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return null;
}

describe("where a programme item is", () => {
  const base = { id: "s1", edition_id: "e1", title: "T", description: null, starts_at: "2026-12-05T15:00:00Z", ends_at: null, venue_id: null, kind: "event", ticket_mode: "none", ticket_url: null, price_text: null, status: "scheduled", position: 0 };

  test("the Edition's own venue wins", () => {
    assert.equal(sessionWhere({ ...base, venue_text: "Market Cross, Lerwick" }, { name: "ZZ Hall", address: "Lerwick" }), "ZZ Hall, Lerwick");
  });
  test("otherwise the linked event's own words are used", () => {
    assert.equal(sessionWhere({ ...base, venue_text: "Market Cross, Lerwick" }, null), "Market Cross, Lerwick");
  });
  test("and an item with neither says nothing rather than something empty", () => {
    assert.equal(sessionWhere(base, null), null);
    assert.equal(sessionWhere({ ...base, venue_text: "   " }, null), null);
  });
});

describe("the web never writes the mirrored fields itself", () => {
  test("linking and unlinking go through the database functions", () => {
    const src = code("app/organise/actions.ts");
    assert.match(src, /rpc\("edition_session_link_event", \{ p_session: sessionId, p_event: eventId \}\)/);
    assert.match(src, /rpc\("edition_session_unlink_event", \{ p_session: sessionId \}\)/);
    assert.match(src, /rpc\("edition_linkable_events"/);
  });

  test("and every one of them checks the caller is an editor first", () => {
    const src = code("app/organise/actions.ts");
    for (const fn of ["linkSessionToEvent", "unlinkSessionFromEvent", "linkableEvents"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`), src.indexOf(`export async function ${fn}`) + 700);
      assert.match(body, /editionCtx\(slug, editionSlugArg, "editor"\)/, fn);
    }
  });

  test("the only thing ever written to a session is what sessionFields built", () => {
    const src = code("app/organise/actions.ts");
    const writes = [...src.matchAll(/from\("edition_sessions"\)\.(insert|update)\(([^;]*?)\)\s*\./g)].map((m) => m[2]);
    assert.ok(writes.length >= 2, "both the insert and the update were found");
    for (const w of writes) {
      for (const col of ["event_id", "venue_text", "event_status", "linked_at", "event_detached_at", "organiser_status"]) {
        assert.ok(!w.includes(col), `a session write must not set ${col}: ${w}`);
      }
    }
  });

  test("and sessionFields cannot produce a mirrored column even by accident", () => {
    const src = code("lib/editions/validate.ts");
    const fn = src.slice(src.indexOf("export function sessionFields"));
    const ret = fn.slice(fn.indexOf("return { ok: true, value:"), fn.indexOf("return { ok: true, value:") + 900);
    for (const col of ["event_id", "venue_text", "event_status", "linked_at", "event_detached_at", "organiser_status"]) {
      assert.ok(!ret.includes(col), `sessionFields must not build ${col}`);
    }
  });

  test("the session save path is untouched, so independent items work exactly as before", () => {
    const src = code("app/organise/actions.ts");
    assert.match(src, /from\("edition_sessions"\)\.insert\(\{ \.\.\.v\.value, edition_id: c\.edition\.id \}\)/);
    assert.match(src, /from\("edition_sessions"\)\.update\(v\.value\)/);
  });
});

describe("the manage screen", () => {
  const src = read("components/editions-manage/ProgrammeManager.tsx");

  test("offers a link for an unlinked item and an unlink for a linked one", () => {
    assert.match(src, /s\.event_id\s*\n?\s*\?\s*<button[^>]*onClick=\{\(\) => unlink\(s\)\}/);
    assert.match(src, /: <button[^>]*onClick=\{\(\) => openPicker\(s\)\}/);
  });

  test("says what following a listing means, and what it leaves alone", () => {
    assert.match(src, /follow that listing/);
    assert.match(src, /description, photograph, price note and running order stay/);
  });

  test("the mirrored fields are read-only, not disabled, so they still post", () => {
    for (const id of ["s-title", "s-start", "s-end"]) {
      const i = src.indexOf(`id="${id}"`);
      assert.ok(i > 0, id);
      const field = src.slice(i, i + 400);
      assert.match(field, /readOnly=\{draft\.linked\}/, id);
      assert.ok(!/disabled=\{draft\.linked\}/.test(field), `${id} must not be disabled`);
    }
  });

  test("a detached item is called out rather than left looking current", () => {
    assert.match(src, /s\.event_detached_at &&/);
    assert.match(src, /last details we had/);
  });

  test("unlinking asks first, and says what it will and will not do", () => {
    assert.match(src, /Stop following What's On for/);
    assert.match(src, /keeps the details it is showing now, but will not change again/);
  });
});

describe("the public pages show the linked event's place", () => {
  test("on the card, the Edition's venue still wins", () => {
    const src = code("components/editions/SessionCard.tsx");
    assert.match(src, /const where = venue \? null : s\.venue_text\?\.trim\(\) \|\| null;/);
    assert.match(src, /\{where && <span>\{where\}<\/span>\}/);
  });
  test("on the item's own page", () => {
    assert.match(code("app/editions/[slug]/programme/[item]/page.tsx"), /\(s\.venue_text\?\.trim\(\) \|\| null\)/);
  });
  test("and in the calendar file", () => {
    assert.match(code("app/editions/[slug]/calendar.ics/route.ts"), /s\.venue_text\?\.trim\(\) \|\| null/);
  });
});

describe("the migration behind it", { skip: migration() ? false : `${MIGRATION} not in a sibling checkout` }, () => {
  const sql = migration() ?? "";

  test("the event is the authority: the five shared fields are written by trigger", () => {
    assert.match(sql, /create trigger events_sync_edition_sessions after update on public\.events/);
    for (const f of ["title", "starts_at", "ends_at", "venue_text", "event_status"]) assert.ok(sql.includes(f), f);
  });

  test("a linked item cannot be edited out of step, whoever writes it", () => {
    assert.match(sql, /create trigger aa_edition_sessions_mirror before insert or update on public\.edition_sessions/);
    assert.match(sql, /new\.title\s+:= e\.title;/);
    assert.match(sql, /new\.starts_at\s+:= e\.starts_at;/);
  });

  test("the sync costs nothing when nothing shared changed", () => {
    assert.match(sql, /when \(old\.title is distinct from new\.title/);
    assert.match(sql, /create index if not exists edition_sessions_event_idx/);
  });

  test("a deleted event detaches the item instead of removing it", () => {
    assert.match(sql, /create trigger events_detach_edition_sessions before delete on public\.events/);
    assert.match(sql, /set event_id\s+= null,/);
    assert.match(sql, /event_detached_at = now\(\)/);
    assert.ok(!/delete from public\.edition_sessions/.test(sql), "nothing in the programme is ever deleted by this");
  });

  test("a cancelled event shows as cancelled without losing the organiser's own decision", () => {
    assert.match(sql, /when p_event_status = 'cancelled' then 'cancelled'/);
    assert.match(sql, /when p_event_status = 'postponed' then 'changed'/);
    assert.match(sql, /organiser_status/);
  });

  test("linking is not a way into somebody else's event", () => {
    assert.match(sql, /edition_controls_subject\('event', null, p_event, null\)/);
    assert.match(sql, /l\.state = 'approved'/);
    assert.match(sql, /edition_staff\(\) and exists .*is_platform_event/s);
    assert.match(sql, /revoke all on function public\.edition_session_link_event/);
  });

  test("the backfill refuses to guess", () => {
    assert.match(sql, /c\.per_session = 1 and c\.per_event = 1/);
    assert.match(sql, /where s\.event_id is null and s\.event_detached_at is null/);
  });

  test("an independent item is still a first-class programme item", () => {
    assert.match(sql, /an unlinked session is still a first-class/i);
    assert.match(sql, /if new\.event_id is null and \(tg_op = 'INSERT' or new\.starts_at is distinct from old\.starts_at\) then/);
  });

  test("it carries its own post-checks and a rollback", () => {
    assert.match(sql, /post-check: % linked session\(s\) disagree with their event/);
    const base = new URL("../../", import.meta.url).pathname;
    const found = readdirSync(base).filter((n) => n.startsWith("oneshetland-be"))
      .some((d) => existsSync(`${base}${d}/supabase/rollbacks/20270307000000_edition_sessions_linked_events.rollback.sql`));
    assert.ok(found, "a rollback is written");
  });
});
