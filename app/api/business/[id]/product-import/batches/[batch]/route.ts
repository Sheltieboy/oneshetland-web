import { screenText } from "@/lib/product-import/restricted";
import { isResponse, json, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET …/batches/{batch} — the batch, every staged item, and the live state of the products it made. Powers the
 * progress, result and publish screens, and lets an interrupted import be picked up from any browser.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; batch: string }> }) {
  const { id, batch } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  if (!/^[0-9a-f-]{36}$/i.test(batch)) return json({ error: "Import not found." }, 404);
  const sb = owner.sb;

  const { data: b } = await sb.from("import_batches")
    .select("id, status, preset, filename, total_items, counts, created_at, started_at, completed_at, undo_expires_at, undone_at")
    .eq("id", batch).eq("business_id", id).maybeSingle();
  if (!b) return json({ error: "Import not found." }, 404);

  const { data: rows } = await sb.from("import_rows")
    .select("id, item_index, row_numbers, action, status, title, ext_ref, sku, product_id, target_product_id, errors, warnings, result, image_status, image_results")
    .eq("batch_id", batch).order("item_index").limit(500);

  const productIds = (rows ?? []).map((r) => r.product_id as string | null).filter((x): x is string => !!x);
  const { data: products } = productIds.length
    ? await sb.from("products").select("id, title, description, category, price_pence, photos, is_active").in("id", productIds)
    : { data: [] };
  const byId = new Map((products ?? []).map((p) => [p.id as string, p]));

  const items = (rows ?? []).map((r) => {
    const p = r.product_id ? byId.get(r.product_id as string) : undefined;
    let publish: "live" | "ready" | "needs_photo" | "needs_review" | "blocked" | "none" = "none";
    if (p) {
      const hits = screenText(p.title, p.description, p.category);
      publish = p.is_active ? "live"
        : hits.some((h) => h.level === "block") ? "blocked"
        : !p.photos?.length ? "needs_photo"
        : hits.some((h) => h.level === "warn") ? "needs_review"
        : "ready";
    }
    const imageProblems = ((r.image_results as { url: string; ok: boolean; error?: string }[] | null) ?? [])
      .filter((x) => x && x.ok === false).map((x) => x.error ?? "A photo could not be imported");
    return { ...r, product: p ? { id: p.id, title: p.title, photos: p.photos?.length ?? 0, is_active: p.is_active } : null, publish, imageProblems };
  });
  return json({ batch: b, items });
}
