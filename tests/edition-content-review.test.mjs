/**
 * The stale-prose warning: that it only ever warns, what it links to, and the promises the migration keeps.
 * Run: node --test tests/edition-content-review.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const MIGRATION = "20270308000000_edition_content_review_notices.sql";
function backend(file) {
  const base = new URL("../../", import.meta.url).pathname;
  for (const d of readdirSync(base).filter((n) => n.startsWith("oneshetland-be"))) {
    const p = `${base}${d}/supabase/${file}`;
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return null;
}

describe("it warns, and does nothing else", () => {
  const panel = code("components/editions-manage/ContentReviewNotice.tsx");

  test("it never writes to a page or a session", () => {
    for (const p of ["components/editions-manage/ContentReviewNotice.tsx", "components/editions-manage/ContentReviewPanel.tsx"]) {
      const src = code(p);
      for (const bad of ["savePage", "saveSession", "deletePage", "edition_pages", "edition_sessions", ".update(", ".insert(", ".delete("]) {
        assert.ok(!src.includes(bad), `${p} must not ${bad}`);
      }
    }
  });

  test("the only thing it can change is whether the warning is shown", () => {
    const acts = [...panel.matchAll(/\b([a-zA-Z]+)\(organiserSlug, editionSlug/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(acts)], ["markContentNoticeChecked"]);
  });

  test("it renders nothing at all when there is nothing to say", () => {
    assert.match(panel, /if \(!notices\.length\) return null;/);
    assert.match(code("components/editions-manage/ContentReviewPanel.tsx"), /if \(!notices\.length\) return null;/);
  });

  test("it says the words are the organiser's and have been left alone", () => {
    assert.match(panel, /left exactly as you wrote it/);
    assert.match(panel, /may need a look/);
  });

  test("and it is honest that the match is a prompt, not a finding", () => {
    assert.match(panel, /a sentence can say it another way/);
  });

  test("a failure to read the warnings never breaks the screen", () => {
    const src = code("lib/editions/data.server.ts");
    const fn = src.slice(src.indexOf("export async function getContentReview"), src.indexOf("export async function getContentReview") + 500);
    assert.match(fn, /if \(error\) return \[\];/);
    assert.match(fn, /catch \{ return \[\]; \}/);
  });
});

describe("what it links to", () => {
  test("each page links into the page editor, at that page", () => {
    assert.match(code("components/editions-manage/ContentReviewNotice.tsx"), /\$\{pagesHref\}\?open=\$\{p\.id\}/);
    assert.match(code("components/editions-manage/ContentReviewNotice.tsx"), /\/organise\/\$\{organiserSlug\}\/editions\/\$\{editionSlug\}\/pages/);
  });

  test("and the page editor opens that page from the address", () => {
    const src = code("components/editions-manage/PageEditor.tsx");
    assert.match(src, /openPageId \? pages\.find\(\(x\) => x\.id === openPageId\) : null/);
    assert.match(src, /return p \? fromPage\(p\) : null;/);
    assert.match(code("app/organise/[slug]/editions/[edition]/pages/page.tsx"), /openPageId=\{typeof open === "string" \? open : null\}/);
  });

  test("it is decided on the server, so there is no effect and nothing to hydrate around", () => {
    const src = code("components/editions-manage/PageEditor.tsx");
    assert.ok(!/useEffect/.test(src), "no effect");
    assert.ok(!/window\.location/.test(src), "the address is read on the server, not in the browser");
    assert.match(code("app/organise/[slug]/editions/[edition]/pages/page.tsx"), /await searchParams/);
  });

  test("it is shown on every manage screen, through the shared header", () => {
    const src = code("components/editions-manage/EditionHeader.tsx");
    assert.match(src, /<ContentReviewPanel editionId=\{edition\.id\} organiserSlug=\{organiser\.slug\} editionSlug=\{edition\.slug\} \/>/);
  });
});

describe("the action", () => {
  const src = code("app/organise/actions.ts");
  test("checks the caller is an editor and goes through the database function", () => {
    const fn = src.slice(src.indexOf("export async function markContentNoticeChecked"), src.indexOf("export async function markContentNoticeChecked") + 700);
    assert.match(fn, /editionCtx\(slug, editionSlugArg, "editor"\)/);
    assert.match(fn, /rpc\("edition_content_notice_resolve", \{ p_notice: noticeId \}\)/);
    assert.ok(!/edition_pages/.test(fn), "it must not touch a page");
  });
});

describe("the migration behind it", { skip: backend(`migrations/${MIGRATION}`) ? false : `${MIGRATION} not in a sibling checkout` }, () => {
  const sql = backend(`migrations/${MIGRATION}`) ?? "";

  test("only a date, a time or a place raises one", () => {
    assert.match(sql, /moved := old\.starts_at is distinct from new\.starts_at/);
    assert.match(sql, /edition_event_place\(old\.venue, old\.locality\) is distinct from public\.edition_event_place\(new\.venue, new\.locality\)/);
    assert.ok(!/moved :=[\s\S]{0,200}old\.title is distinct from new\.title/.test(sql), "a title change must not raise one");
  });

  test("the synchronisation it extends still does its own job", () => {
    assert.match(sql, /venue_text   = public\.edition_event_place\(new\.venue, new\.locality\)/);
    assert.match(sql, /event_status = new\.status/);
    assert.match(sql, /post-check: the sync no longer mirrors the place/);
  });

  test("a second move keeps the oldest wording", () => {
    assert.match(sql, /on conflict \(session_id\) where resolved_at is null do update/);
    assert.ok(!/do update[\s\S]{0,200}set was_at/.test(sql), "`was_*` is never overwritten");
  });

  test("the cues are specific enough to be worth reading", () => {
    assert.match(sql, /Deliberately NO bare weekday/);
    assert.match(sql, /to_char\(d, 'FMDay'\) \|\| ' ' \|\| to_char\(d, 'FMDD'\)/);
    assert.match(sql, /p_at at time zone coalesce\(p_tz, 'Europe\/London'\)/);
  });

  test("nothing here can edit a page", () => {
    // The post-check below names the phrase in a string literal in order to forbid it, so judge by line.
    const writes = sql.split("\n").filter((l) => /(update|delete from)\s+public\.edition_pages/.test(l) && !/ilike|raise exception/.test(l));
    assert.deepEqual(writes, [], "no page is ever written");
    assert.match(sql, /post-check: the review must never edit a page/);
  });

  test("the warnings are private to the Edition's own team", () => {
    assert.match(sql, /using \(public\.edition_can\(edition_id, 'editor'\) or public\.edition_staff\(\)\)/);
    assert.match(sql, /revoke all on public\.edition_content_notices from public, anon, authenticated/);
    assert.match(sql, /post-check: notices must not be readable by anon/);
  });

  test("marking one checked keeps it, and records who", () => {
    assert.match(sql, /set resolved_at = now\(\), resolved_by = auth\.uid\(\)/);
    assert.ok(!/delete from public\.edition_content_notices/.test(sql));
  });

  test("it is re-runnable and has a rollback", () => {
    assert.match(sql, /drop policy if exists "edition_content_notices read"/);
    assert.ok(backend(`rollbacks/20270308000000_edition_content_review_notices.rollback.sql`), "a rollback is written");
  });
});
