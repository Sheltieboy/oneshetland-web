import { inspectFile } from "@/lib/product-import/analyse";
import { isResponse, json, readUpload, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/business/{id}/product-import/inspect   (multipart: file)
 * Reads the file's header and says which export it looks like. Writes nothing.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;
  const up = await readUpload(request);
  if (!up.ok) return up.response;
  const out = inspectFile(up.bytes, up.filename);
  if ("error" in out) return json(out, 400);
  return json(out);
}
