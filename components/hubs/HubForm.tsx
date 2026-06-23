"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createHub, updateHub, uploadHubMedia, type HubInput } from "@/lib/hubs-client";
import { HUB_TYPES, HUB_TYPE_LABELS, HUB_COLOR, type Hub, type HubType, type JoinMode } from "@/lib/hubs-data";
import { HubTypeIcon } from "./HubTypeIcon";

const PALETTE = ["#6b47bf", "#12b3d6", "#2a8b5c", "#d4921a", "#e0722a", "#9f1239", "#1e3a8a", "#0f766e", "#7c3aed", "#be185d"];

export function HubForm({ hub }: { hub?: Hub }) {
  const router = useRouter();
  const editing = !!hub;

  const [name, setName] = useState(hub?.name ?? "");
  const [type, setType] = useState<HubType>(hub?.type ?? "community");
  const [description, setDescription] = useState(hub?.description ?? "");
  const [area, setArea] = useState(hub?.area ?? "");
  const [brandColor, setBrandColor] = useState(hub?.brand_color ?? HUB_COLOR);
  const [email, setEmail] = useState(hub?.contact_email ?? "");
  const [phone, setPhone] = useState(hub?.contact_phone ?? "");
  const [website, setWebsite] = useState(hub?.website ?? "");
  const [joinMode, setJoinMode] = useState<JoinMode>(hub?.join_mode ?? "approval");
  const [directory, setDirectory] = useState(hub?.directory_enabled ?? false);
  const [isCharity, setIsCharity] = useState(hub?.is_charity ?? false);
  const [charityNo, setCharityNo] = useState(hub?.charity_number ?? "");
  const [logoUrl, setLogoUrl] = useState(hub?.logo_url ?? "");
  const [coverUrl, setCoverUrl] = useState(hub?.cover_url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Please give your hub a name.");
    setError(null);
    setBusy(true);
    try {
      const base: HubInput = {
        name: name.trim(),
        type,
        description: description.trim() || null,
        area: area.trim() || null,
        brand_color: brandColor,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        website: website.trim() || null,
        join_mode: joinMode,
        directory_enabled: directory,
        is_charity: isCharity,
        charity_number: isCharity ? charityNo.trim() || null : null,
      };

      let hubId = hub?.id;
      let slug = hub?.slug ?? null;
      if (editing && hub) {
        await updateHub(hub.id, base);
      } else {
        const created = await createHub(base);
        hubId = created.id;
        slug = created.slug;
      }

      // Upload any new media against the (now-existing) hub id, then patch URLs.
      const patch: Partial<HubInput> = {};
      if (logoFile && hubId) patch.logo_url = await uploadHubMedia(hubId, "logo", logoFile);
      if (coverFile && hubId) patch.cover_url = await uploadHubMedia(hubId, "cover", coverFile);
      if (Object.keys(patch).length && hubId) await updateHub(hubId, patch);

      router.push(`/hubs/${slug || hubId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Logo + cover */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePick label="Logo" url={logoUrl} onFile={(f, u) => { setLogoFile(f); setLogoUrl(u); }} accent={brandColor} round />
        <ImagePick label="Cover image" url={coverUrl} onFile={(f, u) => { setCoverFile(f); setCoverUrl(u); }} accent={brandColor} />
      </div>

      <Field label="Hub name">
        <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input" placeholder="e.g. Burra Youth Club" required />
      </Field>

      {/* Type */}
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink">Type</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {HUB_TYPES.map((t) => {
            const on = type === t;
            return (
              <button type="button" key={t} onClick={() => setType(t)}
                className={"flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition " + (on ? "text-paper" : "border-line bg-paper text-ink hover:border-current")}
                style={on ? { background: brandColor, borderColor: brandColor } : { color: brandColor }}>
                <HubTypeIcon type={t} className="h-4 w-4" />
                <span className={on ? "text-paper" : "text-ink"}>{HUB_TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand colour */}
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink">Brand colour</span>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button type="button" key={c} onClick={() => setBrandColor(c)}
              className={"h-9 w-9 rounded-full border-2 transition " + (brandColor.toLowerCase() === c.toLowerCase() ? "border-ink" : "border-transparent")}
              style={{ background: c }} aria-label={c} />
          ))}
          <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-paper" />
        </div>
      </div>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="auth-input" placeholder="What is your hub about?" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area"><input value={area} onChange={(e) => setArea(e.target.value)} className="auth-input" placeholder="e.g. Lerwick" /></Field>
        <Field label="Contact email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" /></Field>
        <Field label="Contact phone"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" /></Field>
        <Field label="Website / social link"><input value={website} onChange={(e) => setWebsite(e.target.value)} className="auth-input" placeholder="https://" /></Field>
      </div>

      {/* Join mode */}
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink">Joining</span>
        <div className="grid grid-cols-2 gap-2">
          {(["open", "approval"] as JoinMode[]).map((m) => (
            <button type="button" key={m} onClick={() => setJoinMode(m)}
              className={"rounded-xl border px-4 py-3 text-sm font-semibold transition " + (joinMode === m ? "text-paper" : "border-line bg-paper text-ink")}
              style={joinMode === m ? { background: brandColor, borderColor: brandColor } : undefined}>
              {m === "open" ? "Anyone can join" : "Approve requests"}
            </button>
          ))}
        </div>
      </div>

      <Toggle label="Member directory" hint="Let members see a privacy-safe list of other members" checked={directory} onChange={setDirectory} accent={brandColor} />
      <Toggle label="Registered charity / CASC" hint="Enables Gift Aid on donations" checked={isCharity} onChange={setIsCharity} accent={brandColor} />
      {isCharity && (
        <Field label="Charity number"><input value={charityNo} onChange={(e) => setCharityNo(e.target.value)} className="auth-input" placeholder="e.g. SC012345" /></Field>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-pill px-5 py-3.5 font-semibold text-paper shadow-soft transition hover:brightness-95 disabled:opacity-50" style={{ background: brandColor }}>
        {busy ? "Saving…" : editing ? "Save changes" : "Create hub"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange, accent }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" style={{ accentColor: accent }} />
    </label>
  );
}

function ImagePick({ label, url, onFile, accent, round }: { label: string; url: string; onFile: (f: File, preview: string) => void; accent: string; round?: boolean }) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <div className={"relative grid h-28 place-items-center overflow-hidden border border-dashed border-line-strong bg-sand/40 " + (round ? "rounded-2xl" : "rounded-xl")}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold" style={{ color: accent }}>+ Upload</span>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f, URL.createObjectURL(f));
      }} />
    </label>
  );
}
