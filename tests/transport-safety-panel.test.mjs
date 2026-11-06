/**
 * Event pages: while our stored timetables are out of date and unlicensed, the journey planner is OFF behind one flag and a calm official-links panel
 * is shown instead. Run: node --test tests/transport-safety-panel.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const page = read("app/whats-on/[id]/page.tsx");
const panel = read("components/events/GettingThereLinks.tsx");

test("one flag, off: lib/transport-flags.ts exports TRANSPORT_PLANNER_ENABLED = false", () => {
  assert.match(read("lib/transport-flags.ts"), /export const TRANSPORT_PLANNER_ENABLED = false;/);
});
test("the event page shows the planner only when the flag is on, and the official-links panel otherwise", () => {
  assert.match(page, /isLive && eventArea \? \(\s*TRANSPORT_PLANNER_ENABLED\s*\? <TravelPlanner[^>]*\/>\s*: <GettingThereLinks \/>\s*\) : null/);
  assert.equal((page.match(/<TravelPlanner/g) ?? []).length, 1, "the planner is rendered in exactly one place, behind the flag");
  assert.match(page, /import \{ TRANSPORT_PLANNER_ENABLED \} from "@\/lib\/transport-flags"/);
});
test("the panel links to the five official sources over HTTPS, on the operators' own domains", async () => {
  const urls = [...panel.matchAll(/href: "(https:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(urls, [
    "https://www.zettrans.org.uk/travel/public-transport/bus", "https://www.travelinescotland.com/", "https://www.shetland.gov.uk/ferries/timetable",
    "https://www.shetland.gov.uk/homepage/73/ferry-status", "https://www.northlinkferries.co.uk/book/routes-times-and-prices/timetables/", "https://www.northlinkferries.co.uk/opsnews/",
  ]);
  const hosts = new Set(urls.map((u) => new URL(u).hostname)); assert.deepEqual([...hosts].sort(), ["www.northlinkferries.co.uk", "www.shetland.gov.uk", "www.travelinescotland.com", "www.zettrans.org.uk"]);
});
test("external links open safely and say so to assistive technology", () => {
  assert.match(panel, /target="_blank"\s+rel="noopener noreferrer"/); assert.match(panel, /\(opens in a new tab\)/);
});
test("the panel shows no times and makes no claim that transport does or does not exist", () => {
  assert.doesNotMatch(panel, /\b\d{1,2}:\d{2}\b/, "no timetable times");
  assert.doesNotMatch(panel, /No bus|no ferry|drive or arrange|overnight stay|no ferry or bus needed|You're at the event/i);
  assert.match(panel, /Planning your journey\?/); assert.match(panel, /Find the latest timetables and travel updates directly from Shetland&apos;s transport operators\./);
  // Nothing public mentions outdated data, development work or future promises.
  const visible = panel.slice(panel.indexOf("export function GettingThereLinks"));
  assert.doesNotMatch(visible, /updating|update our|out of date|outdated|coming soon|new journey planner|we're working|we are working|in the meantime|soon\b|planner is/i);
  assert.doesNotMatch(visible, /error|sorry|unavailable|broken|failed/i, "it must not read like an error");
});
test("the stored timetables, the planner and the app are untouched by this change", () => {
  assert.ok(read("components/events/TravelPlanner.tsx").includes("planThere"));
  assert.ok(read("lib/transit-data.ts").includes("transit-network.json"));
});
