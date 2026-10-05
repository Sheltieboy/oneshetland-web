/**
 * server.ts — what every product-import route handler shares.
 *
 * No service-role key, ever: every read and write is made with the signed-in
 * owner's own session, so row-level security, the terms guard, the plan guard
 * and the storage policies decide exactly as they do for a product typed by
 * hand. See migration 20261105000000_product_import_foundation.sql.
 */
import { createClient } from '@/lib/supabase/server';
import { MAX_BYTES } from './csv.ts';
import type { ExistingProduct, ExistingVariant } from './plan.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export type OwnerCtx = { sb: SupabaseClient; user: User; businessId: string };

/** Signed in AND the owner of this business — or a Response to return as-is. */
export async function requireOwner(businessId: string): Promise<OwnerCtx | Response> {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return json({ error: 'Business not found.' }, 404);
  const sb = (await createClient()) as unknown as SupabaseClient;
  const { data } = await sb.auth.getUser();
  if (!data.user) return json({ error: 'Sign in to import products.' }, 401);
  const { data: biz } = await sb.from('local_businesses').select('id, owner_id').eq('id', businessId).maybeSingle();
  if (!biz) return json({ error: 'Business not found.' }, 404);
  if (biz.owner_id !== data.user.id) return json({ error: 'Only the owner of this business can import products.' }, 403);
  return { sb, user: data.user, businessId };
}
export const isResponse = (x: unknown): x is Response => x instanceof Response;

/** Read the multipart upload: the file's bytes plus the plain fields. Bounded before it is read. */
export async function readUpload(request: Request): Promise<
  { ok: true; bytes: Uint8Array; filename: string; fields: Record<string, string> } | { ok: false; response: Response }
> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BYTES + 64 * 1024) {
    return { ok: false, response: json({ error: 'That file is over 2 MB. Split it into smaller files.' }, 413) };
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return { ok: false, response: json({ error: 'Upload could not be read.' }, 400) }; }
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, response: json({ error: 'Choose a CSV file first.' }, 400) };
  if (file.size > MAX_BYTES) return { ok: false, response: json({ error: 'That file is over 2 MB. Split it into smaller files.' }, 413) };
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string' && v.length < 20_000) fields[k] = v;
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name.slice(0, 200), fields };
}

/** Everything the matcher needs about this business's products — and only this business's. */
export async function loadExistingProducts(sb: SupabaseClient, businessId: string): Promise<ExistingProduct[]> {
  const { data: products } = await sb.from('products')
    .select('id, title, sku, external_source, external_ref, description, category, price_pence, compare_at_pence, stock_mode, stock, lead_time_days, collect_only, free_uk_post, photos, is_active, reserved, source_hash, source_locked_fields')
    .eq('business_id', businessId).limit(5000);
  const list = (products ?? []) as Omit<ExistingProduct, 'variants'>[];
  const byProduct = new Map<string, ExistingVariant[]>();
  const ids = list.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: vs } = await sb.from('product_variants')
      .select('id, product_id, name, sku, price_delta_pence, stock, reserved, is_active').in('product_id', ids.slice(i, i + 200));
    for (const v of (vs ?? []) as (ExistingVariant & { product_id: string })[]) {
      const arr = byProduct.get(v.product_id) ?? []; arr.push(v); byProduct.set(v.product_id, arr);
    }
  }
  // Photos earlier imports already copied, by the web address they came from.
  const known = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows } = await sb.from('import_rows')
      .select('product_id, payload, status, image_status')
      .in('product_id', ids.slice(i, i + 200)).eq('status', 'applied').in('image_status', ['done', 'partial']);
    for (const r of (rows ?? []) as { product_id: string; payload: { image_urls?: string[] } }[]) {
      const arr = known.get(r.product_id) ?? []; arr.push(...(r.payload?.image_urls ?? [])); known.set(r.product_id, arr);
    }
  }
  return list.map((p) => ({ ...p, photos: p.photos ?? [], source_locked_fields: p.source_locked_fields ?? [], variants: byProduct.get(p.id) ?? [], known_image_urls: known.get(p.id) ?? [] }));
}

/** A database error, in words a merchant can act on. */
export function friendlyDbError(e: { message?: string; code?: string } | null | undefined): string {
  const m = e?.message ?? 'Something went wrong.';
  if (/terms/i.test(m)) return m;
  if (/Premium/i.test(m)) return m;
  if (/still running/i.test(m)) return 'Another import for this shop is still running. Finish or wait for it, then try again.';
  if (/Too many imports/i.test(m)) return 'You have reached today\'s import limit. Try again tomorrow.';
  if (/business you own|Sign in/i.test(m)) return m;
  return m.length > 300 ? `${m.slice(0, 300)}…` : m;
}
