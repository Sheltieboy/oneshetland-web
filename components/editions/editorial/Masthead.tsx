import type { ReactNode } from "react";
import Link from "next/link";
import { PHASE_LABEL, type Phase } from "@/lib/editions/rules";
import { responsiveImage } from "@/lib/editions/images";

/** The logo plate: the logo always sits on paper, so a dark or coloured logo is never lost on a photograph. With no logo, a monogram of the name stands in. */
export function Plate({ name, logo, label, href, textless = false }: { name: string; logo: string | null; label: string; href?: string; textless?: boolean }) {
  const inner = (
    <>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" />
      ) : (
        <span aria-hidden="true" className="ed-plate__mono">{name.trim().slice(0, 1).toUpperCase()}</span>
      )}
      {textless ? <span className="sr-only">{label}: {name}</span> : <span className="ed-plate__text"><small>{label}</small><strong>{name}</strong></span>}
    </>
  );
  return href ? <Link href={href} className="ed-plate">{inner}</Link> : <div className="ed-plate">{inner}</div>;
}

/**
 * The masthead: a full-bleed cover photograph (or, without one, a tonal field with the date set as a large outline numeral), a scrim of the brand's deep tone
 * so type always passes contrast, the organiser's logo plate, the title (the page's single h1), dates and an optional call to action.
 * Used for Editions and for the organiser's own page, so both carry the same identity.
 */
export function Masthead({ title, eyebrow, line, dateLabel, ghost, cover, focus, plate, backHref, backLabel, phase, cta, short = false, as: Title = "h1" }: {
  title: string; eyebrow?: string; line?: string | null; dateLabel?: string; ghost?: string; cover: string | null; focus: string;
  plate: ReactNode; backHref?: string; backLabel?: string; phase?: Phase; cta?: ReactNode; short?: boolean; /** "p" for a non-semantic preview (the dashboard page already has its own h1). */ as?: "h1" | "p";
}) {
  return (
    <header className={`ed-mast${short ? " ed-mast--short" : ""}`}>
      {cover ? (
        <>
          <div className="ed-mast__media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...responsiveImage(cover, "100vw")} alt="" fetchPriority="high" decoding="async" style={{ objectPosition: focus }} />
          </div>
          <div className="ed-mast__scrim" aria-hidden="true" />
        </>
      ) : (
        <>
          <div className="ed-mast__field" aria-hidden="true" />
          {ghost && <span className="ed-mast__ghost" aria-hidden="true">{ghost}</span>}
        </>
      )}
      <div className="ed-wrap ed-mast__top">
        {plate}
        {backHref && <Link href={backHref} className="ed-mast__back"><span aria-hidden="true">←</span> <span className="ed-mast__backtext">{backLabel ?? "All Editions"}</span></Link>}
      </div>
      <div className="ed-wrap ed-mast__body">
        {(eyebrow || phase) && (
          <p className="ed-eyebrow" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem", margin: 0 }}>
            {phase && <span className={`ed-pill${phase === "running" ? " ed-pill--live" : ""}`}>{PHASE_LABEL[phase]}</span>}
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <Title className="ed-display ed-mega ed-mast__title">{title}</Title>
        {(dateLabel || line) && (
          <div className="ed-mast__meta">
            {dateLabel && <p className="ed-mast__date" style={{ margin: 0 }}>{dateLabel}</p>}
          </div>
        )}
        {line && <p className="ed-mast__line">{line}</p>}
        {cta && <div className="ed-mast__cta">{cta}</div>}
      </div>
    </header>
  );
}
