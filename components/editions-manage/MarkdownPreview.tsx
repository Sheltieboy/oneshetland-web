import { parseMarkdown, type Inline } from "@/lib/editions/markdown";

function Inl({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.t === "strong" ? <strong key={i}>{n.v}</strong>
        : n.t === "em" ? <em key={i}>{n.v}</em>
        : n.t === "link" ? <a key={i} href={n.href} className="font-semibold text-navy underline" target={n.href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer nofollow">{n.v}</a>
        : <span key={i}>{n.v}</span>,
      )}
    </>
  );
}

/** Live preview of an Edition page, using the same parser as the public page. Builds React elements only; no HTML is ever injected. */
export function MarkdownPreview({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  if (!blocks.length) return <p className="text-sm text-ink-muted">Nothing to preview yet.</p>;
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
      {blocks.map((b, i) =>
        b.t === "h2" ? <h2 key={i} className="pt-2 font-display text-2xl font-bold text-ink"><Inl nodes={b.inline} /></h2>
        : b.t === "h3" ? <h3 key={i} className="pt-1 font-display text-lg font-bold text-ink"><Inl nodes={b.inline} /></h3>
        : b.t === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inl nodes={it} /></li>)}</ul>
        : <p key={i}><Inl nodes={b.inline} /></p>,
      )}
    </div>
  );
}
