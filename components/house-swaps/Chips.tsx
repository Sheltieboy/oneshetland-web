import { SAMPLE_BADGE, bedroomsShort, featureLabel, typeLabel, ACCESS_FEATURE_IDS } from "@/lib/house-swaps";

const base = "inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-bold";
export const Chip = ({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "navy" | "access" | "warm" }) => (
  <span className={`${base} ${tone === "navy" ? "bg-navy text-paper" : tone === "access" ? "bg-teal/15 text-navy-light" : tone === "warm" ? "bg-sand text-ink-soft" : "border border-line-strong bg-paper text-ink-soft"}`}>{children}</span>
);

/** Marks a fictional advert (data_origin = sample). */
export const SampleBadge = () => <Chip tone="warm">{SAMPLE_BADGE}</Chip>;

/** Bedrooms / area / type chips for a home. */
export function HomeChips({ bedrooms, type, area }: { bedrooms: number; type: string; area?: string | null }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="About this home">
      <li><Chip tone="navy">{bedroomsShort(bedrooms)}</Chip></li>
      <li><Chip tone="warm">{typeLabel(type)}</Chip></li>
      {area && <li><Chip>{area}</Chip></li>}
    </ul>
  );
}

/** Feature chips; accessibility ones are tinted. */
export function FeatureChips({ features, label = "Features" }: { features: string[]; label?: string }) {
  if (!features.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {features.map((f) => <li key={f}><Chip tone={ACCESS_FEATURE_IDS.includes(f) ? "access" : "warm"}>{featureLabel(f)}</Chip></li>)}
    </ul>
  );
}
