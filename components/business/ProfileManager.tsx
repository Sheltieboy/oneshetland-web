"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIZ, type ManagedBusiness } from "@/lib/business-data";
import { updateBusiness, uploadBusinessMedia } from "@/lib/business-client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

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

  // Branding images: keep the saved URL + any freshly-picked File (uploaded on Save).
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");
  const [coverUrl, setCoverUrl] = useState(business.cover_url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");

  function pick(kind: "logo" | "cover", file: File | undefined) {
    setSaved(false); setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError("Image is too large — please choose one under 5MB."); return; }
    const preview = URL.createObjectURL(file);
    if (kind === "logo") { setLogoFile(file); setLogoPreview(preview); }
    else { setCoverFile(file); setCoverPreview(preview); }
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const patch: Partial<ManagedBusiness> = {
        name: f.name.trim(), description: f.description.trim() || null, category: f.category,
        phone: f.phone.trim() || null, website: f.website.trim() || null, email: f.email.trim() || null,
        address: f.address.trim() || null, brand_color: f.brand_color,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (logoFile) { const url = await uploadBusinessMedia(business.id, "logo", logoFile); patch.logo_url = url; setLogoUrl(url); setLogoFile(null); setLogoPreview(""); }
      if (coverFile) { const url = await uploadBusinessMedia(business.id, "cover", coverFile); patch.cover_url = url; setCoverUrl(url); setCoverFile(null); setCoverPreview(""); }
      await updateBusiness(business.id, patch);
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-ink shadow-soft outline-none placeholder:text-ink-faint";
  const lab = "mb-1 block text-sm font-semibold text-ink-soft";

  const logoShown = logoPreview || logoUrl;
  const coverShown = coverPreview || coverUrl;

  return (
    <div className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-soft">
      {/* Cover photo — wide banner */}
      <div>
        <label className={lab}>Cover photo</label>
        <label className="block cursor-pointer">
          <div className="relative grid h-32 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-sand/40">
            {coverShown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverShown} alt="Cover preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold" style={{ color: BIZ }}>+ Add cover photo</span>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("cover", e.target.files?.[0])} />
        </label>
      </div>
      {/* Logo — square/small */}
      <div>
        <label className={lab}>Logo</label>
        <div className="flex items-center gap-4">
          <label className="block cursor-pointer">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-sand/40">
              {logoShown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoShown} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold" style={{ color: BIZ }}>+ Add</span>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("logo", e.target.files?.[0])} />
          </label>
          <p className="text-xs text-ink-faint">Square works best. PNG or JPG, up to 5MB. Uploads when you save.</p>
        </div>
      </div>
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
      {error &&<p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button onClick={save} disabled={busy} className="w-full rounded-pill py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-50" style={{ background: BIZ }}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save changes"}</button>
    </div>
  );
}
