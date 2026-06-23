"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type ManagedBusiness } from "@/lib/business-data";
import { updateBusiness } from "@/lib/business-client";

const CATEGORIES = [
  { v: "food_drink", l: "Food & drink" }, { v: "retail", l: "Retail" }, { v: "services", l: "Services" },
  { v: "tourism", l: "Tourism" }, { v: "accommodation", l: "Accommodation" }, { v: "other", l: "Other" },
];

export function ProfileManager({ business }: { business: ManagedBusiness }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: business.name ?? "", description: business.description ?? "", category: business.category ?? "other",
    phone: business.phone ?? "", website: business.website ?? "", email: business.email ?? "",
    address: business.address ?? "", brand_color: business.brand_color ?? BIZ, tags: (business.tags ?? []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };

  async function save() {
    setBusy(true); setError(null);
    try {
      await updateBusiness(business.id, {
        name: f.name.trim(), description: f.description.trim() || null, category: f.category,
        phone: f.phone.trim() || null, website: f.website.trim() || null, email: f.email.trim() || null,
        address: f.address.trim() || null, brand_color: f.brand_color,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      } as Partial<ManagedBusiness>);
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

  return (
    <div className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      <div><label className={lab}>Business name</label><input className={field} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
      <div><label className={lab}>Category</label>
        <select className={field} value={f.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </div>
      <div><label className={lab}>Description</label><textarea className={field + " min-h-[110px]"} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
      <div><label className={lab}>Address</label><input className={field} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lab}>Phone</label><input className={field} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className={lab}>Email</label><input className={field} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>
      <div><label className={lab}>Website</label><input className={field} value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></div>
      <div><label className={lab}>Tags (comma-separated)</label><input className={field} value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="coffee, takeaway, vegan" /></div>
      <div>
        <label className={lab}>Brand colour</label>
        <div className="flex items-center gap-3">
          <input type="color" value={f.brand_color} onChange={(e) => set("brand_color", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line" />
          <input className={field} value={f.brand_color} onChange={(e) => set("brand_color", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-ink-faint">Logo &amp; cover photo upload is available in the app; everything else can be edited here.</p>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: BIZ }}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save changes"}</button>
    </div>
  );
}
