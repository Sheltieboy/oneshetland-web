import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(p, "utf8");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

test("no link anywhere points at the dead /for-businesses route", () => {
  assert.equal(existsSync("app/for-businesses"), false, "route should not exist (it never did)");
  const hits = ["app", "components", "lib"].flatMap((d) => walk(d)).filter((f) => /href=["'`]\/for-businesses/.test(read(f)));
  assert.deepEqual(hits, []);
});

test("every route the trade-join panel links to exists", () => {
  const src = read("app/get-it-done/page.tsx");
  assert.match(src, /id="for-trades"/);
  assert.match(src, /Find and claim your listing/);
  for (const dir of ["app/business", "app/directory/new", "app/business/leads"]) assert.ok(existsSync(dir), dir);
  assert.match(read("lib/plan-cta.ts"), /FINDER_ANCHOR = "\/business#find-your-business"/);
});

test("the join panel is NOT gated on demand (it used to show only when jobs were waiting)", () => {
  const src = read("app/get-it-done/page.tsx");
  const panelUse = src.indexOf("<TradeJoinPanel />");
  assert.ok(panelUse > 0);
  const before = src.slice(0, panelUse);
  assert.ok(!/demand\.length > 0 && \(\s*$/.test(before.trimEnd()), "panel sits outside the demand block");
});

test("the public copy matches behaviour: no cap claim, no paid priority, customer shares details", () => {
  const all = read("app/get-it-done/page.tsx") + read("app/get-it-done/waiting/page.tsx") + read("app/business/[id]/manage/leads/page.tsx");
  assert.ok(!/first few/i.test(all));
  assert.ok(!/ring you directly/i.test(all));
  assert.match(all, /chooses? whether to share/i);
  assert.match(all, /promise work/);
  const nudge = read("lib/trades-data.ts").match(/const TIER_NUDGE[^\n]*\n?[^\n]*/g).join("");
  assert.match(nudge, /premium: 0, pro: 0, free: 0/);
});

test("the business hub links to Get it done: job leads, showing whether the business has joined", () => {
  const src = read("app/business/[id]/manage/page.tsx");
  assert.match(src, /Get it done: job leads/);
  assert.match(src, /Get it done: job leads/); assert.match(src, /Matching active/); assert.match(src, /Needs Pro/);
});

test("the leads page explains how it works until a trade profile is saved", () => {
  const src = read("app/business/[id]/manage/leads/page.tsx");
  assert.match(src, /How Get it done works for you/);
  assert.match(src, /trade_categories as string\[\] \| null\) \?\? \[\]\)\.length === 0/);
});

test("/business/leads explains itself instead of silently redirecting when the account has no business", () => {
  const src = read("app/business/leads/page.tsx");
  assert.ok(!/redirect\(id \? [^)]*: "\/business"\)/.test(src), "no silent fall-back redirect to /business");
  assert.match(src, /doesn&apos;t manage one yet/);
  assert.match(src, /administrator doesn&apos;t give access/);
  assert.match(src, /mine\.length === 1\) redirect\(`\/business\/\$\{mine\[0\]\.id\}\/manage\/leads`\)/);
  assert.match(src, /\.eq\("owner_id", account\.id\)/, "ownership still decides which businesses are offered");
});
