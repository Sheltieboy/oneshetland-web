/**
 * A deliberately small, SAFE markdown subset for Edition pages: headings (## ###), paragraphs, bullet lists, **bold**, *italic*, and links.
 * It returns a plain data structure; the renderer builds React elements from it, so no HTML string is ever injected. Link targets must be
 * https:// or a site path; anything else is rendered as plain text. Raw HTML in the source is shown as text, never interpreted.
 */
export type Inline = { t: "text"; v: string } | { t: "strong"; v: string } | { t: "em"; v: string } | { t: "link"; v: string; href: string };
export type Block = { t: "h2" | "h3" | "p"; inline: Inline[] } | { t: "ul"; items: Inline[][] };

const SAFE_HREF = /^(https:\/\/[^\s<>"'\\]+|\/(?!\/)[^\s<>"'\\]*)$/;
export const safeHref = (h: string) => SAFE_HREF.test(h);

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)|\*\*([^*\n]{1,300})\*\*|\*([^*\n]{1,300})\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push(safeHref(m[2]) ? { t: "link", v: m[1], href: m[2] } : { t: "text", v: m[0] });
    else if (m[3] !== undefined) out.push({ t: "strong", v: m[3] });
    else out.push({ t: "em", v: m[4] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let list: Inline[][] | null = null, para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ t: "p", inline: parseInline(para.join(" ")) }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ t: "ul", items: list }); list = null; } };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) { flushPara(); flushList(); blocks.push({ t: h[1].length === 2 ? "h2" : "h3", inline: parseInline(h[2]) }); continue; }
    const li = /^\s*[-*]\s+(.+)$/.exec(line);
    if (li) { flushPara(); (list ??= []).push(parseInline(li[1])); continue; }
    flushList(); para.push(line.trim());
  }
  flushPara(); flushList();
  return blocks;
}
