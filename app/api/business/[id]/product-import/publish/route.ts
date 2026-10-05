import { screenText } from "@/lib/product-import/restricted";
import { friendlyDbError, isResponse, json, requireOwner } from "@/lib/product-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/business/{id}/product-import/publish   { productIds: string[], acknowledgePolicy?: string[] }
 *
 * Publishing is the SAME act as pressing Show on a product you typed in: an ordinary `is_active = true` update made
 * with the owner's own session, so the terms guard and the Premium/launch-grant guard in the database decide.
 * In front of it, the checks the manual screen makes (payout readiness) and the ones an unattended bulk upload
 * needs: a photo, a sane price, and the policy screen. There is no service-role path and no bypass.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const owner = await requireOwner(id);
  if (isResponse(owner)) return owner;

  let body: { productIds?: unknown; acknowledgePolicy?: unknown };
  try { body = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
  const ids = Array.isArray(body.productIds) ? body.productIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500) : [];
  if (!ids.length) return json({ error: "Choose at least one product." }, 400);
  const ack = new Set(Array.isArray(body.acknowledgePolicy) ? body.acknowledgePolicy.filter((x): x is string => typeof x === "string") : []);
  const sb = owner.sb;

  // Same single check as the manual Show button: can money actually be routed to this business?
  const { data: ready, error: readyErr } = await sb.rpc("business_payout_ready", { p_business: id });
  if (readyErr || ready !== true) {
    return json({ ok: false, code: "payout_not_ready", error: "Connect Stripe before making products available to customers. Your drafts are safe." }, 409);
  }

  const { data: products } = await sb.from("products")
    .select("id, title, description, category, price_pence, photos, is_active").eq("business_id", id).in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id as string, p]));

  const results: { id: string; title: string; ok: boolean; reason?: string }[] = [];
  for (const pid of ids) {
    const p = byId.get(pid);
    if (!p) { results.push({ id: pid, title: "", ok: false, reason: "Not found in this shop." }); continue; }
    if (p.is_active) { results.push({ id: pid, title: p.title, ok: true, reason: "Already live." }); continue; }
    if (!p.photos?.length) { results.push({ id: pid, title: p.title, ok: false, reason: "Add a photo first — listings without photos don't sell." }); continue; }
    if (!p.title?.trim() || p.price_pence < 50) { results.push({ id: pid, title: p.title, ok: false, reason: "It needs a title and a price of at least £0.50." }); continue; }
    const hits = screenText(p.title, p.description, p.category);
    const blocked = hits.find((h) => h.level === "block");
    if (blocked) { results.push({ id: pid, title: p.title, ok: false, reason: `Not allowed on OneShetland: ${blocked.reason}.` }); continue; }
    if (hits.some((h) => h.level === "warn") && !ack.has(pid)) { results.push({ id: pid, title: p.title, ok: false, reason: `Needs your confirmation: ${hits[0].reason}.` }); continue; }
    const { error } = await sb.from("products").update({ is_active: true }).eq("id", pid).eq("business_id", id);
    results.push(error ? { id: pid, title: p.title, ok: false, reason: friendlyDbError(error) } : { id: pid, title: p.title, ok: true });
  }
  return json({ ok: true, results, published: results.filter((r) => r.ok && r.reason !== "Already live.").length });
}
