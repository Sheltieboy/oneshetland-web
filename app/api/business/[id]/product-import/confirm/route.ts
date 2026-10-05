import { planFromUpload, planSignature } from "@/lib/product-import/analyse";
import { toDbItem, sha256 } from "@/lib/product-import/plan";
import { friendlyDbError, isResponse, json, loadExistingProducts, readUpload, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/business/{id}/product-import/confirm
 *   multipart: file, preset?, mapping?, allowTitleDuplicates?, signature, idempotencyKey
 *
 * The one step that writes — and it writes only the STAGING record (import_batches / import_rows), never a product.
 * The plan is recomputed here from the file and the shop's current products; if it no longer matches what the
 * merchant reviewed (the shop changed in the meantime) nothing is staged and they are asked to review again.
 * Products are created afterwards, chunk by chunk, by /batches/{batch}/apply.
 *
 * Idempotent: the same idempotencyKey returns the same batch, and re-sending items is harmless, so a dropped
 * connection can simply be retried.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  const up = await readUpload(request);
  if (!up.ok) return up.response;

  const key = up.fields.idempotencyKey ?? "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) return json({ error: "Missing retry key." }, 400);

  let mapping: unknown;
  try { mapping = up.fields.mapping ? JSON.parse(up.fields.mapping) : undefined; } catch { return json({ error: "Column choices could not be read." }, 400); }

  const existing = await loadExistingProducts(owner.sb, id);
  const out = planFromUpload(up.bytes, { preset: up.fields.preset, mapping }, existing, { allowTitleDuplicates: up.fields.allowTitleDuplicates === "1" });
  if ("error" in out) return json(out, 400);

  // A retry after the batch exists must not be refused just because applying has already changed the shop.
  const { data: already } = await owner.sb.from("import_batches").select("id, status, total_items").eq("business_id", id).eq("idempotency_key", key).maybeSingle();
  if (already) return json({ batchId: already.id, status: already.status, resumed: true });

  if (planSignature(out.plan) !== up.fields.signature) {
    return json({ error: "Your products changed while you were reviewing. Please review the plan again.", code: "stale_plan" }, 409);
  }
  const { counts, items } = out.plan;
  if (counts.create + counts.update === 0) return json({ error: "There is nothing to import: no new products and no updates.", code: "nothing_to_do" }, 400);

  const sb = owner.sb;
  const { data: batchId, error: e1 } = await sb.rpc("import_create_batch", {
    p_business: id, p_source: "csv", p_preset: out.preset, p_filename: up.filename,
    p_file_sha256: sha256(Buffer.from(up.bytes).toString("latin1")),
    p_mapping: out.mapping, p_options: { allowTitleDuplicates: up.fields.allowTitleDuplicates === "1" },
    p_total_items: items.length, p_idempotency_key: key,
  });
  if (e1 || !batchId) return json({ error: friendlyDbError(e1) }, e1?.code === "55006" ? 409 : 400);

  const rows = items.map(toDbItem);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await sb.rpc("import_add_rows", { p_batch: batchId, p_items: rows.slice(i, i + 100) });
    if (error) return json({ error: friendlyDbError(error), batchId, code: "stage_failed" }, 400);
  }
  const { error: e3 } = await sb.rpc("import_start_batch", { p_batch: batchId });
  if (e3) return json({ error: friendlyDbError(e3), batchId, code: "start_failed" }, 400);

  return json({ batchId, status: "applying", counts });
}
