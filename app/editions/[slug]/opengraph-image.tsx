import { ImageResponse } from "next/og";
import { getEditionBundle } from "@/lib/editions/data.server";
import { dateRangeLabel, safeAccent, DEFAULT_ACCENT } from "@/lib/editions/rules";

/**
 * Branded share card: the Edition's accent, its title, dates and organiser. Typographic only: no external fetch, so a bad cover URL can never break or
 * redirect the render. A non-public Edition (which the database hides from this request) gets a plain OneShetland card that names nothing.
 */
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "OneShetland Edition";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getEditionBundle(slug).catch(() => null);
  const accent = b ? safeAccent(b.edition.brand_color, b.organiser.brand_color) : DEFAULT_ACCENT;
  const title = b?.edition.title ?? "OneShetland Editions";
  const dates = b ? dateRangeLabel(b.edition.starts_on, b.edition.ends_on) : "";
  const organiser = b ? `Organised by ${b.organiser.name}` : "";
  const fontSize = title.length > 60 ? 56 : title.length > 32 ? 72 : 88;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: accent, color: "#ffffff", padding: 72 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", opacity: 0.95 }}>OneShetland Editions</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.02 }}>{title}</div>
          {dates ? <div style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 28 }}>{dates}</div> : null}
          {organiser ? <div style={{ display: "flex", fontSize: 30, marginTop: 10, opacity: 0.95 }}>{organiser}</div> : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
