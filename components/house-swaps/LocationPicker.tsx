"use client";

import { useId, useRef, useState } from "react";
import {
  GROUPS, GROUP_NOTE, REGIONS, ANYWHERE, chooseHomePlace, chooseHomeRegion, describeLocation, effectiveWants, isGroupChosen, keepHomeBroad, placeById, placesIn, placesInGroup,
  regionName, removeWant, searchLocations, toggleAnywhere, toggleWantGroup, toggleWantPlace, toggleWantRegion, wantCount, type HomeState, type Place, type WantState,
} from "@/lib/house-swaps-geo";
import { ShetlandMap } from "./ShetlandMap";

type Props =
  | { mode: "home"; value: HomeState; onChange: (v: HomeState) => void; describedBy?: string; invalid?: boolean }
  | { mode: "wants"; value: WantState; onChange: (v: WantState) => void; describedBy?: string; invalid?: boolean };

const chipBase = "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
/** Selected = OS Blue fill + white text + a tick (never colour alone); included-by-a-whole-region = outlined in blue with a small tick. */
const chipCls = (on: boolean, included = false) => `${chipBase} ${on ? "border-navy bg-navy text-paper" : included ? "border-navy bg-paper text-navy" : "border-line-strong bg-paper text-ink hover:bg-sand"}`;
const Tick = () => <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 13 10 18 19 7" /></svg>;

function Chip({ on, included, radio, label, children, onClick }: { on: boolean; included?: boolean; radio?: boolean; label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={on ? true : included ? "mixed" : false} aria-label={label} onClick={onClick} className={chipCls(on, included)}>
      {(on || included) && <Tick />}{children}
    </button>
  );
}

/**
 * The two-level Shetland location choice. MODE "home": one region (map or list), then optionally one community inside it (default: "just keep it broad").
 * MODE "wants": "Anywhere in Shetland", whole regions and specific communities, several of each. The map and the searchable list share one state.
 */
