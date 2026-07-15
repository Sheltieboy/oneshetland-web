"use client";

import { useEffect, useState, useCallback } from "react";
import { BIZ } from "@/lib/business-data";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  fetchBusinessUnitItems,
  createUnitItem,
  updateUnitItem,
  deleteUnitItem,
  formatPence,
  type BookUnitItem,
  type UnitItemUpsertInput,
} from "@/lib/book-manage-items";

const field =
  "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
const labelCls = "mb-1 block text-sm font-semibold text-ink-soft";

type FormState = {
  name: string;
  description: string;
  price: string;
  uses_per_purchase: string;
  limit_stock: boolean;
  stock: string;
  has_expiry: boolean;
  valid_days: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  uses_per_purchase: "1",
  limit_stock: false,
  stock: "",
  has_expiry: false,
  valid_days: "",
};

function toForm(i: BookUnitItem): FormState {
  return {
    name: i.name,
    description: i.description ?? "",
    price: (i.price_pence / 100).toFixed(2),
    uses_per_purchase: String(i.uses_per_purchase),
    limit_stock: i.stock !== null,
    stock: i.stock !== null ? String(i.stock) : "",
    has_expiry: i.valid_days !== null,
    valid_days: i.valid_days !== null ? String(i.valid_days) : "",
  };
}

export function UnitItemsManager({ businessId }: { businessId: string }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<BookUnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorId, setEditorId] = useState<string | "new" | null>(null);
  const [f, setF] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setItems(await fetchBusinessUnitItems(businessId, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load passes & packs.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setError(null);
    setF(emptyForm);
    setEditorId("new");
  }
  function openEdit(i: BookUnitItem) {
    setError(null);
    setF(toForm(i));
    setEditorId(i.id);
  }
  function close() {
    setEditorId(null);
  }

  async function save() {
    setError(null);
    const name = f.name.trim();
    if (!name) return setError("Give it a short name.");

    const priceNum = parseFloat(f.price || "0");
    if (Number.isNaN(priceNum) || priceNum <= 0) return setError("Enter a price greater than zero.");
    const pricePence = Math.round(priceNum * 100);

    const uses = parseInt(f.uses_per_purchase, 10) || 1;
    if (uses < 1 || uses > 999) return setError("Uses per purchase must be between 1 and 999.");

    let stock: number | null = null;
    if (f.limit_stock) {
      const stockNum = parseInt(f.stock, 10);
      if (Number.isNaN(stockNum) || stockNum < 0) return setError("Enter a stock number, or turn the stock limit off.");
      stock = stockNum;
    }

    let validDays: number | null = null;
    if (f.has_expiry) {
      const vd = parseInt(f.valid_days, 10);
      if (Number.isNaN(vd) || vd <= 0) return setError("Enter how many days it's valid, or turn the expiry off.");
      validDays = vd;
    }

    const payload: UnitItemUpsertInput = {
      name,
      description: f.description.trim() || null,
      price_pence: pricePence,
      stock,
      valid_days: validDays,
      uses_per_purchase: uses,
      is_active: true,
    };

    setBusy(true);
    try {
      if (editorId === "new") await createUnitItem(businessId, payload);
      else if (editorId) await updateUnitItem(editorId, payload);
      close();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(i: BookUnitItem) {
    if (!(await confirm({ title: `Remove "${i.name}"?`, body: "It won't appear to new customers. Existing purchases stay as-is.", confirmLabel: "Remove", danger: true }))) return;
    setError(null);
    try {
      await deleteUnitItem(i.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove.");
    }
  }

  const isNew = editorId === "new";

  const editor = (
    <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="font-display text-lg font-bold text-ink">{isNew ? "New pass / pack" : "Edit pass / pack"}</p>
      <div>
        <label className={labelCls}>Name</label>
        <input className={field} maxLength={80} placeholder="e.g. Day pass · 10-class pack · Festival ticket" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Description (optional)</label>
        <textarea className={field + " min-h-[70px]"} maxLength={240} placeholder="What does buying this give them?" value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Price (£)</label>
        <input className={field} type="number" step="any" inputMode="decimal" placeholder="0.00" value={f.price} onChange={(e) => set("price", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Uses per purchase</label>
        <input className={field} type="number" inputMode="numeric" placeholder="1" value={f.uses_per_purchase} onChange={(e) => set("uses_per_purchase", e.target.value)} />
        <p className="mt-1 text-xs text-ink-muted">1 = single use (one ticket). Higher for class packs (e.g. 10 uses = a 10-class pack).</p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Limit stock</p>
          <p className="text-xs text-ink-muted">On for finite stock (e.g. 50 tickets). Off for unlimited supply.</p>
        </div>
        <button type="button" onClick={() => set("limit_stock", !f.limit_stock)} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition" style={{ background: f.limit_stock ? BIZ : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (f.limit_stock ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      {f.limit_stock && (
        <input className={field} type="number" inputMode="numeric" placeholder="e.g. 50" value={f.stock} onChange={(e) => set("stock", e.target.value)} />
      )}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Expires after purchase</p>
          <p className="text-xs text-ink-muted">On to set a validity window (e.g. 90 days). Off for no expiry.</p>
        </div>
        <button type="button" onClick={() => set("has_expiry", !f.has_expiry)} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition" style={{ background: f.has_expiry ? BIZ : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (f.has_expiry ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      {f.has_expiry && (
        <div>
          <input className={field} type="number" inputMode="numeric" placeholder="e.g. 90" value={f.valid_days} onChange={(e) => set("valid_days", e.target.value)} />
          <p className="mt-1 text-xs text-ink-muted">Number of days from purchase before it expires.</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={busy} className="flex-1 rounded-pill py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>
          {busy ? "Saving…" : isNew ? "Add pass / pack" : "Save changes"}
        </button>
        <button onClick={close} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
      </div>
    </div>
  );

  if (loading) return <p className="text-sm text-ink-muted">Loading passes & packs…</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {editorId === "new" ? (
        editor
      ) : (
        <button onClick={openNew} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft" style={{ background: BIZ }}>
          + New pass / pack
        </button>
      )}

      {items.length === 0 && editorId !== "new" ? (
        <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">
          Nothing yet. Sell tickets, class packs, day passes, or gift vouchers — things that aren&apos;t tied to a specific time slot.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((i) =>
            editorId === i.id ? (
              <div key={i.id}>{editor}</div>
            ) : (
              <div key={i.id} className={"flex items-start justify-between gap-3 rounded-card border border-line bg-paper p-4 shadow-soft" + (i.is_active ? "" : " opacity-60")}>
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {i.name}
                    {!i.is_active && <span className="ml-2 rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted">Hidden</span>}
                  </p>
                  {i.description && <p className="mt-0.5 text-sm text-ink-muted">{i.description}</p>}
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatPence(i.price_pence)}
                    {" · "}
                    {i.stock === null ? "Unlimited" : `${i.stock} left`}
                    {i.uses_per_purchase > 1 && (
                      <span style={{ color: BIZ }} className="font-semibold"> · {i.uses_per_purchase} uses each</span>
                    )}
                    {i.valid_days !== null && ` · ${i.valid_days}d validity`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => openEdit(i)} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand">Edit</button>
                  {i.is_active && (
                    <button onClick={() => remove(i)} className="rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Remove</button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
