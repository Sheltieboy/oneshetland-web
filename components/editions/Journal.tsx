import Link from "next/link";
import type { EditionUpdate } from "@/lib/editions/types";
import { responsiveImage } from "@/lib/editions/images";

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Plain-text excerpt of an organiser's update (their small markdown subset reduced to words), cut at a word boundary. */
export function excerpt(body: string, max: number): string {
  const text = body.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^[#>\-*\s]+/gm, "").replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function Item({ u, lead, base }: { u: EditionUpdate; lead: boolean; base: string }) {
  return (
    <li className={`ed-jitem${lead ? " ed-jitem--lead" : ""} ed-rise`}>
      <Link href={`${base}/updates#u-${u.id}`} className="ed-hover">
        {u.image_url && (
          <div className={`ed-img ${lead ? "ed-ratio-169" : "ed-ratio-43"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...responsiveImage(u.image_url, lead ? "(min-width: 62rem) 60vw, 100vw" : "(min-width: 62rem) 30vw, 100vw")} alt="" loading={lead ? "eager" : "lazy"} decoding="async" fetchPriority="low" />
          </div>
        )}
        <div className="ed-jbody">
          <p className="ed-entry__date" style={{ margin: 0 }}>
            {u.pinned && <span className="ed-tag">Pinned</span>}
            {u.published_at && <time dateTime={u.published_at}>{when(u.published_at)}</time>}
          </p>
          <h3 className="ed-jtitle"><span>{u.title}</span></h3>
          {u.body && <p className="ed-jexcerpt">{excerpt(u.body, lead ? 230 : 130)}</p>}
          <span className="ed-arrow" style={{ minHeight: "2rem" }}>Read more<span className="sr-only"> of {u.title}</span> <span aria-hidden="true">→</span></span>
        </div>
      </Link>
    </li>
  );
}

/**
 * The Journal: an Edition's latest news, announcements and stories, set editorially on the Edition's home page. The newest update leads (with its photograph when it has
 * one); up to two more sit beside it. It works the same for a one-off event with a single announcement and for an organisation that posts all year: with one update the
 * lead sits alone, and the full archive is one link away. Renders nothing when there are no published updates.
 */
export function Journal({ updates, base, total }: { updates: EditionUpdate[]; base: string; total: number }) {
  const shown = updates.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="edition-journal" className="ed-section ed-section--band">
      <div className="ed-wrap">
        <div className="ed-head">
          <div><p className="ed-eyebrow" aria-hidden="true">From the organisers</p><h2 id="edition-journal" className="ed-display ed-h2" style={{ margin: 0 }}>Journal</h2></div>
          <Link href={`${base}/updates`} className="ed-arrow">{total > shown.length ? `All updates (${total})` : "Open the journal"} <span aria-hidden="true">→</span></Link>
        </div>
        <ul className={`ed-jgrid ed-jgrid--n${shown.length}`}>
          {shown.length === 3 ? (
            <>
              <Item u={shown[0]} lead base={base} />
              <li className="ed-jside"><ul>{shown.slice(1).map((u) => <Item key={u.id} u={u} lead={false} base={base} />)}</ul></li>
            </>
          ) : shown.map((u, i) => <Item key={u.id} u={u} lead={i === 0} base={base} />)}
        </ul>
      </div>
    </section>
  );
}
