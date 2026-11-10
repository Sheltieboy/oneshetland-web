import type { EditionUpdate } from "@/lib/editions/types";
import { Prose } from "./Prose";
import { responsiveImage } from "@/lib/editions/images";

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Organiser updates as a journal: date in the margin, headline set large, pinned first. `lead` sets the first entry at feature scale. Headings start at h3 so the page keeps its h2. */
export function UpdatesList({ updates, limit, lead = false }: { updates: EditionUpdate[]; accent?: string; limit?: number; lead?: boolean }) {
  const list = limit ? updates.slice(0, limit) : updates;
  return (
    <ol className="ed-journal">
      {list.map((u, i) => (
        <li key={u.id} id={`u-${u.id}`}>
          <article className={`ed-entry${lead && i === 0 ? " ed-entry--lead" : ""}`}>
            <p className="ed-entry__date" style={{ margin: 0 }}>
              {u.pinned && <span className="ed-tag">Pinned</span>}
              {u.published_at && <time dateTime={u.published_at}>{when(u.published_at)}</time>}
            </p>
            <div style={{ minWidth: 0 }}>
              {u.image_url && (
                <div className="ed-img ed-ratio-169" style={{ marginBottom: "1.5rem", maxWidth: "46rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img {...responsiveImage(u.image_url, "(min-width: 48rem) 46rem, 100vw")} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                </div>
              )}
              <h3 className="ed-entry__title">{u.title}</h3>
              <Prose source={u.body} level={4} />
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
