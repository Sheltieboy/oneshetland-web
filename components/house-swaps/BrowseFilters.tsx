import Link from "next/link";
import {
  ACCESS_FEATURE_IDS, AREAS, BEDROOM_FILTERS, FEATURES, PROPERTY_TYPES, activeFilterChips, activeFilterCount, type BrowseQuery,
} from "@/lib/house-swaps";
import { REGIONS, placesIn } from "@/lib/house-swaps-geo";
import { btnPrimary, fieldCls } from "./Shell";

/** Communities grouped under their region (works without JavaScript: one grouped select). */
const PlaceOptions = ({ all }: { all?: string }) => (
  <>
    {all && <option value="">{all}</option>}
    {REGIONS.map((r) => <optgroup key={r.id} label={r.name}>{placesIn(r.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
  </>
);

const check = "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line-strong bg-paper px-3 text-sm font-semibold text-ink has-[:checked]:border-navy has-[:checked]:bg-navy/5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy";

/** Filters are a plain GET form, so every view is a shareable address and works without JavaScript. */
export function BrowseFilters({ q }: { q: BrowseQuery }) {
  const n = activeFilterCount(q);
  const chips = activeFilterChips(q);
  const access = FEATURES.filter((f) => ACCESS_FEATURE_IDS.includes(f.id));
  const other = FEATURES.filter((f) => !ACCESS_FEATURE_IDS.includes(f.id));
  return (
    <div>
      <details open={n > 0} className="group rounded-card border border-line bg-paper shadow-soft">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-bold text-ink [&::-webkit-details-marker]:hidden">
          <span>Filter adverts{n > 0 && <span className="ml-2 rounded-pill bg-navy px-2 py-0.5 text-xs text-paper">{n}</span>}</span>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180"><polyline points="6 9 12 15 18 9" /></svg>
        </summary>
        <form method="get" action="/house-swaps" className="space-y-5 border-t border-line p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="f-area" className="block text-sm font-semibold text-ink">Where the home is</label>
              <select id="f-area" name="area" defaultValue={q.area ?? ""} className={fieldCls}>
                <option value="">Anywhere in Shetland</option>
                {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-place" className="block text-sm font-semibold text-ink">Or a community <span className="font-normal text-ink-muted">(takes over from the area)</span></label>
              <select id="f-place" name="place" defaultValue={q.place ?? ""} className={fieldCls}>
                <PlaceOptions all="Any community" />
              </select>
            </div>
            <div>
              <label htmlFor="f-beds" className="block text-sm font-semibold text-ink">Bedrooms</label>
              <select id="f-beds" name="beds" defaultValue={q.beds ?? ""} className={fieldCls}>
                <option value="">Any number</option>
                {BEDROOM_FILTERS.map((b) => <option key={b} value={b}>{b === "0" ? "Studio / bedsit" : b === "5+" ? "5 or more" : b}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-want" className="block text-sm font-semibold text-ink">Looking to move to</label>
              <select id="f-want" name="want" defaultValue={q.want ?? ""} className={fieldCls}>
                <option value="">Anywhere</option>
                <optgroup label="Whole areas">{AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                {REGIONS.map((r) => <optgroup key={r.id} label={`Communities: ${r.name}`}>{placesIn(r.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Type of home</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PROPERTY_TYPES.map((t) => <label key={t.id} className={check}><input type="checkbox" name="type" value={t.id} defaultChecked={q.types.includes(t.id)} className="h-5 w-5 accent-[#032f4c]" />{t.label}</label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Accessibility (the home must have all you tick)</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {access.map((f) => <label key={f.id} className={check}><input type="checkbox" name="feat" value={f.id} defaultChecked={q.features.includes(f.id)} className="h-5 w-5 accent-[#032f4c]" />{f.label}</label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Other features</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {other.map((f) => <label key={f.id} className={check}><input type="checkbox" name="feat" value={f.id} defaultChecked={q.features.includes(f.id)} className="h-5 w-5 accent-[#032f4c]" />{f.label}</label>)}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary}>Show adverts</button>
            {n > 0 && <Link href="/house-swaps" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-navy-light underline">Clear all filters</Link>}
          </div>
        </form>
      </details>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Filters in use">
          {chips.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-sand px-4 text-sm font-semibold text-ink-soft hover:bg-line">
                {c.label}<span aria-hidden>{"×"}</span><span className="sr-only">Remove this filter</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
