/**
 * enrich-run.ts — the enrichment pipeline with every outside edge INJECTED: read the site, confirm the pictures, ask the
 * model, check its answer. It returns data; it writes nothing. The server file supplies the real edges (safe page fetch,
 * image fetch, the Anthropic call, the quota) and does the one database write; the tests supply stubs, so the whole
 * decision logic is exercised without a network, a model or a database.
 *
 * Order matters, and is part of the contract:
 *   1. read the site (robots.txt honoured)                     — can fail: nothing else has happened
 *   2. is there enough readable text?                          — if not, STOP: no quota spent, the model is never called
 *   3. confirm the candidate pictures                          — failures simply drop that picture
 *   4. claim an AI request from the quota                      — fail closed
 *   5. ask the model                                           — can fail: nothing has been written
 *   6. check its answer against what was read                  — unsupported claims are dropped, not trusted
 */
import { extractPage, chooseLinks, type ExtractedPage } from "./source-extract.ts";
import { robotsAllows, SourceFetchError, type RobotsRules } from "./source-fetch.ts";
import { MIN_SOURCE_CHARS, SYSTEM_PROMPT, buildUserPrompt, verifyProposal, type PageNote, type SourceBundle, type VerifiedImage, type Verified, type PromptContext } from "./enrich-core.ts";
import { hostLabel } from "./source-url.ts";

export interface RunDeps {
  fetchPage: (url: string) => Promise<{ finalUrl: string; text: string }>;
  robots: (origin: string) => Promise<RobotsRules | null>;
  verifyImage: (url: string) => Promise<{ mime: string; bytes: number; sha256: string }>;
  claimQuota: () => Promise<void>;
  propose: (system: string, user: string) => Promise<unknown>;
}

export type FailCode = "robots" | "fetch_failed" | "not_enough_source" | "quota" | "model_failed" | "not_enough_confirmed";
export type RunOutcome =
  | { ok: true; bundle: SourceBundle; verified: Extract<Verified, { enough: true }> }
  | { ok: false; code: FailCode; message: string; bundle?: SourceBundle };

export class QuotaError extends Error { constructor(message: string) { super(message); this.name = "QuotaError"; } }

export const MAX_EXTRA_PAGES = 4;
export const MAX_IMAGE_CANDIDATES = 12;
const MIN_IMAGE_BYTES = 6_000;

export async function gatherBundle(startUrl: string, deps: RunDeps): Promise<{ ok: true; bundle: SourceBundle } | { ok: false; code: "robots" | "fetch_failed"; message: string; bundle?: SourceBundle }> {
  const start = new URL(startUrl);
  let rules: RobotsRules | null;
  try { rules = await deps.robots(start.origin); }
  catch (e) { return { ok: false, code: "robots", message: e instanceof SourceFetchError ? e.message : "The website's robots.txt could not be read, so it was not read." }; }
  const notes: PageNote[] = [];
  if (!robotsAllows(rules, `${start.pathname}${start.search}`)) return { ok: false, code: "robots", message: "The website's robots.txt asks automated tools not to read this page, so it was not read. Use a different page, or add the content by hand." };

  let home: ExtractedPage;
  try {
    const r = await deps.fetchPage(start.toString());
    home = extractPage(r.text, r.finalUrl);
    notes.push({ url: r.finalUrl, status: "ok", chars: home.text.length });
  } catch (e) {
    const msg = e instanceof SourceFetchError ? e.message : "The website could not be read.";
    return { ok: false, code: "fetch_failed", message: `${msg} Check the address, or try again in a moment.`, bundle: { startUrl, host: hostLabel(startUrl), pages: [], notes: [{ url: startUrl, status: "failed", detail: msg }], images: [] } };
  }
  const pages: ExtractedPage[] = [home];

  const extra = chooseLinks(home, home.url, MAX_EXTRA_PAGES);
  const allowed = extra.filter((u) => { const x = new URL(u); const ok = robotsAllows(rules, `${x.pathname}${x.search}`); if (!ok) notes.push({ url: u, status: "skipped", detail: "robots.txt" }); return ok; });
  const settled = await Promise.allSettled(allowed.map((u) => deps.fetchPage(u)));
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") { const p = extractPage(s.value.text, s.value.finalUrl); pages.push(p); notes.push({ url: s.value.finalUrl, status: "ok", chars: p.text.length }); }
    else notes.push({ url: allowed[i], status: "failed", detail: s.reason instanceof SourceFetchError ? s.reason.message : "could not be read" });
  });

  // candidate pictures: og/structured first, then body pictures, one per address, from the pages that were read
  const seen = new Set<string>(); const cands: { url: string; alt: string; pageUrl: string }[] = [];
  for (const from of ["og", "jsonld", "img"] as const) for (const p of pages) for (const im of p.images) {
    if (im.from !== from) continue;
    const key = im.url.split("?")[0];
    if (seen.has(key)) continue; seen.add(key);
    if (cands.length < MAX_IMAGE_CANDIDATES) cands.push({ url: im.url, alt: im.alt, pageUrl: p.url });
  }
  const checks = await Promise.allSettled(cands.map((c) => deps.verifyImage(c.url)));
  const images: VerifiedImage[] = [];
  checks.forEach((c, i) => { if (c.status === "fulfilled" && c.value.bytes >= MIN_IMAGE_BYTES) images.push({ id: `i${images.length + 1}`, url: cands[i].url, alt: cands[i].alt, pageUrl: cands[i].pageUrl, mime: c.value.mime, bytes: c.value.bytes, sha256: c.value.sha256 }); });

  return { ok: true, bundle: { startUrl, host: hostLabel(startUrl), pages, notes, images } };
}

export async function runEnrichment(
  input: { businessName: string; startUrl: string; directory: PromptContext["directory"] },
  deps: RunDeps,
): Promise<RunOutcome> {
  const g = await gatherBundle(input.startUrl, deps);
  if (!g.ok) return g;
  const chars = g.bundle.pages.reduce((n, p) => n + p.text.length + p.description.length, 0);
  if (chars < MIN_SOURCE_CHARS) {
    return { ok: false, code: "not_enough_source", bundle: g.bundle, message: "We don't have enough public information to build this automatically. The website shows very little readable text (some sites build their pages in the browser, which can't be read). Try a different page, or add the content by hand." };
  }
  try { await deps.claimQuota(); }
  catch (e) { return { ok: false, code: "quota", bundle: g.bundle, message: e instanceof QuotaError ? e.message : "Peerie Bot is unavailable right now — try again shortly." }; }

  let raw: unknown;
  try { raw = await deps.propose(SYSTEM_PROMPT, buildUserPrompt({ businessName: input.businessName, directory: input.directory, bundle: g.bundle })); }
  catch { return { ok: false, code: "model_failed", bundle: g.bundle, message: "Peerie Bot had a moment and couldn't finish the draft. Nothing was changed — try again." }; }

  const verified = verifyProposal(raw, g.bundle, input.directory.description);
  if (!verified.enough) return { ok: false, code: "not_enough_confirmed", bundle: g.bundle, message: verified.reason };
  return { ok: true, bundle: g.bundle, verified };
}
