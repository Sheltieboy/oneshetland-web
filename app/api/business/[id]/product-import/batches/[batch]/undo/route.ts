import { friendlyDbError, isResponse, json, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "business-media";

/**
 * POST …/batches/{batch}/undo — take an import back, all or nothing.
 * The database refuses, with the reasons, if any product it created has been published, has an order, has stock
 * held, or has been edited since. If it succeeds, the photos it copied into storage are removed too.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; batch: string }> }) {
  const { id, batch } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  if (!/^[0-9a-f-]{36}$/i.test(batch)) return json({ error: "Import not found." }, 404);
  const { data: b } = await owner.sb.from("import_batches").select("id").eq("id", batch).eq("business_id", id).maybeSingle();
  if (!b) return json({ error: "Import not found." }, 404);

  const { data, error } = await owner.sb.rpc("import_undo_batch", { p_batch: batch });
  if (error) return json({ error: friendlyDbError(error) }, 409);
  const res = data as { ok: boolean; blockers?: unknown[]; storage_paths?: string[] };
  if (!res.ok) return json({ ok: false, blockers: res.blockers ?? [] });

  // Best effort: the products are already gone, so a storage hiccup must not turn a finished undo into an error.
  let removed = 0;
  const paths = (res.storage_paths ?? []).filter((p) => p.startsWith(`${id}/products/`) && !p.includes(".."));
  if (paths.length) {
    const { data: gone } = await owner.sb.storage.from(BUCKET).remove(paths);
    removed = gone?.length ?? 0;
  }
  return json({ ...res, photos_removed: removed, storage_paths: undefined });
}
