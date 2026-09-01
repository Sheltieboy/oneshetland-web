"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { PlanNote } from "@/components/business/CapabilityPaywall";
import {
  PRODUCT_CATEGORIES, gbp,
  type Product, type ProductVariant, type BusinessShipping, type StockMode,
} from "@/lib/shop-data";

/**
 * ProductsManager — the merchant side of Shop Shetland.
 * Photo-first add flow with Peerie Bot drafting; three plain-English stock
 * modes; variants as simple rows (≤2 option axes worth, flattened to names);
 * plus the one-per-business fulfilment rate card.
 */

const SHOP = "#4f46e5";

const pounds = (pence: number | null | undefined) => (pence == null ? "" : (pence / 100).toFixed(2));
const toPence = (s: string): number | null => {
  const n = Number(String(s).replace(/[£\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

async function uploadProductPhoto(businessId: string, file: File): Promise<string> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${businessId}/products/${crypto.randomUUID()}.${ext}`;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/business-media/${path}`, {
    method: "POST",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${session.access_token}`, "x-upsert": "true" },
    body: form,
  });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status})`);
  return sb.storage.from("business-media").getPublicUrl(path).data.publicUrl;
}

type VariantRow = { id?: string; name: string; delta: string; stock: string };

type FormState = {
  id?: string;
  title: string;
  description: string;
  category: string;
  price: string;
  photos: string[];
  stock_mode: StockMode;
  stock: string;
  lead_time_days: string;
  collect_only: boolean;
  free_uk_post: boolean;
  variants: VariantRow[];
};

const EMPTY: FormState = {
  title: "", description: "", category: "other", price: "", photos: [],
  stock_mode: "tracked", stock: "", lead_time_days: "14",
  collect_only: false, free_uk_post: false, variants: [],
};

export function ProductsManager({ businessId, products: initial, variantsByProduct, shipping: initialShipping, canPublish }: {
  businessId: string;
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  shipping: BusinessShipping | null;
  /** Effective Premium. Everything else on this page works without it. */
  canPublish: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rough, setRough] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));

  function editProduct(p: Product) {
    setForm({
      id: p.id, title: p.title, description: p.description ?? "", category: p.category ?? "other",
      price: pounds(p.price_pence), photos: p.photos ?? [],
      stock_mode: p.stock_mode, stock: p.stock == null ? "" : String(p.stock),
      lead_time_days: p.lead_time_days == null ? "14" : String(p.lead_time_days),
      collect_only: p.collect_only, free_uk_post: p.free_uk_post,
      variants: (variantsByProduct[p.id] ?? []).map((v) => ({ id: v.id, name: v.name, delta: v.price_delta_pence ? pounds(v.price_delta_pence) : "", stock: v.stock == null ? "" : String(v.stock) })),
    });
    setMsg(null);
  }

  async function askPeerieBot() {
    if (!rough.trim() || botBusy) return;
    setBotBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/ai/draft-product", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, rough }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Peerie Bot had a moment");
      const d = data.draft as { title: string; description: string; price_pence: number; category: string; variants: string[] };
      setForm((f) => ({
        ...(f ?? EMPTY),
        title: d.title, description: d.description, category: d.category,
        price: d.price_pence > 0 ? pounds(d.price_pence) : (f?.price ?? ""),
        variants: d.variants.length ? d.variants.map((name) => ({ name, delta: "", stock: "" })) : (f?.variants ?? []),
      }));
      setMsg("Drafted by Peerie Bot ✨ — check it over, add photos and a price.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Peerie Bot had a moment");
    } finally { setBotBusy(false); }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !form) return;
    setBusy(true); setMsg(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 5 - form.photos.length)) {
        urls.push(await uploadProductPhoto(businessId, f));
      }
      set({ photos: [...form.photos, ...urls] });
    } catch (e) { setMsg(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!form) return;
    const price = toPence(form.price);
    if (!form.title.trim()) return setMsg("Give it a title");
    if (!price || price < 50) return setMsg("Price needs to be at least £0.50");
    if (form.photos.length === 0) return setMsg("Add at least one photo — listings without photos don't sell");
    setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      const row = {
        business_id: businessId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        price_pence: price,
        photos: form.photos,
        stock_mode: form.stock_mode,
        stock: form.stock_mode === "tracked" && form.stock !== "" ? Math.max(0, Math.floor(Number(form.stock))) : null,
        lead_time_days: form.stock_mode === "made_to_order" ? Math.min(90, Math.max(1, Math.floor(Number(form.lead_time_days) || 14))) : null,
        collect_only: form.collect_only,
        free_uk_post: form.free_uk_post,
        is_active: canPublish,
      };
      let productId = form.id;
      if (productId) {
        const { error } = await sb.from("products").update(row).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("products").insert(row).select("id").single();
        if (error) throw error;
        productId = (data as { id: string }).id;
      }
      // Variants: replace-all keeps the mental model simple for merchants.
      const keepIds = form.variants.filter((v) => v.id).map((v) => v.id as string);
      const { data: existing } = await sb.from("product_variants").select("id").eq("product_id", productId);
      const toDelete = (existing ?? []).map((e) => e.id).filter((id) => !keepIds.includes(id));
      if (toDelete.length) await sb.from("product_variants").delete().in("id", toDelete);
      for (let i = 0; i < form.variants.length; i++) {
        const v = form.variants[i];
        if (!v.name.trim()) continue;
        const vrow = {
          product_id: productId, name: v.name.trim(), position: i,
          price_delta_pence: toPence(v.delta) ?? 0,
          stock: v.stock === "" ? null : Math.max(0, Math.floor(Number(v.stock))),
          is_active: canPublish,
        };
        if (v.id) await sb.from("product_variants").update(vrow).eq("id", v.id);
        else await sb.from("product_variants").insert(vrow);
      }
      setForm(null); setRough("");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }

  async function toggleActive(p: Product) {
    const sb = createClient();
    await sb.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    router.refresh();
  }

  async function remove(p: Product) {
    if (!(await confirm({ title: `Delete "${p.title}"?`, body: "Past orders keep their receipt copy; the listing goes for good.", confirmLabel: "Delete" }))) return;
    const sb = createClient();
    await sb.from("products").delete().eq("id", p.id);
    router.refresh();
  }

  const stockLabel = (p: Product) =>
    p.stock_mode === "made_to_order" ? `Made to order · ${p.lead_time_days ?? 14}d`
    : p.stock_mode === "one_off" ? (p.sold_at ? "Sold" : "One-off")
    : p.stock == null ? "In stock" : `${Math.max(0, p.stock - p.reserved)} in stock`;

  return (
    <div className="space-y-6">
      {/* ── Add / edit form ─────────────────────────────────────────────── */}
      {form ? (
        <div className="rounded-card border bg-white p-5 shadow-soft" style={{ borderColor: `${SHOP}55` }}>
          <p className="mb-3 font-display text-lg font-bold text-navy">{form.id ? "Edit product" : "New product"}</p>

          {!form.id && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cream/60 p-2.5">
              <span className="text-sm font-bold text-ink-soft">✨ Peerie Bot</span>
              <input value={rough} onChange={(e) => setRough(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askPeerieBot(); } }}
                placeholder="Rough notes — e.g. 'aran gansey, shetland wool, s to xl, £85'"
                className="min-w-40 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm" />
              <button onClick={askPeerieBot} disabled={botBusy || !rough.trim()}
                className="rounded-pill bg-navy px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">
                {botBusy ? "Drafting…" : "Draft it"}
              </button>
            </div>
          )}

          <div className="space-y-3">
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title"
              className="auth-input" aria-label="Product title" maxLength={200} />
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3}
              placeholder="A couple of sentences about it…" className="auth-input" aria-label="Description" />
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                Price £<input value={form.price} onChange={(e) => set({ price: e.target.value })} inputMode="decimal" placeholder="0.00"
                  className="w-24 rounded-lg border border-line px-2 py-1.5" aria-label="Price in pounds" />
              </label>
              <select value={form.category} onChange={(e) => set({ category: e.target.value })}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" aria-label="Category">
                {PRODUCT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Photos */}
            <div>
              <div className="flex flex-wrap gap-2">
                {form.photos.map((url, i) => (
                  <span key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-20 w-20 rounded-xl border border-line object-cover" />
                    <button onClick={() => set({ photos: form.photos.filter((_, j) => j !== i) })}
                      aria-label="Remove photo"
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-xs font-bold text-white">×</button>
                  </span>
                ))}
                {form.photos.length < 5 && (
                  <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-2xl text-ink-faint hover:border-teal">
                    ＋<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">Up to 5 photos. The first is the main one.</p>
            </div>

            {/* Stock mode */}
            <div className="flex flex-wrap items-center gap-2">
              {([["tracked", "I have stock"], ["made_to_order", "Made to order"], ["one_off", "One-off"]] as [StockMode, string][]).map(([mode, label]) => (
                <button key={mode} onClick={() => set({ stock_mode: mode })}
                  className={"rounded-pill px-4 py-1.5 text-sm font-bold transition " + (form.stock_mode === mode ? "text-white" : "border border-line text-ink-soft hover:bg-sand")}
                  style={form.stock_mode === mode ? { background: SHOP } : undefined}>
                  {label}
                </button>
              ))}
              {form.stock_mode === "tracked" && (
                <input value={form.stock} onChange={(e) => set({ stock: e.target.value })} inputMode="numeric" placeholder="Qty (blank = plenty)"
                  className="w-40 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label="Stock quantity" />
              )}
              {form.stock_mode === "made_to_order" && (
                <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                  allow <input value={form.lead_time_days} onChange={(e) => set({ lead_time_days: e.target.value })} inputMode="numeric"
                    className="w-14 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label="Lead time days" /> days
                </label>
              )}
            </div>

            {/* Variants */}
            <div>
              <p className="text-sm font-bold text-ink-soft">Options <span className="font-normal text-ink-muted">(sizes, colours — optional)</span></p>
              {form.variants.map((v, i) => (
                <div key={i} className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input value={v.name} onChange={(e) => set({ variants: form.variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}
                    placeholder="e.g. Medium · Navy" className="min-w-36 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label={`Option ${i + 1} name`} />
                  <label className="flex items-center gap-1 text-xs text-ink-muted">+£
                    <input value={v.delta} onChange={(e) => set({ variants: form.variants.map((x, j) => j === i ? { ...x, delta: e.target.value } : x) })}
                      inputMode="decimal" placeholder="0" className="w-16 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label={`Option ${i + 1} extra price`} />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-ink-muted">qty
                    <input value={v.stock} onChange={(e) => set({ variants: form.variants.map((x, j) => j === i ? { ...x, stock: e.target.value } : x) })}
                      inputMode="numeric" placeholder="—" className="w-14 rounded-lg border border-line px-2 py-1.5 text-sm" aria-label={`Option ${i + 1} stock`} />
                  </label>
                  <button onClick={() => set({ variants: form.variants.filter((_, j) => j !== i) })} aria-label="Remove option"
                    className="text-sm font-bold text-rose-600">×</button>
                </div>
              ))}
              <button onClick={() => set({ variants: [...form.variants, { name: "", delta: "", stock: "" }] })}
                className="mt-1.5 text-sm font-bold" style={{ color: SHOP }}>＋ Add option</button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.collect_only} onChange={(e) => set({ collect_only: e.target.checked })} /> Collect only (no posting)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.free_uk_post} onChange={(e) => set({ free_uk_post: e.target.checked })} /> Free UK postage</label>
            </div>
          </div>

          {msg && <p className="mt-3 text-sm font-semibold text-teal-dark" role="status">{msg}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {/* Quiet, and quiet on purpose — nothing here blocks saving. */}
            <Link href="/selling-policy" target="_blank" className="text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">
              What can I sell on OneShetland?
            </Link>
            <div className="flex gap-2">
            <button onClick={() => { setForm(null); setMsg(null); }} className="rounded-pill px-4 py-2 text-sm font-bold text-ink-muted hover:bg-sand">Cancel</button>
            <button onClick={save} disabled={busy}
              className="rounded-pill px-5 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: SHOP }}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add product"}
            </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(EMPTY); setMsg(null); }}
          className="w-full rounded-card border-2 border-dashed border-line bg-white/60 p-4 text-sm font-bold text-ink-soft transition hover:bg-white"
          style={{ borderColor: `${SHOP}66` }}>
          ＋ Add a product
        </button>
      )}

      {/* ── Product list ────────────────────────────────────────────────── */}
      {initial.length > 0 && (
        <ul className="space-y-2">
          {initial.map((p) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-card border border-line bg-white p-3 shadow-soft ${p.is_active ? "" : "opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.photos[0] ? <img src={p.photos[0]} alt="" className="h-14 w-14 rounded-xl border border-line object-cover" />
                : <span className="grid h-14 w-14 place-items-center rounded-xl bg-cream text-xl">🛍️</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.title}</p>
                <p className="text-xs text-ink-muted">{gbp(p.price_pence)} · {stockLabel(p)}{p.is_active ? "" : " · hidden"}</p>
              </div>
              <button onClick={() => editProduct(p)} className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand">Edit</button>
              {/* Hiding is always allowed; showing is what needs the plan. */}
              <button
                onClick={() => toggleActive(p)}
                disabled={!canPublish && !p.is_active}
                title={!canPublish && !p.is_active ? "Publishing products needs Premium" : undefined}
                className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink-soft hover:bg-sand disabled:opacity-50"
              >{p.is_active ? "Hide" : "Show"}</button>
              <button onClick={() => remove(p)} className="rounded-pill border border-line px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Delete</button>
            </li>
          ))}
        </ul>
      )}

      <ShippingCard businessId={businessId} initial={initialShipping} />
    </div>
  );
}

