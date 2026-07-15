"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Row = { id: string; slug: string; name: string; display_order: number };
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function RegionsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [list, setList] = useState(rows);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const sb = createClient();
      const row = { name: name.trim(), slug: slugify(name), display_order: order ? Number(order) : list.length + 1 };
      const { data } = await sb.from("regions").insert(row).select("id, slug, name, display_order").single();
      if (data) setList((l) => [...l, data as Row].sort((a, b) => a.display_order - b.display_order));
      setName(""); setOrder(""); router.refresh();
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!(await confirm({ title: "Delete this region?", body: "Existing data referencing it may be affected.", confirmLabel: "Delete", danger: true }))) return;
    setBusy(true);
    try { await createClient().from("regions").delete().eq("id", id); setList((l) => l.filter((r) => r.id !== id)); router.refresh(); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 font-display font-bold text-ink">Add a region</p>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Region name e.g. Unst" className="auth-input flex-1" />
          <input value={order} onChange={(e) => setOrder(e.target.value)} type="number" placeholder="Order" className="auth-input w-24" />
          <button onClick={add} disabled={busy || !name.trim()} className="rounded-pill bg-rose-600 px-5 py-2.5 font-semibold text-white hover:brightness-95 disabled:opacity-40">Add</button>
        </div>
        {name && <p className="mt-2 text-xs text-ink-faint">Slug: {slugify(name) || "—"}</p>}
      </Card>

      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 shadow-soft">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-sand text-xs font-bold text-ink-muted">{r.display_order}</span>
            <span className="flex-1 font-semibold text-ink">{r.name} <span className="font-mono text-xs font-normal text-ink-faint">/{r.slug}</span></span>
            <button onClick={() => remove(r.id)} disabled={busy} className="rounded-pill border border-line-strong px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
