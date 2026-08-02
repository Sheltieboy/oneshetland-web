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
 *   wird     &id=<spik_dictionary.id>   — Word of the day card
 *   event    &id=<events.id>            — event spotlight poster (uses cover)
 *   roundup  &start=<YYYY-MM-DD>&days=N — What's On listing card (7 or 14 days)
 *   jobs     (no params)                — newest open jobs listing card
 */

export const dynamic = "force-dynamic";

const SIZE = 1080;
const NAVY = "#032f4c";
const TEAL = "#12b3d6";
const CREAM = "#fbf8f2";
const INK = "#14222c";
const INK_SOFT = "#3a4754";
const EVENTS = "#d4921a";
const JOBS = "#2a8b5c";

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
    headers: {
      "Cache-Control": "public, s-maxage=86400, max-age=3600",
      // Netlify's CDN must key this cache on the query string — otherwise the
      // first card rendered gets served for EVERY kind/id combination.
      "Netlify-Vary": "query",
    },
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
            <Eyebrow text="Spik · Word of the day" color={TEAL} />
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
    const days = Math.min(Number(p.get("days") ?? 7) || 7, 31);
    const from = `${start}T00:00:00Z`;
    const to = new Date(new Date(from).getTime() + days * 86400_000).toISOString();
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
    const dayNum = (iso: string) =>
      new Date(iso).toLocaleDateString("en-GB", { day: "numeric", timeZone: "Europe/London" });
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent={EVENTS}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "72px 72px 0", gap: 14 }}>
            <Eyebrow text="What's On" color={EVENTS} />
            <span style={{ fontFamily: "Fraunces", fontSize: 84, color: NAVY, lineHeight: 1.05, marginBottom: 22 }}>
              {days <= 7 ? "This week in Shetland" : "Coming up in Shetland"}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {list.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, background: "#ffffff", borderRadius: 18, padding: "16px 24px" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 128, height: 52, borderRadius: 12, background: NAVY, color: "#ffffff", fontSize: 25, fontWeight: 700, letterSpacing: 1 }}>{fmtDow(e.starts_at)} {dayNum(e.starts_at)}</span>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: INK }}>{e.title.length > 40 ? `${e.title.slice(0, 39)}…` : e.title}</span>
                    {(e.venue || e.locality) ? <span style={{ fontSize: 24, color: INK_SOFT }}>{[e.venue, e.locality].filter(Boolean).join(", ")}</span> : null}
                  </div>
                </div>
              ))}
              {list.length === 0 ? <span style={{ fontSize: 36, color: INK_SOFT }}>New events are added all week — see what's on at oneshetland.com</span> : null}
            </div>
          </div>
        </Frame>
      ),
      opts,
    );
  }

  /* ── Jobs roundup — newest open jobs ───────────────────────────────────── */
  /* ── Product spotlight — Shop Shetland ─────────────────────────────────── */
  if (kind === "product") {
    const { data: prod } = await sb
      .from("products")
      .select("title, price_pence, photos, stock_mode, business:local_businesses(name, logo_url)")
      .eq("id", p.get("id") ?? "")
      .maybeSingle();
    if (!prod) return new Response("product not found", { status: 404 });
    const biz = (Array.isArray(prod.business) ? prod.business[0] : prod.business) as { name?: string; logo_url?: string } | null;
    const photo = (prod.photos as string[])?.[0] ? await coverAsJpegDataUri((prod.photos as string[])[0]) : null;
    const LOCAL = "#7c3aed";
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: CREAM, position: "relative", fontFamily: "Inter" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={SIZE} height={720} style={{ width: SIZE, height: 720, objectFit: "cover" }} alt="" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ringUrl} width={760} height={760} style={{ position: "absolute", top: -180, right: -200, opacity: 0.08 }} alt="" />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "30px 64px 0", gap: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: LOCAL }}>
              {(`NEW FROM ${biz?.name ?? "A SHETLAND SHOP"}`).toUpperCase()}
            </span>
            <span style={{ fontFamily: "Fraunces", fontSize: prod.title.length > 30 ? 52 : 64, color: NAVY, lineHeight: 1.08 }}>{prod.title}</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: LOCAL }}>
              £{((prod.price_pence as number) / 100).toFixed(2)}
              {prod.stock_mode === "one_off" ? "  ·  one of a kind" : prod.stock_mode === "made_to_order" ? "  ·  made to order" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", height: 110, borderTop: `6px solid ${LOCAL}`, background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ringUrl} width={54} height={54} alt="" />
              <span style={{ fontFamily: "Fraunces", fontSize: 38, color: NAVY }}>OneShetland</span>
            </div>
            <span style={{ fontSize: 26, fontWeight: 700, color: INK_SOFT }}>shop local · oneshetland.com</span>
          </div>
        </div>
      ),
      opts,
    );
  }

  if (kind === "jobs") {
    const { data: jobs } = await sb
      .from("jobs")
      .select("title, external_employer_name, locality, location, contract_type, local_businesses!posted_as_business_id(name)")
      .eq("status", "open")
      .eq("is_hidden", false)
      .order("posted_at", { ascending: false })
      .limit(5);
    const list = (jobs ?? []).map((j) => {
      const biz = Array.isArray(j.local_businesses) ? j.local_businesses[0] : j.local_businesses;
      const sub = [(biz?.name ?? j.external_employer_name) as string | null, (j.locality ?? j.location) as string | null]
        .filter(Boolean).join(" · ");
      return {
        title: j.title as string,
        sub: sub.length > 52 ? `${sub.slice(0, 51)}…` : sub,
        type: ((j.contract_type as string) ?? "").replace("-", " ").toUpperCase(),
      };
    });
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent={JOBS}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "72px 72px 0", gap: 14 }}>
            <Eyebrow text="Jobs & Shifts" color={JOBS} />
            <span style={{ fontFamily: "Fraunces", fontSize: 76, color: NAVY, lineHeight: 1.05, marginBottom: 18 }}>Hiring in Shetland</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {list.map((j, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, background: "#ffffff", borderRadius: 18, padding: "14px 24px" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 148, height: 48, borderRadius: 12, background: JOBS, color: "#ffffff", fontSize: 19, fontWeight: 700, letterSpacing: 1 }}>{j.type || "OPEN ROLE"}</span>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: INK }}>{j.title.length > 40 ? `${j.title.slice(0, 39)}…` : j.title}</span>
                    {j.sub ? <span style={{ fontSize: 23, color: INK_SOFT }}>{j.sub}</span> : null}
                  </div>
                </div>
              ))}
              {list.length === 0 ? <span style={{ fontSize: 36, color: INK_SOFT }}>New roles are posted every week — see who's hiring at oneshetland.com</span> : null}
            </div>
          </div>
        </Frame>
      ),
      opts,
    );
  }

  return new Response("unknown kind", { status: 400 });
}
