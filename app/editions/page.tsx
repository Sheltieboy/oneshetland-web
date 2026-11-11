import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEditionsAccess, getEditionsEnabled, listPublicEditions, searchTerm } from "@/lib/editions/data.server";
import { phaseOf } from "@/lib/editions/rules";
import { KIND_LABEL, type EditionKind } from "@/lib/editions/types";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArchiveRow, EditionCard } from "@/components/editions/EditionCard";
import { DemoBanner } from "@/components/editions/DemoBanner";
import { BrandScope } from "@/components/editions/editorial/BrandScope";
import { derivePlatformBrand } from "@/lib/editions/brand";
import { PromotedRow } from "@/components/editions/PromotedRow";
import { getFeaturedEditions } from "@/lib/editions/promo-featured.server";
import { showPromotedRow } from "@/lib/editions/promo-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editions",
  description: "Festivals, events, seasons and campaigns in Shetland, each with its own programme and updates.",
  alternates: { canonical: "/editions" },
};

const KINDS = Object.keys(KIND_LABEL) as EditionKind[];

export default async function EditionsIndex({ searchParams }: { searchParams: Promise<{ kind?: string | string[]; q?: string | string[] }> }) {
  // While Editions ships dark the index does not exist for the public (members and staff can still see it).
  if (!(await getEditionsEnabled()) && !(await getEditionsAccess()).allowed) notFound();

  const sp = await searchParams;
  const raw = sp.kind;
  const q = searchTerm(Array.isArray(sp.q) ? sp.q[0] : sp.q);
  const kind = (Array.isArray(raw) ? raw[0] : raw) as EditionKind | undefined;
  const active = kind && KINDS.includes(kind) ? kind : undefined;

  // The "Promoted" row only appears on the plain list: a search or a kind filter hides it (and skips the read, so nothing is counted as shown).
  const [promoted, current, past] = await Promise.all([
    showPromotedRow({ q, kind: active ?? (kind ? String(kind) : null) }) ? getFeaturedEditions("discovery") : Promise.resolve([]),
    listPublicEditions({ kind: active, when: "upcoming", q }),
    listPublicEditions({ kind: active, when: "past", limit: 24, q }),
  ]);
  const onNow = current.filter((e) => phaseOf(e) === "running");
  const coming = current.filter((e) => phaseOf(e) !== "running");
  const brand = derivePlatformBrand(); // OneShetland's own navy on its cream paper: the index is the platform's page; each Edition's artwork carries its own brand
  const q$ = q ? `&q=${encodeURIComponent(q)}` : "";

  const front = (list: typeof current) => (
    <ul className="ed-front" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {list.map((e, i) => (
        <li key={e.id} className={`ed-cell${i === 0 ? " ed-cell--lead" : ""} ed-rise`}>
          <EditionCard edition={e} organiser={e.organiser} lead={i === 0} />
        </li>
      ))}
    </ul>
  );

  return (
    <BrandScope brand={brand}>
      <DemoBanner />
      <JsonLd data={breadcrumbSchema([{ name: "Editions", path: "/editions" }])} />
      <section className="ed-section ed-section--tight" style={{ paddingBottom: 0 }}>
        <div className="ed-wrap">
          <p className="ed-eyebrow ed-eyebrow--accent" style={{ margin: 0 }}>OneShetland Editions</p>
          <h1 className="ed-display ed-mega" style={{ margin: "1rem 0 0", maxWidth: "14ch" }}>Festivals, seasons and special weeks</h1>
          <p className="ed-lede ed-display" style={{ margin: "1.75rem 0 0", maxWidth: "30ch", color: "var(--ed-ink-2)" }}>
            Each Edition is run by a local organiser, with its own programme, venues and news.
          </p>
          <p className="ed-muted" style={{ margin: "1rem 0 0" }}>
            For everyday listings, see <Link href="/whats-on" className="ed-link">What&rsquo;s On</Link>.
          </p>
        </div>
      </section>

      <div className="ed-wrap" style={{ marginTop: "clamp(2rem, 5vw, 4rem)" }}>
        <div className="ed-find">
          <nav aria-label="Filter by kind">
            <ul className="ed-kinds">
              <li><Link href={q ? `/editions?q=${encodeURIComponent(q)}` : "/editions"} aria-current={!active ? "page" : undefined}>All</Link></li>
              {KINDS.map((k) => <li key={k}><Link href={`/editions?kind=${k}${q$}`} aria-current={active === k ? "page" : undefined}>{KIND_LABEL[k]}</Link></li>)}
            </ul>
          </nav>
          <form role="search" action="/editions" method="get">
            {active && <input type="hidden" name="kind" value={active} />}
            <label htmlFor="ed-q" className="sr-only">Search Editions</label>
            <input id="ed-q" name="q" type="search" defaultValue={q} maxLength={60} placeholder="Search festivals, seasons and weeks" />
            <button type="submit">Search</button>
          </form>
        </div>
      </div>

      <div className="ed-section ed-section--tight">
        <div className="ed-wrap" style={{ display: "grid", gap: "var(--ed-section)" }}>
          {current.length === 0 && past.length === 0 ? (
            <section aria-labelledby="empty-h" style={{ maxWidth: "40rem" }}>
              <h2 id="empty-h" className="ed-display ed-h2" style={{ margin: 0 }}>{q ? `Nothing found for \u201c${q}\u201d` : active ? `No ${KIND_LABEL[active].toLowerCase()} Editions right now` : "No Editions listed right now"}</h2>
              <p style={{ margin: "1rem 0 0" }}>{q ? "Try a shorter search, or clear it to see everything." : "Editions appear here once an organiser publishes one. Nothing is scheduled at the moment."}</p>
              <p style={{ display: "flex", flexWrap: "wrap", gap: "0 2rem", margin: "1rem 0 0" }}>
                {(active || q) && <Link href="/editions" className="ed-arrow">Clear search and filters</Link>}
                <Link href="/whats-on" className="ed-arrow">Browse What&rsquo;s On <span aria-hidden="true">→</span></Link>
              </p>
            </section>
          ) : (
            <>
              <PromotedRow items={promoted} />
              {onNow.length > 0 && (
                <section aria-labelledby="now-h">
                  <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">Happening</p><h2 id="now-h" className="ed-display ed-h2" style={{ margin: 0 }}>On now</h2></div></div>
                  {front(onNow)}
                </section>
              )}
              {coming.length > 0 && (
                <section aria-labelledby="soon-h">
                  <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">Save the date</p><h2 id="soon-h" className="ed-display ed-h2" style={{ margin: 0 }}>Coming up</h2></div></div>
                  {front(coming)}
                </section>
              )}
              {current.length === 0 && <p className="ed-muted">Nothing is on or coming up at the moment.</p>}
              {past.length > 0 && (
                <section aria-labelledby="past-h">
                  <div className="ed-head"><div><p className="ed-eyebrow" aria-hidden="true">The archive</p><h2 id="past-h" className="ed-display ed-h2" style={{ margin: 0 }}>Past Editions ({past.length})</h2></div></div>
                  <ul className="ed-archive">{past.map((e) => <ArchiveRow key={e.id} edition={e} organiser={e.organiser} />)}</ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </BrandScope>
  );
}
