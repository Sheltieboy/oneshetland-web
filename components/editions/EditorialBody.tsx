import type { ReactNode } from "react";
import Link from "next/link";
import { responsiveImage } from "@/lib/editions/images";
import { parseEditorial, type Section } from "@/lib/editions/blocks";
import { ProseBlocks } from "./Prose";
import { EditionOutboundLink } from "./OutboundLink";

/**
 * An Edition page body, laid out as a magazine rather than a column of text.
 *
 * Prose runs stay inside the measured column; photographic bands break out to the full width; splits,
 * figures, cards and calls to action sit between them with the design system's own rhythm. A body with
 * no ::: blocks renders exactly as before — one prose column — so existing Edition pages are untouched.
 *
 * HEADINGS: the page h1 is the masthead, so every "##" in a body becomes h2 and "###" h3,
 * whichever section it sits in. Mixing levels per section made some pages skip h1 -> h3.
 *
 * Nothing here interpolates HTML: every value arrives as text, or as a URL already validated by
 * lib/editions/blocks against the same safeHref the links use. React escapes the rest.
 */
const RATIO = { "16x9": "ed-ratio-169", "4x3": "ed-ratio-43", "3x4": "ed-ratio-34", "1x1": "ed-ratio-11" } as const;

const Wrap = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <div className={`ed-wrap ${className}`.trim()}>{children}</div>;

function Figure({ s }: { s: Extract<Section, { t: "figure" }> }) {
  return (
    <Wrap className="ed-eb">
      <figure className="ed-eb__fig">
        <div className={`ed-img ${RATIO[s.ratio]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...responsiveImage(s.src, "(min-width: 62rem) 62rem, 100vw")} alt={s.alt} loading="lazy" decoding="async" style={{ objectPosition: s.focus }} />
        </div>
        {s.caption && <figcaption className="ed-eb__cap">{s.caption}</figcaption>}
      </figure>
    </Wrap>
  );
}

function Band({ s }: { s: Extract<Section, { t: "band" }> }) {
  return (
    <section className={`ed-eb__band${s.align === "centre" ? " ed-eb__band--centre" : ""}${s.src ? "" : " ed-eb__band--plain"}`}>
      {s.src && (
        <>
          <div className="ed-eb__bandmedia">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...responsiveImage(s.src, "100vw")} alt={s.alt} loading="lazy" decoding="async" style={{ objectPosition: s.focus }} />
          </div>
          <div className="ed-eb__bandscrim" aria-hidden="true" />
        </>
      )}
      <Wrap>
        <div className="ed-prose ed-eb__bandbody"><ProseBlocks blocks={s.blocks} level={2} /></div>
      </Wrap>
    </section>
  );
}

function Split({ s }: { s: Extract<Section, { t: "split" }> }) {
  return (
    <Wrap className="ed-eb">
      <div className={`ed-eb__split${s.side === "right" ? " ed-eb__split--right" : ""}`}>
        <figure className="ed-eb__splitfig">
          <div className="ed-img ed-ratio-34">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...responsiveImage(s.src, "(min-width: 48rem) 42vw, 100vw")} alt={s.alt} loading="lazy" decoding="async" style={{ objectPosition: s.focus }} />
          </div>
          {s.caption && <figcaption className="ed-eb__cap">{s.caption}</figcaption>}
        </figure>
        <div className="ed-prose ed-eb__splitbody"><ProseBlocks blocks={s.blocks} level={2} /></div>
      </div>
    </Wrap>
  );
}

function Cards({ s, editionId, page }: { s: Extract<Section, { t: "cards" }>; editionId?: string; page?: string }) {
  return (
    <Wrap className="ed-eb">
      <ul className="ed-eb__cards">
        {s.items.map((c, i) => {
          const inner = (
            <>
              <span className="ed-eb__cardtitle">{c.title}</span>
              {c.blurb && <span className="ed-eb__cardblurb">{c.blurb}</span>}
              {c.href && <span className="ed-eb__cardgo" aria-hidden="true">→</span>}
            </>
          );
          return (
            <li key={i} className="ed-eb__card">
              {c.href
                ? (editionId
                    ? <EditionOutboundLink href={c.href} editionId={editionId} page={page ?? "home"} block="cards" className="ed-eb__cardlink">{inner}</EditionOutboundLink>
                    : <Link href={c.href} className="ed-eb__cardlink">{inner}</Link>)
                : <div className="ed-eb__cardlink">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </Wrap>
  );
}

function Cta({ s, editionId, page }: { s: Extract<Section, { t: "cta" }>; editionId?: string; page?: string }) {
  return (
    <Wrap className="ed-eb">
      <div className="ed-eb__cta">
        <div className="ed-prose ed-eb__ctabody"><ProseBlocks blocks={s.blocks} level={2} /></div>
        {s.href && s.label && (editionId
          ? <EditionOutboundLink href={s.href} editionId={editionId} page={page ?? "home"} block="cards" className="ed-btn ed-btn--solid ed-eb__ctabtn">{s.label}</EditionOutboundLink>
          : <Link href={s.href} className="ed-btn ed-btn--solid ed-eb__ctabtn">{s.label}</Link>)}
      </div>
    </Wrap>
  );
}

export function EditorialBody({ source, dropcap = false, editionId, page }: { source: string | null | undefined; dropcap?: boolean; /** Supplied by the Edition routes so card links can be counted. Omit and they are plain links, exactly as before. */ editionId?: string; page?: string }) {
  const sections = parseEditorial(source);
  if (sections.length === 0) return null;
  const first = sections.findIndex((s) => s.t === "prose");
  return (
    <div className="ed-eb__root">
      {sections.map((s, i) => {
        switch (s.t) {
          case "prose":
            return (
              <Wrap key={i} className="ed-eb">
                <div className={`ed-prose${dropcap && i === first ? " ed-dropcap" : ""}`}><ProseBlocks blocks={s.blocks} level={2} /></div>
              </Wrap>
            );
          case "lede":
            return <Wrap key={i} className="ed-eb"><div className="ed-eb__lede"><ProseBlocks blocks={s.blocks} level={2} /></div></Wrap>;
          case "figure": return <Figure key={i} s={s} />;
          case "band": return <Band key={i} s={s} />;
          case "split": return <Split key={i} s={s} />;
          case "cards": return <Cards key={i} s={s} editionId={editionId} page={page} />;
          case "cta": return <Cta key={i} s={s} editionId={editionId} page={page} />;
        }
      })}
    </div>
  );
}
