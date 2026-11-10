import type { EditionSponsor } from "@/lib/editions/types";

const isHttps = (u: string | null | undefined): u is string => !!u && /^https:\/\/[^\s<>"']+$/.test(u);

/**
 * Sponsors and partners: quiet, tiered by the organiser's own level names (in the order they first appear), logos set in one tone and blended onto the paper
 * so a mixed set of files looks like a single family. Linked only when the address is https; the first tier is set larger.
 */
export function SponsorStrip({ sponsors, title = "Partners and sponsors" }: { sponsors: EditionSponsor[]; title?: string }) {
  if (sponsors.length === 0) return null;
  const tiers: { level: string | null; items: EditionSponsor[] }[] = [];
  for (const s of sponsors) {
    const t = tiers.find((x) => x.level === (s.level?.trim() || null));
    if (t) t.items.push(s); else tiers.push({ level: s.level?.trim() || null, items: [s] });
  }
  return (
    <section aria-labelledby="edition-sponsors">
      <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">With thanks</p><h2 id="edition-sponsors" className="ed-display ed-h2" style={{ margin: 0 }}>{title}</h2></div></div>
      {tiers.map((t, ti) => (
        <div key={t.level ?? "all"} className={`ed-tier${ti === 0 && tiers.length > 1 ? " ed-tier--lead" : ""}`}>
          {t.level && <h3 className="ed-eyebrow ed-tier__label" style={{ margin: 0 }}>{t.level}</h3>}
          <ul className="ed-logos">
            {t.items.map((s) => {
              const tile = s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt={s.name} loading="lazy" decoding="async" fetchPriority="low" />
              ) : <span>{s.name}</span>;
              return (
                <li key={s.id}>
                  {isHttps(s.url) ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer sponsored" className="ed-logo">
                      {tile}<span className="sr-only">{s.logo_url ? `${s.name}, ` : ""}opens in a new tab</span>
                    </a>
                  ) : <div className="ed-logo">{tile}</div>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
