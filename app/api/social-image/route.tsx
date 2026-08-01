import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicClient } from "@/lib/supabase/public";

/**
 * /api/social-image — branded 1080×1080 social cards for the Peerie Press
 * social-seeding engine. The composer edge function stores one of these URLs
 * on each queued social_post; Facebook/Instagram fetch it at publish time, so
 * no image is ever designed by hand.
 *
 * Templates (kind=):
 *   wird     &id=<spik_dictionary.id>   — Wird o' da Day card
 *   event    &id=<events.id>            — event spotlight poster (uses cover)
 *   roundup  &start=<YYYY-MM-DD>        — "Whit's On dis week" listing card
 */

export const dynamic = "force-dynamic";

const SIZE = 1080;
const NAVY = "#032f4c";
const TEAL = "#12b3d6";
const CREAM = "#fbf8f2";
const INK = "#14222c";
const INK_SOFT = "#3a4754";
const EVENTS = "#d4921a";

// Loaded once per server instance.
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700 }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/social-fonts/fraunces-semibold.ttf")),
    readFile(join(process.cwd(), "assets/social-fonts/inter-regular.ttf")),
    readFile(join(process.cwd(), "assets/social-fonts/inter-bold.ttf")),
  ]).then(([fraunces, inter, interBold]) => [
    { name: "Fraunces", data: fraunces.buffer as ArrayBuffer, weight: 600 as const },
    { name: "Inter", data: inter.buffer as ArrayBuffer, weight: 400 as const },
    { name: "Inter", data: interBold.buffer as ArrayBuffer, weight: 700 as const },
  ]);
  return fontsPromise;
}

/**
 * satori/resvg can only decode PNG/JPEG — event covers are mostly WebP. Fetch
 * the cover and re-encode to JPEG (capped at 1080px wide) as a data URI.
 * Returns null on any failure so the template falls back to the branded navy.
 */
