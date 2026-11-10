import type { ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/editions/markdown";

/**
 * Renders the organiser's pages. The text goes through lib/editions/markdown (a small safe subset) and comes out as React elements, so no HTML
 * string is ever injected. `level` is the heading level the source's "##" becomes, so a page can keep a clean outline under its own h2.
 * Typography comes entirely from the design system (.ed-prose); `dropcap` sets the first paragraph with an initial capital.
 */
function inline(parts: Inline[]): ReactNode[] {
  return parts.map((p, i) => {
    if (p.t === "strong") return <strong key={i}>{p.v}</strong>;
    if (p.t === "em") return <em key={i}>{p.v}</em>;
    if (p.t === "link") {
      const external = p.href.startsWith("https://");
      return (
        <a key={i} href={p.href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}>
          {p.v}{external && <span className="sr-only"> (opens in a new tab)</span>}
        </a>
      );
    }
    return <span key={i}>{p.v}</span>;
  });
}

export function Prose({ source, level = 3, className = "", dropcap = false }: { source: string | null | undefined; level?: 2 | 3 | 4; accent?: string; className?: string; dropcap?: boolean }) {
  const blocks = parseMarkdown(source ?? "");
  if (blocks.length === 0) return null;
  const first = blocks[0];
  const firstLen = first && first.t === "p" ? first.inline.map((x) => x.v).join("").length : 0;
  const cap = dropcap && firstLen >= 150; // an initial capital only suits a real opening paragraph, never a one-line summary
  const H = (n: number) => `h${Math.min(6, n)}` as "h2" | "h3" | "h4" | "h5";
  return (
    <div className={`ed-prose${cap ? " ed-dropcap" : ""} ${className}`.trim()}>
      {blocks.map((b, i) => {
        if (b.t === "p") return <p key={i}>{inline(b.inline)}</p>;
        if (b.t === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        const Tag = b.t === "h2" ? H(level) : H(level + 1);
        return <Tag key={i}>{inline(b.inline)}</Tag>;
      })}
    </div>
  );
}
