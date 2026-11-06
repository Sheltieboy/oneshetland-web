import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicClient } from "@/lib/supabase/public";
import { coverAsJpegDataUri, policyFromSupabaseUrl } from "@/lib/social-image-source";
import { ALL_FACILITIES, PROVENANCE_LABEL } from "@/lib/accessibility";
import { RESOURCE_SECTIONS } from "@/lib/accessibility-resources";
import { CATEGORY_LABEL } from "@/lib/activities";
import { selectTolerant } from "@/lib/events-schema";
import { presentRow, type RunOccurrence } from "@/lib/event-runs";
import { eventOrganiser } from "@/lib/event-organiser";

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
 *   business &id=<local_businesses.id>  — Business Spotlight card (used when a business has no photograph of its own)
 *   regular  &ids=<a,b,c…>              — Regular Activities weekly roundup collage (up to 6 PUBLIC activities; their own photographs, else a branded panel)
 *   access   &format=awareness|resource|business — Accessible Shetland cards (typographic; never a photograph of a facility, never a badge or certification)
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
 * satori/resvg can only decode PNG/JPEG — event covers are mostly WebP — so a cover is re-encoded to a JPEG data
 * URI. The URL comes from a column any signed-in user can write, so it is untrusted: lib/social-image-source.ts
 * decides whether it may be fetched at all (this project's own storage only), fetches it with no redirects and hard
 * size/time limits, and decodes it with format and pixel limits. Anything refused or failing returns null and the
 * template falls back to the branded navy.
 */
const imagePolicy = () => policyFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

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
    // New schema: organiser_name / source / performances too; on an old schema the original columns only (lib/events-schema.ts).
    const { data: row } = await selectTolerant<Record<string, unknown> & { title: string; starts_at: string; venue: string | null; locality: string | null; cover_url: string | null; ends_at?: string | null; id?: string; source?: string | null; organiser_name?: string | null; organiser_business_id?: string | null; organiser_hub_id?: string | null; occurrences?: RunOccurrence[] | null }>((extra) =>
      sb
        .from("events")
        .select("id, title, starts_at, ends_at, venue, locality, cover_url, price_text, organiser_business_id, organiser_hub_id" + extra)
        .eq("id", p.get("id") ?? "")
        .maybeSingle(),
    );
    if (!row) return new Response("event not found", { status: 404 });
    // A production with performances is dated by its NEXT performance (a finished one keeps its stored date).
    const shown = presentRow({ ...row, id: String(row.id ?? ""), occurrences: row.occurrences ?? null }, new Date());
    const e = shown ?? row;
    const runLabel = shown?.run?.label ?? null;
    // A community event says who shared it, never that OneShetland organised it.
    // Ownership is passed as a stub: only whether an owner exists matters to the rule (an owned event is by its owner, never "named").
    const org = eventOrganiser({ source: row.source, organiser_name: row.organiser_name, business: row.organiser_business_id ? { name: "owner" } : null, hub: row.organiser_hub_id ? { name: "owner" } : null });
    const sharedBy = org && (org.kind === "community" || org.kind === "named") ? `Shared by ${org.name.length > 30 ? `${org.name.slice(0, 29)}…` : org.name}` : null;
    const where = [e.venue, e.locality].filter(Boolean).join(", ");
    const cover = e.cover_url ? await coverAsJpegDataUri(e.cover_url, imagePolicy()) : null;
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
            <span style={{ fontSize: 40, fontWeight: 700, color: "#ffd9a0" }}>{runLabel ? "Next: " : ""}{fmtDay(e.starts_at)} · {fmtTime(e.starts_at)}</span>
            {runLabel ? <span style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{runLabel.replace(/^Next: [^·]*· /, "")}</span> : null}
            {where ? <span style={{ fontSize: 34, color: "rgba(255,255,255,0.85)" }}>{where}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", height: 110, background: "rgba(255,255,255,0.97)", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ringUrl} width={54} height={54} alt="" />
              <span style={{ fontFamily: "Fraunces", fontSize: 38, color: NAVY }}>OneShetland</span>
            </div>
            <span style={{ fontSize: 26, fontWeight: 700, color: INK_SOFT }}>{sharedBy ? `${sharedBy} · oneshetland.com` : runLabel ? "details · oneshetland.com" : "tickets & details · oneshetland.com"}</span>
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
  if (kind === "business") {
    const { data: biz } = await sb
      .from("local_businesses_public")
      .select("name, category, description, cover_url, logo_url")
      .eq("id", p.get("id") ?? "")
      .maybeSingle();
    if (!biz) return new Response("business not found", { status: 404 });
    const DIRECTORY = "#4f46e5";
    const photo = (await coverAsJpegDataUri(biz.cover_url, imagePolicy())) ?? null;
    const logo = photo ? null : await coverAsJpegDataUri(biz.logo_url, imagePolicy());
    const blurb = String(biz.description ?? "").replace(/\s+/g, " ").trim();
    const short = blurb.length > 170 ? `${blurb.slice(0, 167).replace(/\s+\S*$/, "")}…` : blurb;
    const name = String(biz.name ?? "");
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: CREAM, position: "relative", fontFamily: "Inter" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={SIZE} height={560} style={{ width: SIZE, height: 560, objectFit: "cover" }} alt="" />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ringUrl} width={760} height={760} style={{ position: "absolute", top: -180, right: -200, opacity: 0.08 }} alt="" />
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} width={150} height={150} style={{ margin: "56px 64px 0", width: 150, height: 150, objectFit: "contain", borderRadius: 24, background: "#ffffff" }} alt="" />
              )}
            </>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: photo ? "30px 64px 0" : logo ? "28px 64px 40px" : "0 64px 24px", gap: photo ? 10 : 22, justifyContent: photo || logo ? "flex-start" : "center" }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: DIRECTORY }}>
              {(`LOCAL BUSINESS SPOTLIGHT${biz.category ? `  ·  ${biz.category}` : ""}`).toUpperCase().slice(0, 60)}
            </span>
            <span style={{ fontFamily: "Fraunces", fontSize: name.length > 34 ? (photo ? 60 : 78) : name.length > 22 ? (photo ? 72 : 96) : photo ? 88 : 120, color: NAVY, lineHeight: 1.05 }}>{name}</span>
            {short && <span style={{ fontSize: photo ? 32 : 40, color: INK_SOFT, lineHeight: 1.35 }}>{short}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", height: 110, borderTop: `6px solid ${DIRECTORY}`, background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ringUrl} width={54} height={54} alt="" />
              <span style={{ fontFamily: "Fraunces", fontSize: 38, color: NAVY }}>OneShetland</span>
            </div>
            <span style={{ fontSize: 26, fontWeight: 700, color: INK_SOFT }}>support local · oneshetland.com</span>
          </div>
        </div>
      ),
      opts,
    );
  }

  if (kind === "product") {
    const { data: prod } = await sb
      .from("products")
      .select("title, price_pence, photos, stock_mode, business:local_businesses(name, logo_url)")
      .eq("id", p.get("id") ?? "")
      .maybeSingle();
    if (!prod) return new Response("product not found", { status: 404 });
    const biz = (Array.isArray(prod.business) ? prod.business[0] : prod.business) as { name?: string; logo_url?: string } | null;
    const firstPhoto = Array.isArray(prod.photos) ? (prod.photos as unknown[])[0] : null;
    const photo = firstPhoto ? await coverAsJpegDataUri(firstPhoto, imagePolicy()) : null;
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

  /* ── Regular Activities weekly roundup: a collage of the activities' OWN photographs, or a restrained branded panel ── */
  if (kind === "regular") {
    const ids = (p.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 6);
    // Anonymous read: row security only returns activities that are public, so an unpublished or paused one can never appear on a card.
    const { data: rows } = ids.length ? await sb.from("regular_activities").select("id, title, category, cover_url").in("id", ids) : { data: [] };
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    const items = ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
    const photos = await Promise.all(items.map((r) => coverAsJpegDataUri(r.cover_url as string | null, imagePolicy())));
    const TINT: Record<string, string> = { fitness: "#0f766e", kids_family: "#a15c07", social: "#0a4a70", arts_crafts: "#6d28d9", sport: "#15803d", wellbeing: "#0e7490", music: "#4338ca", learning: "#1d4ed8", faith: "#475569", other: "#0f766e" };
    const n = items.length;
    const Tile = ({ i, w, h, big }: { i: number; w: number; h: number; big: boolean }) => {
      const r = items[i]; const photo = photos[i]; const title = String(r.title ?? ""); const tint = TINT[String(r.category)] ?? TINT.other;
      const size = big ? (title.length > 28 ? 52 : 64) : title.length > 24 ? 36 : 42;
      return (
        <div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 26, overflow: "hidden", background: `linear-gradient(155deg, ${tint} 0%, ${NAVY} 80%)` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={w} height={h} style={{ position: "absolute", top: 0, left: 0, width: w, height: h, objectFit: "cover" }} alt="" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={new URL("/brand/mark-white.png", req.nextUrl.origin).toString()} width={w * 0.9} height={w * 0.9} style={{ position: "absolute", top: -w * 0.3, right: -w * 0.28, opacity: 0.14 }} alt="" />
          )}
          <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, top: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.38) 52%, rgba(0,0,0,0.06) 100%)" }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "absolute", left: 0, right: 0, bottom: 0, top: 0, padding: big ? 34 : 26, gap: 8 }}>
            <span style={{ display: "flex", alignSelf: "flex-start", whiteSpace: "nowrap", background: "#ffffff", color: "#0f766e", borderRadius: 999, padding: "5px 16px", fontSize: big ? 22 : 19, fontWeight: 700, letterSpacing: 2 }}>{(big ? (CATEGORY_LABEL[String(r.category)] ?? "Activity") : (CATEGORY_LABEL[String(r.category)] ?? "Activity").split(" & ")[0]).toUpperCase().slice(0, 22)}</span>
            <span style={{ fontFamily: "Fraunces", fontSize: size, color: "#ffffff", lineHeight: 1.05 }}>{title.length > 44 ? `${title.slice(0, 43)}…` : title}</span>
          </div>
        </div>
      );
    };
    const GAP = 14, W = SIZE - 80, H = 1080 - 200 - 110 - 14;      // area under the header, above the footer
    const cols = (k: number, total = W) => Math.floor((total - GAP * (k - 1)) / k);
    const rowsOf = (k: number, total = H) => Math.floor((total - GAP * (k - 1)) / k);
    let grid: React.ReactNode = null;
    if (n === 1) grid = <Tile i={0} w={W} h={H} big />;
    else if (n === 2) grid = <div style={{ display: "flex", gap: GAP }}><Tile i={0} w={cols(2)} h={H} big /><Tile i={1} w={cols(2)} h={H} big /></div>;
    else if (n === 3) grid = <div style={{ display: "flex", gap: GAP }}><Tile i={0} w={Math.floor(W * 0.58)} h={H} big /><div style={{ display: "flex", flexDirection: "column", gap: GAP }}><Tile i={1} w={W - Math.floor(W * 0.58) - GAP} h={rowsOf(2)} big={false} /><Tile i={2} w={W - Math.floor(W * 0.58) - GAP} h={rowsOf(2)} big={false} /></div></div>;
    else if (n === 4) grid = <div style={{ display: "flex", flexDirection: "column", gap: GAP }}><div style={{ display: "flex", gap: GAP }}><Tile i={0} w={cols(2)} h={rowsOf(2)} big /><Tile i={1} w={cols(2)} h={rowsOf(2)} big={false} /></div><div style={{ display: "flex", gap: GAP }}><Tile i={2} w={cols(2)} h={rowsOf(2)} big={false} /><Tile i={3} w={cols(2)} h={rowsOf(2)} big={false} /></div></div>;
    else if (n === 5) grid = <div style={{ display: "flex", flexDirection: "column", gap: GAP }}><div style={{ display: "flex", gap: GAP }}><Tile i={0} w={cols(2)} h={Math.floor(H * 0.55)} big /><Tile i={1} w={cols(2)} h={Math.floor(H * 0.55)} big /></div><div style={{ display: "flex", gap: GAP }}>{[2, 3, 4].map((i) => <Tile key={i} i={i} w={cols(3)} h={H - Math.floor(H * 0.55) - GAP} big={false} />)}</div></div>;
    else if (n >= 6) grid = <div style={{ display: "flex", flexDirection: "column", gap: GAP }}><div style={{ display: "flex", gap: GAP }}>{[0, 1, 2].map((i) => <Tile key={i} i={i} w={cols(3)} h={rowsOf(2)} big={false} />)}</div><div style={{ display: "flex", gap: GAP }}>{[3, 4, 5].map((i) => <Tile key={i} i={i} w={cols(3)} h={rowsOf(2)} big={false} />)}</div></div>;
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent="#0f766e">
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 40px 0", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", height: 142, gap: 6, paddingLeft: 8 }}>
              <Eyebrow text="Regular activities" color="#0f766e" />
              <span style={{ fontFamily: "Fraunces", fontSize: 70, color: NAVY, lineHeight: 1.05 }}>Something new this week</span>
            </div>
            {grid ?? <span style={{ fontSize: 36, color: INK_SOFT }}>Classes, clubs and groups across Shetland: oneshetland.com</span>}
          </div>
        </Frame>
      ),
      opts,
    );
  }

  /* ── Accessible Shetland ───────────────────────────────────────────────── */
  if (kind === "access") {
    const format = p.get("format") ?? "awareness";
    const ACCESS = "#0b5d76";        // deep teal-blue: 8:1 on cream
    let eyebrow = "Accessible Shetland"; let title = "Plan your visit on your own terms."; let sub = "Practical information about access, facilities and assistance, shared by local places and the organisations who know most."; let chips: string[] = []; let foot = "";
    if (format === "resource") {
      const r = RESOURCE_SECTIONS.flatMap((sec) => sec.items).find((x) => x.slug === (p.get("slug") ?? ""));
      if (!r) return new Response("resource not found", { status: 404 });
      eyebrow = "Accessible Shetland · Helpful resource"; title = r.title; sub = r.about; foot = `From ${r.by}`;
    } else if (format === "business") {
      // Anonymous read: only a business whose access information is PUBLISHED and not hidden can be drawn. Free text, contact lines and staff notes are never selected.
      const id = p.get("id") ?? "";
      const { data: prof } = await sb.from("accessibility_profiles").select("verification, verified_on").eq("subject_type", "business").eq("subject_id", id).maybeSingle();
      const { data: biz } = await sb.from("local_businesses_public").select("name").eq("id", id).maybeSingle();
      if (!prof || !biz) return new Response("not found", { status: 404 });
      const { data: facts } = await sb.from("accessibility_facts").select("facility, status").eq("subject_type", "business").eq("subject_id", id).in("status", ["available", "partial"]).limit(30);
      const label = new Map(ALL_FACILITIES.map((f) => [f.key, f.label]));
      chips = (facts ?? []).filter((f) => label.has(f.facility as string)).sort((a, b) => (a.status === b.status ? 0 : a.status === "available" ? -1 : 1)).slice(0, 6).map((f) => `${label.get(f.facility as string)}${f.status === "partial" ? " (partly)" : ""}`);
      eyebrow = "Accessible Shetland · Shared by the business"; title = String(biz.name ?? ""); sub = "has shared information about access and facilities, to help people plan a visit.";
      foot = `${PROVENANCE_LABEL[prof.verification as keyof typeof PROVENANCE_LABEL] ?? "Provided by the business"}${prof.verification === "independently_checked" && prof.verified_on ? ` · checked ${prof.verified_on}` : ""}`;
    }
    const big = title.length > 46 ? 62 : title.length > 28 ? 74 : 88;
    return new ImageResponse(
      (
        <Frame ringUrl={ringUrl} accent={ACCESS}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 72px", gap: 28, justifyContent: "center" }}>
            <Eyebrow text={eyebrow} color={ACCESS} />
            <span style={{ fontFamily: "Fraunces", fontSize: big, color: NAVY, lineHeight: 1.06 }}>{title}</span>
            <span style={{ fontSize: 40, color: INK, lineHeight: 1.35 }}>{sub}</span>
            {chips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
                {chips.map((c) => <span key={c} style={{ display: "flex", background: "#ffffff", border: `3px solid ${ACCESS}`, color: INK, borderRadius: 14, padding: "10px 20px", fontSize: 32, fontWeight: 700 }}>{c}</span>)}
              </div>
            )}
            {foot ? <span style={{ fontSize: 32, fontWeight: 700, color: INK_SOFT, marginTop: 14 }}>{foot}</span> : null}
          </div>
        </Frame>
      ),
      opts,
    );
  }

  return new Response("unknown kind", { status: 400 });
}
