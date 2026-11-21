import { REGION_CONFIDENCE_LABEL, type RegionConfidence } from "@/lib/spik-data";

/**
 * SpikPrivateNote — what a contributor told the Spik editors privately: the free-text "Additional
 * information about this word" and, for variations, the regional detail the single public region
 * can't hold. Editors-only (the data is readable by admins only). It is context for the editorial
 * decision, NOT content: nothing here is published by approving, and there is deliberately no way to
 * reply to it.
 */
export function SpikPrivateNote({
  note,
  alsoRegions,
  confidence,
}: {
  note?: string | null;
  alsoRegions?: string[] | null;
  confidence?: string | null;
}) {
  const regions = (alsoRegions ?? []).filter(Boolean);
  const conf = confidence && confidence !== "this_area" && confidence in REGION_CONFIDENCE_LABEL
    ? REGION_CONFIDENCE_LABEL[confidence as RegionConfidence]
    : null;
  if (!note && regions.length === 0 && !conf) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3" role="note" aria-label="Private note from contributor">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        🔒 Private note from contributor
      </p>
      {(regions.length > 0 || conf) && (
        <dl className="mt-1.5 space-y-0.5 text-sm">
          {regions.length > 0 && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-amber-900">Also heard in:</dt>
              <dd className="text-ink">{regions.join(", ")}</dd>
            </div>
          )}
          {conf && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-amber-900">Where it comes from:</dt>
              <dd className="text-ink">{conf}</dd>
            </div>
          )}
        </dl>
      )}
      {note && <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{note}</p>}
      <p className="mt-2 text-xs text-amber-800">
        Only editors can see this. It is not published when you approve. Use it to inform your decision.
      </p>
    </div>
  );
}
