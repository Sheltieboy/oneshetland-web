import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { houseSwapsGate } from "@/lib/house-swaps-data";
import { PREVIEW_BANNER } from "@/lib/house-swaps";
import { RestrictedPreview } from "@/components/house-swaps/RestrictedPreview";

// Not for search engines yet: House Swaps is being introduced quietly. Remove this (and add it to the sitemap) when it is launched.
export const metadata: Metadata = {
  title: "House Swaps",
  description: "A free noticeboard where Shetland social-housing tenants can find someone to swap homes with.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Off (or any error) = a 404. Private preview and this visitor not invited = a small friendly page INSTEAD of the section (so no House Swaps page code or data runs).
 * Live, or invited = the section, with a calm notice at the top during the preview. Each page checks again (requireHouseSwaps), so a stale client navigation can't slip past.
 */
export default async function HouseSwapsLayout({ children }: { children: React.ReactNode }) {
  const gate = await houseSwapsGate();
  if (gate.mode === "off") notFound();
  if (!gate.allowed) return <RestrictedPreview signedIn={gate.signedIn} />;
  return (
    <>
      {gate.mode === "preview" && <p role="note" className="border-b border-amber-300/70 bg-amber-50 px-5 py-2 text-center text-sm text-amber-950">{PREVIEW_BANNER}</p>}
      {children}
    </>
  );
}
