"use client";

import { useEffect, useState, useCallback } from "react";
import { BIZ } from "@/lib/business-data";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  fetchBusinessServices,
  createService,
  updateService,
  deleteService,
  formatPence,
  formatDuration,
  type BookService,
  type ServiceUpsertInput,
} from "@/lib/book-manage-items";

const field =
  "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
const labelCls = "mb-1 block text-sm font-semibold text-ink-soft";

type FormState = {
  name: string;
  description: string;
  duration_minutes: string;
  buffer_minutes: string;
  capacity: string;
  price: string;
  requires_deposit: boolean;
  deposit: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  duration_minutes: "30",
  buffer_minutes: "0",
  capacity: "1",
  price: "",
  requires_deposit: false,
  deposit: "",
};

function toForm(s: BookService): FormState {
  return {
    name: s.name,
    description: s.description ?? "",
    duration_minutes: String(s.duration_minutes),
    buffer_minutes: String(s.buffer_minutes),
    capacity: String(s.capacity),
    price: (s.price_pence / 100).toFixed(2),
    requires_deposit: s.requires_deposit,
    deposit: (s.deposit_pence / 100).toFixed(2),
  };
}

export function ServicesManager({ businessId }: { businessId: string }) {
  const confirm = useConfirm();
  const [services, setServices] = useState<BookService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorId, setEditorId] = useState<string | "new" | null>(null);
  const [f, setF] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setServices(await fetchBusinessServices(businessId, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load services.");
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
  function openEdit(s: BookService) {
    setError(null);
    setF(toForm(s));
    setEditorId(s.id);
  }
  function close() {
    setEditorId(null);
  }

  async function save() {
    setError(null);
    const name = f.name.trim();
    if (!name) return setError("Give your service a short name.");

    const duration = parseInt(f.duration_minutes, 10);
    if (!duration || duration < 5 || duration > 600) return setError("Duration must be between 5 minutes and 10 hours.");

    const buffer = parseInt(f.buffer_minutes, 10) || 0;
    if (buffer < 0) return setError("Buffer can't be negative.");

    const capacity = parseInt(f.capacity, 10) || 1;
    if (capacity < 1 || capacity > 999) return setError("Capacity must be between 1 and 999.");

    const priceNum = parseFloat(f.price || "0");
    if (Number.isNaN(priceNum) || priceNum < 0) return setError("Enter a valid price.");
    const pricePence = Math.round(priceNum * 100);

    let depositPence = 0;
    if (f.requires_deposit) {
      const depNum = parseFloat(f.deposit || "0");
      if (Number.isNaN(depNum) || depNum <= 0) return setError("Enter a deposit amount, or turn the deposit toggle off.");
      depositPence = Math.round(depNum * 100);
      if (pricePence > 0 && depositPence > pricePence) return setError("Deposit can't exceed the service price.");
    }

    const payload: ServiceUpsertInput = {
      name,
      description: f.description.trim() || null,
      duration_minutes: duration,
      buffer_minutes: buffer,
      capacity,
      price_pence: pricePence,
      requires_deposit: f.requires_deposit,
      deposit_pence: depositPence,
      is_active: true,
    };

    setBusy(true);
    try {
      if (editorId === "new") await createService(businessId, payload);
      else if (editorId) await updateService(editorId, payload);
      close();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save service.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: BookService) {
    if (!(await confirm({ title: `Remove "${s.name}"?`, body: "It won't appear to new customers. Existing bookings stay as-is.", confirmLabel: "Remove", danger: true }))) return;
    setError(null);
    try {
      await deleteService(s.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove service.");
    }
  }

  const isNew = editorId === "new";

  const editor = (
    <div className="space-y-3 rounded-card border border-line bg-paper p-5 shadow-soft">
      <p className="font-display text-lg font-bold text-ink">{isNew ? "New service" : "Edit service"}</p>
      <div>
        <label className={labelCls}>Name</label>
        <input className={field} maxLength={80} placeholder="e.g. Ladies cut & blow-dry" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Description (optional)</label>
        <textarea className={field + " min-h-[70px]"} maxLength={240} placeholder="What's included, prep required, etc." value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Duration (mins)</label>
          <input className={field} type="number" inputMode="numeric" placeholder="30" value={f.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Buffer after (mins)</label>
          <input className={field} type="number" inputMode="numeric" placeholder="0" value={f.buffer_minutes} onChange={(e) => set("buffer_minutes", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>How many can you serve at once?</label>
        <input className={field} type="number" inputMode="numeric" placeholder="1" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} />
        <p className="mt-1 text-xs text-ink-muted">1 = single resource. Higher = multiple tables / chairs / staff that can take bookings at the same time.</p>
      </div>
      <div>
        <label className={labelCls}>Price (£)</label>
        <input className={field} type="number" step="any" inputMode="decimal" placeholder="0.00 — leave 0 for 'price on request'" value={f.price} onChange={(e) => set("price", e.target.value)} />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Require a deposit</p>
          <p className="text-xs text-ink-muted">Customers pay the deposit to lock the slot.</p>
        </div>
        <button type="button" onClick={() => set("requires_deposit", !f.requires_deposit)} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition" style={{ background: f.requires_deposit ? BIZ : "var(--color-line-strong)" }}>
          <span className={"inline-block h-5 w-5 transform rounded-full bg-white shadow transition " + (f.requires_deposit ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      {f.requires_deposit && (
        <div>
          <label className={labelCls}>Deposit amount (£)</label>
          <input className={field} type="number" step="any" inputMode="decimal" placeholder="e.g. 5.00" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={busy} className="flex-1 rounded-pill py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BIZ }}>
          {busy ? "Saving…" : isNew ? "Add service" : "Save changes"}
        </button>
        <button onClick={close} className="rounded-pill border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand">Cancel</button>
      </div>
    </div>
  );

  if (loading) return <p className="text-sm text-ink-muted">Loading services…</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {editorId === "new" ? (
        editor
      ) : (
        <button onClick={openNew} className="rounded-pill px-5 py-2.5 text-sm font-semibold text-white shadow-soft" style={{ background: BIZ }}>
          + New service
        </button>
      )}

      {services.length === 0 && editorId !== "new" ? (
        <p className="rounded-card border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-ink-muted">
          No services yet. Add the things people can book — a Ladies Cut, a Pedicure, a Table for 2…
        </p>
      ) : (
        <div className="space-y-3">
          {services.map((s) =>
            editorId === s.id ? (
              <div key={s.id}>{editor}</div>
            ) : (
              <div key={s.id} className={"flex items-start justify-between gap-3 rounded-card border border-line bg-paper p-4 shadow-soft" + (s.is_active ? "" : " opacity-60")}>
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {s.name}
                    {!s.is_active && <span className="ml-2 rounded-pill bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-muted">Hidden</span>}
                  </p>
                  {s.description && <p className="mt-0.5 text-sm text-ink-muted">{s.description}</p>}
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatDuration(s.duration_minutes)}
                    {s.buffer_minutes > 0 && ` · +${s.buffer_minutes}m buffer`}
                    {s.capacity > 1 && ` · ${s.capacity} at once`}
                    {" · "}
                    {formatPence(s.price_pence)}
                    {s.requires_deposit && s.deposit_pence > 0 && (
                      <span style={{ color: BIZ }} className="font-semibold"> · {formatPence(s.deposit_pence)} deposit</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => openEdit(s)} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand">Edit</button>
                  {s.is_active && (
                    <button onClick={() => remove(s)} className="rounded-pill border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">Remove</button>
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
