import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A deliberately small, safe Markdown renderer for Almanac article bodies —
 * enough for AI-drafted / human-edited prose without pulling in a dependency or
 * using dangerouslySetInnerHTML. Supports: ## / ### headings, paragraphs,
 * "- " bullet lists, **bold**, and [text](url) links (internal links use Next Link).
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** and [text](url), preserving order.
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>);
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      const [, label, href] = lm;
      nodes.push(
        href.startsWith("/")
          ? <Link key={`${keyBase}-l${i}`} href={href} className="font-semibold text-teal-dark underline underline-offset-2 hover:text-teal">{label}</Link>
          : <a key={`${keyBase}-l${i}`} href={href} rel="nofollow" className="font-semibold text-teal-dark underline underline-offset-2 hover:text-teal">{label}</a>,
      );
    }
    last = m.index + tok.length; i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-5 text-lg leading-relaxed text-ink">
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) return <h3 key={i} className="pt-2 font-display text-xl font-bold text-navy">{inline(block.slice(4), `h3${i}`)}</h3>;
        if (block.startsWith("## ")) return <h2 key={i} className="pt-3 font-display text-2xl font-bold text-navy">{inline(block.slice(3), `h2${i}`)}</h2>;
        if (block.split("\n").every((l) => /^[-*]\s+/.test(l.trim()))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6">
              {block.split("\n").map((l, j) => <li key={j}>{inline(l.trim().replace(/^[-*]\s+/, ""), `li${i}-${j}`)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{inline(block, `p${i}`)}</p>;
      })}
    </div>
  );
}
