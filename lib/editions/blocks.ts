/**
 * Editorial blocks for Edition pages.
 *
 * An Edition page body is still the same small, safe markdown. This adds a handful of *named sections*
 * on top, so a page can be laid out like a magazine spread instead of a column of prose:
 *
 *   ::: lede
 *   One or two sentences, set large.
 *   :::
 *
 *   ::: band src=https://… align=centre
 *   ## A headline over a full-width photograph
 *   A line beneath it.
 *   :::
 *
 *   ::: split src=https://… side=left caption="Shop windows on the Street"
 *   ## Text beside a picture
 *   :::
 *
 *   ::: figure src=https://… ratio=16x9 caption="…"
 *   ::: cards
 *   - [What's On](/editions/x/whats-on) — markets, concerts and the lights
 *   :::
 *   ::: cta href=/whats-on/add label="Add your event"
 *   Everything here is free.
 *   :::
 *
 * COMPATIBILITY. A body with none of these parses exactly as before and renders as one prose column:
 * `parseEditorial` returns a single { t: "prose" } run. Nothing about the existing markdown changes.
 *
 * SAFETY. Every value is data, never markup: the renderer builds React elements, so no HTML string is
 * ever injected. `src` and `href` must pass the existing safeHref (https:// or a site path); anything
 * else drops the attribute rather than trusting it. `ratio`, `side` and `align` come from allowlists.
 * An unknown block name degrades to plain prose, and an unterminated block closes at the end of input,
 * so a typo can never swallow the rest of a page.
 */
import { parseMarkdown, safeHref, type Block } from "./markdown";
import { normaliseFocus } from "./brand";

export type Ratio = "16x9" | "4x3" | "3x4" | "1x1";
const RATIOS: Ratio[] = ["16x9", "4x3", "3x4", "1x1"];
const SIDES = ["left", "right"] as const;
const ALIGNS = ["start", "centre"] as const;

export type Card = { title: string; href: string | null; blurb: string | null };
export type Section =
  | { t: "prose"; blocks: Block[] }
  | { t: "lede"; blocks: Block[] }
  | { t: "figure"; src: string; alt: string; caption: string | null; ratio: Ratio; focus: string }
  | { t: "band"; src: string | null; alt: string; align: "start" | "centre"; focus: string; blocks: Block[] }
  | { t: "split"; src: string; alt: string; caption: string | null; side: "left" | "right"; focus: string; blocks: Block[] }
  | { t: "cards"; items: Card[] }
  | { t: "cta"; href: string | null; label: string | null; blocks: Block[] };

/** `key=value` or `key="value with spaces"`, repeated. Unknown keys are ignored. */
function attrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-z]+)=(?:"([^"\n]{0,300})"|([^\s"]{1,500}))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out[m[1]] = (m[2] ?? m[3] ?? "").trim();
  return out;
}
const url = (v: string | undefined) => (v && safeHref(v) ? v : null);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
const text = (v: string | undefined, max = 300) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** "- [Title](href) — blurb", "- [Title](href)" or "- Title — blurb". The dash may be em, en or hyphen. */
function parseCards(body: string): Card[] {
  const items: Card[] = [];
  for (const raw of body.split("\n")) {
    const li = /^\s*[-*]\s+(.+)$/.exec(raw.trimEnd());
    if (!li) continue;
    const rest = li[1].trim();
    const link = /^\[([^\]]{1,200})\]\(([^)\s]{1,500})\)\s*(?:[—–-]\s*(.*))?$/.exec(rest);
    if (link) items.push({ title: link[1].trim(), href: url(link[2]), blurb: text(link[3], 240) });
    else {
      // a link whose target was refused still shows its words, never its raw markdown
      const bare = rest.replace(/\[([^\]]{1,200})\]\([^)]*\)?\)?/g, "$1").trim();
      const plain = /^(.*?)\s*[—–-]\s*(.*)$/.exec(bare);
      items.push(plain ? { title: plain[1].trim(), href: null, blurb: text(plain[2], 240) }
                       : { title: bare.slice(0, 200), href: null, blurb: null });
    }
  }
  return items.filter((c) => c.title.length > 0).slice(0, 12);
}

/**
 * Does this body actually use blocks? Used by the Edition routes to decide whether to render the
 * long-standing single-column layout (unchanged, for every page written before blocks existed) or
 * the editorial one. A body that only looks like it has blocks — ":::" inside a sentence — parses to
 * a single prose run and answers false, so nothing changes for it either.
 */
export function hasEditorialBlocks(source: string | null | undefined): boolean {
  if (!source || !source.includes(":::")) return false;
  const s = parseEditorial(source);
  return s.length > 1 || (s.length === 1 && s[0].t !== "prose");
}

export function parseEditorial(source: string | null | undefined): Section[] {
  const src = (source ?? "").replace(/\r/g, "");
  if (!src.includes(":::")) return src.trim() ? [{ t: "prose", blocks: parseMarkdown(src) }] : [];

  const out: Section[] = [];
  const lines = src.split("\n");
  let plain: string[] = [];
  const flush = () => {
    const body = plain.join("\n");
    plain = [];
    if (body.trim()) out.push({ t: "prose", blocks: parseMarkdown(body) });
  };

  for (let i = 0; i < lines.length; i++) {
    const open = /^:::\s*([a-z]+)\s*(.*)$/.exec(lines[i].trim());
    if (!open) { plain.push(lines[i]); continue; }
    // gather to the closing ":::" (or the end of the page, so a typo cannot swallow everything)
    const inner: string[] = [];
    let j = i + 1;
    for (; j < lines.length && lines[j].trim() !== ":::"; j++) inner.push(lines[j]);
    i = j;
    flush();
    const [name, a] = [open[1], attrs(open[2])];
    const body = inner.join("\n");
    const blocks = () => parseMarkdown(body);
    const alt = text(a.alt, 200) ?? "";
    // the same "x% y%" contract the Edition cover uses; anything else falls back to the centre
    const focus = normaliseFocus(a.focus);

    if (name === "lede") { out.push({ t: "lede", blocks: blocks() }); continue; }
    if (name === "figure") {
      const s = url(a.src);
      if (s) out.push({ t: "figure", src: s, alt, caption: text(a.caption), ratio: pick(a.ratio, RATIOS, "16x9"), focus });
      else if (body.trim()) out.push({ t: "prose", blocks: blocks() });
      continue;
    }
    if (name === "band") { out.push({ t: "band", src: url(a.src), alt, align: pick(a.align, ALIGNS, "centre"), focus, blocks: blocks() }); continue; }
    if (name === "split") {
      const s = url(a.src);
      if (s) out.push({ t: "split", src: s, alt, caption: text(a.caption), side: pick(a.side, SIDES, "left"), focus, blocks: blocks() });
      else out.push({ t: "prose", blocks: blocks() });
      continue;
    }
    if (name === "cards") { const items = parseCards(body); if (items.length) out.push({ t: "cards", items }); continue; }
    if (name === "cta") { out.push({ t: "cta", href: url(a.href), label: text(a.label, 60), blocks: blocks() }); continue; }
    // unknown name: never lose the words
    if (body.trim()) out.push({ t: "prose", blocks: blocks() });
  }
  flush();
  return out;
}
