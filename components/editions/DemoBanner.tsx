import { DEMO_BANNER_TEXT, isDemoMode } from "@/lib/editions/demo-mode";

/** The permanent notice on a demonstration deployment (nothing on production, where demo mode is off). */
export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div role="note" style={{ background: "#14232a", color: "#f3f7f8" }} className="px-4 py-2 text-center text-[0.8rem] leading-snug">
      <strong className="font-semibold tracking-wide">Unofficial concept.</strong> {DEMO_BANNER_TEXT.replace("An unofficial concept with demonstration data. ", "")}
    </div>
  );
}
