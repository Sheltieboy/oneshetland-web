import { friendlyDbError, isResponse, json, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST …/batches/{batch}/apply — create the next chunk of draft products. Safe to call again after any interruption. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; batch: string }> }) {
  const { id, batch } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  if (!/^[0-9a-f-]{36}$/i.test(batch)) return json({ error: "Import not found." }, 404);
  const { data: b } = await owner.sb.from("import_batches").select("id").eq("id", batch).eq("business_id", id).maybeSingle();
  if (!b) return json({ error: "Import not found." }, 404);
  const { data, error } = await owner.sb.rpc("import_apply_next", { p_batch: batch, p_limit: 20 });
  if (error) return json({ error: friendlyDbError(error) }, error.code === "55006" ? 409 : 400);
  return json(data);
}