export function LocationPicker(props: Props) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map"); // on a phone one at a time; on a wide screen both show
  const search = useRef<HTMLInputElement>(null);
  const home = props.mode === "home";
  const found = searchLocations(query);
  const searching = query.trim().length > 0;

  const homeV = props.mode === "home" ? props.value : null;
  const wantV = props.mode === "wants" ? props.value : null;
  // Several communities inside one region are all kept; what the map, the chips and the summary show is the effective choice,
  // where a region chosen as a whole stands in for its own communities.
  const effW = wantV ? effectiveWants(wantV) : null;
  const mapRegions = homeV ? (homeV.regionId ? [homeV.regionId] : []) : effW!.regionIds;
  const mapPlaces = homeV ? (homeV.placeId ? [homeV.placeId] : []) : effW!.placeIds;
  const onRegion = (id: string) => (props.mode === "home" ? props.onChange(chooseHomeRegion(props.value, id)) : props.onChange(toggleWantRegion(props.value, id)));
  const onPlace = (id: string) => (props.mode === "home" ? props.onChange(chooseHomePlace(props.value, id)) : props.onChange(toggleWantPlace(props.value, id)));

  function skip() { setView("list"); setTimeout(() => search.current?.focus(), 30); }

  // The "Selected" summary: removable chips.
  const summary: { id: string; label: string }[] = homeV
    ? (homeV.regionId ? [{ id: "home", label: describeLocation(homeV.regionId, homeV.placeId) + (homeV.placeId ? "" : " (whole area)") }] : [])
    : [...effW!.regionIds.map((r) => ({ id: r, label: `All of ${regionName(r)}` })), ...effW!.placeIds.map((p) => ({ id: p, label: placeById(p)?.name ?? p }))];

  const placeChips = (places: Place[], regionWhole: (p: Place) => boolean) => places.map((p) => {
    const on = homeV ? homeV.placeId === p.id : effW!.placeIds.includes(p.id);
    const inc = !homeV && !on && regionWhole(p);
    return <Chip key={p.id} on={on} included={inc} radio={!!homeV} label={`${p.name}${inc ? ", included in the whole region" : ""}`} onClick={() => onPlace(p.id)}>{p.name}</Chip>;
  });

  const list = (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${uid}-q`} className="block text-sm font-semibold text-ink">Search for an area or community</label>
        <input ref={search} id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="For example: Scalloway, Yell, Burra" className="mt-1 min-h-[44px] w-full rounded-xl border border-line-strong bg-paper px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy" />
        {searching && <p role="status" className="mt-1 text-sm text-ink-muted">{found.regions.length + found.places.length === 0 ? "Nothing matches that. Try a shorter name." : `${found.regions.length} area${found.regions.length === 1 ? "" : "s"} and ${found.places.length} communit${found.places.length === 1 ? "y" : "ies"} found.`}</p>}
      </div>

      {!home && !searching && (
        <div role="group" aria-label="Open to anywhere">
          <Chip on={wantV!.anywhere} label="Anywhere in Shetland" onClick={() => props.onChange(toggleAnywhere(props.value as WantState) as never)}>Anywhere in Shetland</Chip>
        </div>
      )}

      {home ? (
        <div role="radiogroup" aria-label="Part of Shetland" aria-describedby={props.describedBy} className="space-y-3">
          {(searching ? found.regions : REGIONS).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(searching ? found.regions : REGIONS).map((r) => <Chip key={r.id} radio on={homeV!.regionId === r.id} label={r.name} onClick={() => onRegion(r.id)}>{r.name}</Chip>)}
            </div>
          )}
          {searching && found.places.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Communities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {found.places.map((p) => <Chip key={p.id} radio on={homeV!.placeId === p.id} label={`${p.name}, ${regionName(p.regionId)}`} onClick={() => onPlace(p.id)}>{p.name}<span className="font-normal text-ink-muted"> · {regionName(p.regionId)}</span></Chip>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4" aria-describedby={props.describedBy}>
          {(searching ? found.regions.map((r) => r.id) : REGIONS.map((r) => r.id))
            .concat(searching ? [...new Set(found.places.map((p) => p.regionId))].filter((id) => !found.regions.some((r) => r.id === id)) : [])
            .map((rid) => {
              const region = REGIONS.find((r) => r.id === rid)!;
              const whole = wantV!.regionIds.includes(rid);
              const matchedByName = !searching || found.regions.some((r) => r.id === rid);
              const places = (matchedByName ? placesIn(rid) : found.places.filter((p) => p.regionId === rid));
              const groups = GROUPS.filter((g) => placesInGroup(g).some((p) => p.regionId === rid) && placesInGroup(g).every((p) => places.some((q) => q.id === p.id)));
              return (
                <fieldset key={rid} className="rounded-xl border border-line p-3.5">
                  <legend className="px-1 text-sm font-bold text-ink">{region.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={whole} label={`All of ${region.name}`} onClick={() => onRegion(rid)}>All of this area</Chip>
                    {groups.map((g) => placesInGroup(g).length > 1 && <Chip key={g} on={isGroupChosen(wantV!, g) && !wantV!.regionIds.includes(rid)} included={whole} label={`All of ${g}`} onClick={() => props.onChange(toggleWantGroup(props.value as WantState, g) as never)}>All of {g}</Chip>)}
                    {placeChips(places, () => whole)}
                  </div>
                </fieldset>
              );
            })}
        </div>
      )}
    </div>
  );

  const map = (
    <ShetlandMap mode={props.mode} regionIds={mapRegions} placeIds={mapPlaces} onRegion={onRegion} onPlace={onPlace} onSkip={skip} />
  );

  const empty = homeV ? !homeV.regionId : wantCount(wantV!) === 0 && !wantV!.anywhere;
  const clear = () => (props.mode === "home" ? props.onChange({ regionId: "", placeId: "" }) : props.onChange(ANYWHERE));

  return (
    <div className="space-y-4" aria-invalid={props.invalid || undefined}>
      <p className="rounded-xl border border-teal/50 bg-teal/10 px-4 py-3 text-sm text-ink">{GROUP_NOTE} We never ask for an address, street or postcode.</p>

      <div aria-live="polite" className="sticky top-16 z-20 -mx-1 flex max-h-[38vh] flex-wrap items-center gap-2 overflow-y-auto rounded-xl border border-line bg-paper px-3 py-2 shadow-sm">
        <span className="text-sm font-bold text-ink">{homeV ? "Your home:" : summary.length > 1 ? `Where you want to move (${summary.length}):` : "Where you want to move:"}</span>
        {wantV?.anywhere && <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-navy px-3 text-sm font-semibold text-paper"><Tick />Anywhere in Shetland</span>}
        {summary.map((s) => (
          <span key={s.id} className="inline-flex min-h-[44px] items-center gap-1 rounded-pill bg-navy pl-3 text-sm font-semibold text-paper">
            <Tick />{s.label}
            <button type="button" className="grid h-11 w-9 place-items-center rounded-r-pill hover:bg-navy-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-paper" aria-label={`Remove ${s.label}`} onClick={() => (props.mode === "home" ? props.onChange(homeV!.placeId ? keepHomeBroad(homeV!) : { regionId: "", placeId: "" }) : props.onChange(removeWant(wantV!, s.id)))}><span aria-hidden>{"×"}</span></button>
          </span>
        ))}
        {empty && <span className="text-sm text-ink-muted">Nothing chosen yet.</span>}
        {!empty && !(wantV?.anywhere) && <button type="button" onClick={clear} className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-navy-light underline">Clear</button>}
      </div>

      <div className="lg:hidden" role="tablist" aria-label="How to choose">
        {(["map", "list"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`min-h-[44px] w-1/2 border-b-4 px-3 text-sm font-bold ${view === v ? "border-navy text-navy" : "border-transparent text-ink-muted"}`}>{v === "map" ? "Choose on the map" : "Search the list"}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className={(view === "map" ? "" : "hidden lg:block ") + " lg:sticky lg:top-24 lg:self-start"}>{map}</div>
        <div className={view === "list" ? "" : "hidden lg:block"}>{list}</div>
      </div>

      {homeV && homeV.regionId && !searching && (
        <div className="rounded-xl border border-line bg-sand/50 p-4">
          <p id={`${uid}-c`} className="text-sm font-semibold text-ink">Which community in {regionName(homeV.regionId)}? <span className="font-normal text-ink-muted">(optional)</span></p>
          <p className="mt-0.5 text-sm text-ink-muted">You can keep your home at area level. Naming a community just helps people who want a particular place.</p>
          <div role="radiogroup" aria-labelledby={`${uid}-c`} className="mt-3 flex flex-wrap gap-2">
            <Chip radio on={!homeV.placeId} label={`Just keep it broad: ${regionName(homeV.regionId)}`} onClick={() => props.onChange(keepHomeBroad(props.value as HomeState) as never)}>Just keep it broad: {regionName(homeV.regionId)}</Chip>
            {placeChips(placesIn(homeV.regionId), () => false)}
          </div>
        </div>
      )}


    </div>
  );
}
