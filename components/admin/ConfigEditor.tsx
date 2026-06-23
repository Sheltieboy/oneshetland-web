"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";

type Row = { key: string; value: string | null; description: string | null; category: string | null };

export function ConfigEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""])));
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function save(key: string, value?: string) {
    setBusy(key); setSaved(null);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      // Upsert so this also works for keys that don't have a row yet.
      await sb.from("admin_config").upsert({ key, value: value ?? vals[key], updated_by: user?.id ?? null }, { onConflict: "key" });
      setSaved(key); setTimeout(() => setSaved(null), 1500);
      router.refresh();
    } finally { setBusy(null); }
  }

  async function addKey() {
    const key = newKey.trim();
    if (!key) return;
    setAdding(true);
    try { await save(key, newValue.trim()); setNewKey(""); setNewValue(""); } finally { setAdding(false); }
  }

  const groups = [...new Set(rows.map((r) => r.category ?? "Other"))];
  return (
    <div className="space-y-8">
      {/* Add / set any key (upsert) */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Add or set a key</h2>
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key e.g. stripe.price.local_addon" className="auth-input flex-1 text-sm font-mono" />
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="value" className="auth-input flex-1 text-sm" />
            <button onClick={addKey} disabled={adding || !newKey.trim()} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{adding ? "Saving…" : "Set"}</button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Use for keys not yet listed below (creates the row). Existing keys can also be edited in place.</p>
        </Card>
      </section>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-3 font-display text-lg font-bold capitalize text-ink">{g}</h2>
          <div className="space-y-3">
            {rows.filter((r) => (r.category ?? "Other") === g).map((r) => (
              <Card key={r.key}>
                <p className="font-mono text-sm font-semibold text-ink">{r.key}</p>
                {r.description && <p className="mt-0.5 text-sm text-ink-muted">{r.description}</p>}
                <div className="mt-2 flex gap-2">
                  <input value={vals[r.key]} onChange={(e) => setVals((v) => ({ ...v, [r.key]: e.target.value }))} className="auth-input flex-1 text-sm" />
                  <button onClick={() => save(r.key)} disabled={busy === r.key} className="rounded-pill bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">{saved === r.key ? "Saved ✓" : "Save"}</button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
