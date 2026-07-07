"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/admin/AdminUI";
import type { HomeContent } from "@/lib/home-data";

type Draft = HomeContent;

export function HomeContentForm({ initial }: { initial: HomeContent }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (field: keyof Draft, value: string) => setDraft((d) => ({ ...d, [field]: value }));

  async function uploadImage(field: "feature_image" | "spotlight_image", file: File) {
    setUploading(field); setMsg(null);
    try {
      const sb = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${field}-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("site-media").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = sb.storage.from("site-media").getPublicUrl(path).data.publicUrl;
      set(field, url);
    } catch (e) {
      setMsg(e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().from("home_content").update({
        welcome_title: draft.welcome_title, welcome_body: draft.welcome_body, welcome_href: draft.welcome_href, welcome_cta: draft.welcome_cta,
        feature_title: draft.feature_title, feature_image: draft.feature_image, feature_href: draft.feature_href,
        spotlight_title: draft.spotlight_title, spotlight_body: draft.spotlight_body, spotlight_image: draft.spotlight_image, spotlight_href: draft.spotlight_href, spotlight_cta: draft.spotlight_cta,
        updated_at: new Date().toISOString(),
      }).eq("id", draft.id);
      setMsg(error ? `Failed: ${error.message}` : "Saved ✓ — refresh the homepage to see it.");
      if (!error) router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? `Failed: ${e.message}` : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-display text-lg font-bold">Welcome tile</h3>
        <p className="mb-3 text-sm text-ink-muted">The intro copy box, top-left of the homepage bento. Leave blank to hide it behind a placeholder.</p>
        <Field label="Headline" value={draft.welcome_title} onChange={(v) => set("welcome_title", v)} placeholder="e.g. Wir ain wee corner o da wab" />
        <TextArea label="Body copy" value={draft.welcome_body} onChange={(v) => set("welcome_body", v)} placeholder="A warm sentence or two introducing OneShetland." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button text (optional)" value={draft.welcome_cta} onChange={(v) => set("welcome_cta", v)} placeholder="Explore" />
          <Field label="Link URL (optional)" value={draft.welcome_href} onChange={(v) => set("welcome_href", v)} placeholder="/whats-on" />
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg font-bold">Featured image tile</h3>
        <p className="mb-3 text-sm text-ink-muted">A tall photo tile. Upload an image — it&apos;s served from the site-media bucket.</p>
        <ImageField label="Image" value={draft.feature_image} uploading={uploading === "feature_image"} onUpload={(f) => uploadImage("feature_image", f)} onClear={() => set("feature_image", "")} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Caption (optional)" value={draft.feature_title} onChange={(v) => set("feature_title", v)} placeholder="Shown over the image" />
          <Field label="Link URL (optional)" value={draft.feature_href} onChange={(v) => set("feature_href", v)} placeholder="/whats-on" />
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg font-bold">Spotlight tile</h3>
        <p className="mb-3 text-sm text-ink-muted">A flexible promo — a campaign, an appeal, an announcement. Optional small image.</p>
        <Field label="Title" value={draft.spotlight_title} onChange={(v) => set("spotlight_title", v)} placeholder="e.g. Support the RNLI Christmas appeal" />
        <TextArea label="Body copy" value={draft.spotlight_body} onChange={(v) => set("spotlight_body", v)} placeholder="A sentence of supporting copy." />
        <ImageField label="Small image (optional)" value={draft.spotlight_image} uploading={uploading === "spotlight_image"} onUpload={(f) => uploadImage("spotlight_image", f)} onClear={() => set("spotlight_image", "")} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Button text" value={draft.spotlight_cta} onChange={(v) => set("spotlight_cta", v)} placeholder="Find out more" />
          <Field label="Link URL" value={draft.spotlight_href} onChange={(v) => set("spotlight_href", v)} placeholder="https://…" />
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy} className="rounded-pill bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50">
          {busy ? "Saving…" : "Save homepage"}
        </button>
        {msg && <p className={`text-sm font-semibold ${msg.startsWith("Saved") ? "text-emerald-700" : "text-rose-700"}`}>{msg}</p>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="auth-input" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className="auth-input resize-none" />
    </label>
  );
}

function ImageField({ label, value, uploading, onUpload, onClear }: { label: string; value: string | null; uploading: boolean; onUpload: (f: File) => void; onClear: () => void }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-sand/40 text-xs text-ink-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : "No image"}
        </div>
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer rounded-pill border border-line-strong px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-sand">
            {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
          </label>
          {value && <button type="button" onClick={onClear} className="text-left text-xs font-semibold text-rose-600 hover:underline">Remove</button>}
        </div>
      </div>
    </div>
  );
}
