import { planFromUpload, planSignature } from "@/lib/product-import/analyse";
import { isResponse, json, loadExistingProducts, readUpload, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/business/{id}/product-import/plan
 *   multipart: file, preset?, mapping? (JSON), allowTitleDuplicates? ("1")
 *
 * The review step. Matches the file against THIS business's products and returns what importing would do. It reads
 * and computes only — nothing is written until /confirm.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  const up = await readUpload(request);
  if (!up.ok) return up.response;

  let mapping: unknown;
  try { mapping = up.fields.mapping ? JSON.parse(up.fields.mapping) : undefined; } catch { return json({ error: "Column choices could not be read." }, 400); }

  const existing = await loadExistingProducts(owner.sb, id);
  const out = planFromUpload(up.bytes, { preset: up.fields.preset, mapping }, existing, { allowTitleDuplicates: up.fields.allowTitleDuplicates === "1" });
  if ("error" in out) return json(out, 400);
  return json({ plan: out.plan, preset: out.preset, mapping: out.mapping, signature: planSignature(out.plan) });
}
