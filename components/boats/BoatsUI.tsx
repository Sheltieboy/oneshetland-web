import Link from "next/link";
import { type VesselSearchRow, hullMaterialLabel, BOATS } from "@/lib/boats-data";

export function BoatCard({ v, hero }: { v: VesselSearchRow; hero?: string }) {
  const altNames = (v.all_names ?? "").split(",").map((s) => s.trim()).filter((n) => n && n.toLowerCase() !== v.canonical_name.toLowerCase()).slice(0, 3);
  return (
    <Link href={`/boats/${v.id}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-paper shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-40 overflow-hidden" style={{ background: `${BOATS}14` }}>
        {hero ? (
          <img src={hero} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl opacity-25" aria-hidden="true">⚓</div>
        )}
        {v.primary_lk_number && (
          <span className="absolute bottom-2 left-2 rounded-pill px-2.5 py-1 text-xs font-black text-white shadow" style={{ background: BOATS }}>{v.primary_lk_number}</span>
        )}
        {(v.media_asset_count ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 rounded-pill bg-black/55 px-2 py-0.5 text-xs font-bold text-white" aria-label={`${v.media_asset_count} photos`}><span aria-hidden="true">📷</span> {v.media_asset_count}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-bold leading-tight text-ink group-hover:underline">{v.canonical_name}</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          {v.built_year ? `Built ${v.built_year}` : "Year unknown"}{hullMaterialLabel(v.hull_material) ? ` · ${hullMaterialLabel(v.hull_material)}` : ""}
        </p>
        {v.builder && <p className="mt-1 truncate text-xs text-ink-faint">{v.builder}</p>}
        {altNames.length > 0 && <p className="mt-1 truncate text-xs text-ink-faint">aka {altNames.join(", ")}</p>}
      </div>
    </Link>
  );
}
