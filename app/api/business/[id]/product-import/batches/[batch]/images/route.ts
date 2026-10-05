import { fetchImage, ImageFetchError } from "@/lib/product-import/image-fetch";
import { friendlyDbError, isResponse, json, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "business-media";
const PER_IMAGE_TIMEOUT_MS = 8_000;

/**
 * POST …/batches/{batch}/images — bring in the photos for ONE imported product.
 *
 * The product row is claimed in the database (so two tabs cannot do the same one, and an abandoned claim is
 * picked up again after five minutes). Each web address is fetched by the SSRF-safe fetcher, checked by its bytes,
 * and re-hosted under {business}/products/{product}/ in business-media with the OWNER's session — the storage
 * policy that governs a hand-uploaded photo governs this. Nothing is hot-linked. A photo that fails is recorded
 * against the row and never stops the batch or the product.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; batch: string }> }) {
  const { id, batch } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  if (!/^[0-9a-f-]{36}$/i.test(batch)) return json({ error: "Import not found." }, 404);
  const sb = owner.sb;

  const { data: claim, error } = await sb.rpc("import_claim_image_row", { p_batch: batch });
  if (error) return json({ error: friendlyDbError(error) }, 400);
  if (!claim) {
    const { data: b } = await sb.from("import_batches").select("status, counts").eq("id", batch).eq("business_id", id).maybeSingle();
    return json({ done: true, status: b?.status ?? null, counts: b?.counts ?? null });
  }

  const row = claim as { row_id: string; product_id: string; business_id: string; urls: string[]; existing_photos: string[] };
  if (row.business_id !== id) return json({ error: "Import not found." }, 404);
  const room = Math.max(0, 5 - row.existing_photos.length);
  const urls = row.urls.slice(0, room);

  const results = await Promise.all(urls.map(async (url) => {
    try {
      const img = await fetchImage(url, { timeoutMs: PER_IMAGE_TIMEOUT_MS });
      const path = `${id}/products/${row.product_id}/imp-${img.sha256.slice(0, 16)}.${img.ext}`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: true, cacheControl: "31536000" });
      if (upErr) return { url, ok: false, error: "Could not store the photo" };
      return { url, ok: true, hosted: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    } catch (e) {
      return { url, ok: false, error: e instanceof ImageFetchError ? e.message : "Could not download the photo" };
    }
  }));

  const hosted = results.filter((r) => r.ok).map((r) => (r as { hosted: string }).hosted);
  const logged = results.map((r) => ({ url: r.url, ok: r.ok, ...(r.ok ? {} : { error: (r as { error: string }).error }) }));
  const { data: set, error: setErr } = await sb.rpc("import_set_row_images", { p_row: row.row_id, p_photos: hosted, p_results: logged });
  if (setErr) return json({ error: friendlyDbError(setErr) }, 400);
  return json({ done: false, processed: 1, photos: hosted.length, failed: results.length - hosted.length, status: (set as { status: string }).status });
}