/* ── Fulfilment rate card — one per business ─────────────────────────────── */

function ShippingCard({ businessId, initial }: { businessId: string; initial: BusinessShipping | null }) {
  const router = useRouter();
  const [collect, setCollect] = useState(initial?.collect_enabled ?? true);
  const [collectNote, setCollectNote] = useState(initial?.collect_note ?? "");
  const [post, setPost] = useState(initial?.post_enabled ?? false);
  const [fetchIt, setFetchIt] = useState(initial?.fetch_enabled ?? false);
  const [shet, setShet] = useState(pounds(initial?.post_shetland_pence));
  const [uk, setUk] = useState(pounds(initial?.post_uk_pence));
  const [extra, setExtra] = useState(pounds(initial?.post_per_extra_item_pence ?? 0));
  const [freeOver, setFreeOver] = useState(pounds(initial?.free_over_pence));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (post && toPence(uk) == null && toPence(shet) == null) return setMsg("Set at least one postage price");
    setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      const { error } = await sb.from("business_shipping").upsert({
        business_id: businessId,
        collect_enabled: collect,
        collect_note: collectNote.trim() || null,
        post_enabled: post,
        fetch_enabled: fetchIt,
        post_shetland_pence: toPence(shet),
        post_uk_pence: toPence(uk),
        post_per_extra_item_pence: toPence(extra) ?? 0,
        free_over_pence: toPence(freeOver),
      });
      if (error) throw error;
      setMsg("Saved");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-soft">
      <p className="font-display text-lg font-bold text-navy">Getting orders to customers</p>
      <p className="mt-0.5 text-sm text-ink-soft">Set once — applies to every product.</p>

      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} /> Collect from us — free
      </label>
      {collect && (
        <input value={collectNote} onChange={(e) => setCollectNote(e.target.value)} placeholder="Pickup note — e.g. 'Commercial St, Mon–Sat 9–5'"
          className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" aria-label="Collection note" />
      )}

      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> Post orders
      </label>
      {post && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">Within Shetland £
            <input value={shet} onChange={(e) => setShet(e.target.value)} inputMode="decimal" placeholder="same as UK" className="w-20 text-right outline-none" aria-label="Shetland postage" /></label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">Rest of the UK £
            <input value={uk} onChange={(e) => setUk(e.target.value)} inputMode="decimal" placeholder="4.95" className="w-20 text-right outline-none" aria-label="UK postage" /></label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">Each extra item +£
            <input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="0" className="w-20 text-right outline-none" aria-label="Per extra item" /></label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">Free postage over £
            <input value={freeOver} onChange={(e) => setFreeOver(e.target.value)} inputMode="decimal" placeholder="—" className="w-20 text-right outline-none" aria-label="Free over threshold" /></label>
        </div>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={fetchIt} onChange={(e) => setFetchIt(e.target.checked)} /> Fetch delivery 🚗
      </label>
      <p className="mt-1 text-xs text-ink-muted">A OneShetland community driver collects the order from you and takes it to the buyer, usually within a day or two. The buyer pays the driver&rsquo;s fee — nothing for you to set up; just have the order ready when a driver&rsquo;s assigned.</p>

      <div className="mt-3 flex items-center justify-end gap-3">
        {msg && <span className="text-sm font-semibold text-teal-dark" role="status">{msg}</span>}
        <button onClick={save} disabled={busy} className="rounded-pill bg-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
