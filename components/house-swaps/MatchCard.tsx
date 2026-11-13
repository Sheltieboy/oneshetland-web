import Link from "next/link";
import {
  MATCH_KIND_LABEL, bedroomsShort, displayHeadline, freshnessText, homeLocationText, isSample, typeLabel, wantsText, wantBedroomsText, type MatchRow,
} from "@/lib/house-swaps";
import { FeatureChips, SampleBadge } from "./Chips";

/** One possible match with the plain-English reasons the database gave. */
export function MatchCard({ m, showKind = true }: { m: MatchRow; showKind?: boolean }) {
  return (
    <article className="relative flex h-full min-w-0 flex-col rounded-card border border-line bg-paper p-5 shadow-soft transition hover:shadow-lift">
      {isSample(m) && <p className="mb-1"><SampleBadge /></p>}
      {showKind && <p className="text-[11px] font-black uppercase tracking-widest text-navy-light">{MATCH_KIND_LABEL[m.match_kind]}</p>}
      <h3 className="mt-1 break-words font-display text-lg font-bold leading-snug text-ink">
        <Link href={`/house-swaps/${m.listing_id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-navy">
          {displayHeadline({ headline: m.headline, have_bedrooms: m.have_bedrooms, have_type: m.have_type, have_area_name: m.have_area_name, have_place_name: m.have_place_name })}
        </Link>
      </h3>
      <p className="mt-1 text-sm font-semibold text-ink-soft">{bedroomsShort(m.have_bedrooms)} · {typeLabel(m.have_type)} · {homeLocationText(m)}</p>
      <div className="mt-2"><FeatureChips features={m.have_features} /></div>
      <p className="mt-2 text-sm text-ink-muted">Looking for: {wantBedroomsText(m.want_min_bedrooms, m.want_max_bedrooms).toLowerCase()}, {wantsText(m).replace(/^Anywhere/, "anywhere")}</p>
      {m.reasons.length > 0 && (
        <div className="mt-3 rounded-xl bg-sand/60 p-3">
          <p className="text-xs font-bold text-ink-muted">Why this may suit</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <p className="mt-auto pt-3 text-xs font-semibold text-ink-muted">{freshnessText(m.last_confirmed_at)}</p>
    </article>
  );
}