async function coverAsJpegDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp(buf).resize({ width: SIZE, height: SIZE, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const fmtDow = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" }).toUpperCase();

/** Shared page chrome: cream ground, faint ring watermark, branded footer. */
function Frame({ children, ringUrl, accent }: { children: React.ReactNode; ringUrl: string; accent: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: CREAM, position: "relative", fontFamily: "Inter" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ringUrl} width={760} height={760} style={{ position: "absolute", top: -180, right: -200, opacity: 0.08 }} alt="" />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", height: 110, borderTop: `6px solid ${accent}`, background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ringUrl} width={54} height={54} alt="" />
          <span style={{ fontFamily: "Fraunces", fontSize: 38, color: NAVY }}>OneShetland</span>
        </div>
        <span style={{ fontSize: 26, fontWeight: 700, color: INK_SOFT }}>oneshetland.com</span>
      </div>
    </div>
  );
}

function Eyebrow({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6, color }}>{text.toUpperCase()}</span>;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const kind = p.get("kind") ?? "";
  const ringUrl = new URL("/brand/logo-mark-keyed.png", req.nextUrl.origin).toString();
  const fonts = await loadFonts();
  const sb = publicClient();
  const opts = {
    width: SIZE,
    height: SIZE,
    fonts,
    headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" },
  };

  /* ── Wird o' da Day ────────────────────────────────────────────────────── */
  if (kind === "wird") {
    const { data: w } = await sb
      .from("spik_dictionary")
      .select("word, pronunciation, short_meaning, example_sentence, part_of_speech")
      .eq("id", Number(p.get("id")))
      .maybeSingle();
    if (!w) return new Response("word not found", { status: 404 });
    const wordSize = w.word.length > 12 ? 96 : w.word.length > 8 ? 128 : 160;
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent={TEAL}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "84px 72px 0", gap: 30 }}>
            <Eyebrow text="Wird o' da Day" color={TEAL} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
              <span style={{ fontFamily: "Fraunces", fontSize: wordSize, color: NAVY, lineHeight: 1 }}>{w.word}</span>
              {w.part_of_speech ? <span style={{ fontSize: 32, color: INK_SOFT, fontStyle: "italic" }}>{w.part_of_speech}</span> : null}
            </div>
            {w.pronunciation ? <span style={{ fontSize: 34, color: INK_SOFT }}>/{w.pronunciation}/</span> : null}
            {w.short_meaning ? <span style={{ fontSize: 46, color: INK, lineHeight: 1.35 }}>{w.short_meaning}</span> : null}
            {w.example_sentence ? (
              <div style={{ display: "flex", marginTop: 8, padding: "26px 34px", borderLeft: `10px solid ${TEAL}`, background: "#ffffff", borderRadius: 18 }}>
                <span style={{ fontSize: 36, color: INK_SOFT, fontStyle: "italic", lineHeight: 1.4 }}>“{w.example_sentence}”</span>
              </div>
            ) : null}
          </div>
        </Frame>
      ),
      opts,
    );
  }

  /* ── Event spotlight ───────────────────────────────────────────────────── */
  if (kind === "event") {
    const { data: e } = await sb
      .from("events")
      .select("title, starts_at, venue, locality, cover_url, price_text")
      .eq("id", p.get("id") ?? "")
      .maybeSingle();
    if (!e) return new Response("event not found", { status: 404 });
    const where = [e.venue, e.locality].filter(Boolean).join(", ");
    const cover = e.cover_url ? await coverAsJpegDataUri(e.cover_url) : null;
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NAVY, position: "relative", fontFamily: "Inter" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0, objectFit: "cover" }} alt="" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ringUrl} width={860} height={860} style={{ position: "absolute", top: -220, right: -240, opacity: 0.14 }} alt="" />
          )}
          <div style={{ position: "absolute", top: 0, left: 0, width: SIZE, height: SIZE, display: "flex", background: "linear-gradient(to bottom, rgba(3,16,28,0.18) 30%, rgba(3,16,28,0.92) 82%)" }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1, padding: "0 72px 56px", gap: 26, position: "relative" }}>
            <span style={{ display: "flex", alignSelf: "flex-start", background: EVENTS, color: "#ffffff", fontSize: 28, fontWeight: 700, letterSpacing: 5, padding: "12px 28px", borderRadius: 999 }}>WHAT'S ON IN SHETLAND</span>
            <span style={{ fontFamily: "Fraunces", fontSize: e.title.length > 40 ? 66 : 84, color: "#ffffff", lineHeight: 1.08 }}>{e.title}</span>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#ffd9a0" }}>{fmtDay(e.starts_at)} · {fmtTime(e.starts_at)}</span>
            {where ? <span style={{ fontSize: 34, color: "rgba(255,255,255,0.85)" }}>{where}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", height: 110, background: "rgba(255,255,255,0.97)", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ringUrl} width={54} height={54} alt="" />
              <span style={{ fontFamily: "Fraunces", fontSize: 38, color: NAVY }}>OneShetland</span>
            </div>
            <span style={{ fontSize: 26, fontWeight: 700, color: INK_SOFT }}>tickets & details · oneshetland.com</span>
          </div>
        </div>
      ),
      opts,
    );
  }

  /* ── Whit's On dis week roundup ────────────────────────────────────────── */
  if (kind === "roundup") {
    const start = p.get("start") ?? new Date().toISOString().slice(0, 10);
    const from = `${start}T00:00:00Z`;
    const to = new Date(new Date(from).getTime() + 7 * 86400_000).toISOString();
    const { data: events } = await sb
      .from("events")
      .select("title, starts_at, venue, locality")
      .eq("status", "published")
      .eq("is_hidden", false)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(7);
    const list = events ?? [];
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent={EVENTS}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "72px 72px 0", gap: 14 }}>
            <Eyebrow text="Whit's On" color={EVENTS} />
            <span style={{ fontFamily: "Fraunces", fontSize: 84, color: NAVY, lineHeight: 1.05, marginBottom: 22 }}>Dis week in Shetland</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {list.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, background: "#ffffff", borderRadius: 18, padding: "16px 24px" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 52, borderRadius: 12, background: NAVY, color: "#ffffff", fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>{fmtDow(e.starts_at)}</span>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: INK }}>{e.title.length > 42 ? `${e.title.slice(0, 41)}…` : e.title}</span>
                    {(e.venue || e.locality) ? <span style={{ fontSize: 24, color: INK_SOFT }}>{[e.venue, e.locality].filter(Boolean).join(", ")}</span> : null}
                  </div>
                </div>
              ))}
              {list.length === 0 ? <span style={{ fontSize: 36, color: INK_SOFT }}>Fresh events land all week — see whit's on at oneshetland.com</span> : null}
            </div>
          </div>
        </Frame>
      ),
      opts,
    );
  }

  return new Response("unknown kind", { status: 400 });
}
