import { parseMarkdown, type Inline } from "@/lib/editions/markdown";
import { parseEditorial } from "@/lib/editions/blocks";

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

/**
 * Live preview of an Edition page, using the SAME parsers as the public page, so a ::: block never
 * shows as raw text while it is being written. Builds React elements only; no HTML is ever injected.
 */
export function MarkdownPreview({ source }: { source: string }) {
  const sections = parseEditorial(source);
  if (sections.some((s) => s.t !== "prose")) {
    return (
      <div className="space-y-4">
        {sections.map((s, i) => {
          if (s.t === "prose" || s.t === "lede") return <Body key={i} source={s.blocks} lede={s.t === "lede"} />;
          const label = { figure: "Photograph", band: "Full-width photograph", split: "Photograph beside text", cards: "Cards", cta: "Call to action" }[s.t];
          return (
            <section key={i} className="rounded-card border border-line bg-cream/40 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
              {"src" in s && s.src && <img src={s.src} alt="" className="mb-2 max-h-40 w-full rounded object-cover" />}
              {"items" in s && <ul className="list-disc space-y-1 pl-5 text-sm">{s.items.map((c, j) => <li key={j}><strong>{c.title}</strong>{c.blurb ? ` — ${c.blurb}` : ""}</li>)}</ul>}
              {"blocks" in s && <Body source={s.blocks} />}
              {"label" in s && s.label && <p className="mt-2 inline-block rounded-pill bg-navy px-3 py-1 text-xs font-semibold text-paper">{s.label}</p>}
            </section>
          );
        })}
      </div>
    );
  }
  const blocks = parseMarkdown(source);
  if (!blocks.length) return <p className="text-sm text-ink-muted">Nothing to preview yet.</p>;
  return <Body source={blocks} />;
}

function Body({ source, lede = false }: { source: ReturnType<typeof parseMarkdown>; lede?: boolean }) {
  const blocks = source;
  return (
    <div className={`space-y-3 leading-relaxed text-ink-soft ${lede ? "text-lg font-display text-ink" : "text-[15px]"}`}>
      {blocks.map((b, i) =>
        b.t === "h2" ? <h2 key={i} className="pt-2 font-display text-2xl font-bold text-ink"><Inl nodes={b.inline} /></h2>
        : b.t === "h3" ? <h3 key={i} className="pt-1 font-display text-lg font-bold text-ink"><Inl nodes={b.inline} /></h3>
        : b.t === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Inl nodes={it} /></li>)}</ul>
        : <p key={i}><Inl nodes={b.inline} /></p>,
      )}
    </div>
  );
}
