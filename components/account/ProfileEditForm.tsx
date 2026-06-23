"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AREAS = [
  "Lerwick", "Scalloway", "Brae", "Aith", "Walls", "Sandness", "Sandwick", "Bigton", "Cunningsburgh",
  "Bixter", "Whiteness", "Weisdale", "Tingwall", "Nesting", "Vidlin", "Voe", "Mossbank", "Toft",
  "Hillswick", "North Roe", "Yell", "Unst", "Fetlar", "Whalsay", "Out Skerries", "Bressay", "Burra",
  "Trondra", "Foula", "Fair Isle", "Papa Stour",
];

type Initial = { full_name: string; display_name: string; bio: string; location_area: string; phone: string; avatar_url: string; games_handle: string };
type HandleState = "idle" | "checking" | "free" | "taken" | "invalid";

export function ProfileEditForm({ userId, initial }: { userId: string; initial: Initial }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [bio, setBio] = useState(initial.bio);
  const [area, setArea] = useState(initial.location_area);
  const [phone, setPhone] = useState(initial.phone);
  const [handle, setHandle] = useState(initial.games_handle);
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [handleState, setHandleState] = useState<HandleState>("idle");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live games-handle uniqueness check (debounced)
  useEffect(() => {
    const h = handle.trim();
    if (!h || h === initial.games_handle) { setHandleState("idle"); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(h)) { setHandleState("invalid"); return; }
    setHandleState("checking");
    const t = setTimeout(async () => {
      try {
        const { data } = await createClient().from("profiles").select("id").eq("games_handle", h).neq("id", userId).maybeSingle();
        setHandleState(data ? "taken" : "free");
      } catch { setHandleState("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [handle, initial.games_handle, userId]);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const sb = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      setAvatar(data.publicUrl);
    } catch (e) { setError(e instanceof Error ? `Avatar upload failed: ${e.message}` : "Avatar upload failed."); }
    finally { setUploading(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (handleState === "taken" || handleState === "invalid") { setError("Fix the games handle before saving."); return; }
    setError(null); setBusy(true); setSaved(false);
    try {
      const sb = createClient();
      const { error: dbErr } = await sb.from("profiles").update({
        full_name: fullName.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location_area: area || null,
        phone: phone.trim() || null,
        games_handle: handle.trim() || null,
        avatar_url: avatar || null,
      }).eq("id", userId);
      if (dbErr) throw dbErr;
      setSaved(true);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  const handleMsg: Record<HandleState, string> = { idle: "", checking: "Checking…", free: "Available ✓", taken: "Already taken", invalid: "3–20 letters, numbers or _" };
  const handleColor: Record<HandleState, string> = { idle: "", checking: "text-ink-muted", free: "text-emerald-600", taken: "text-rose-600", invalid: "text-rose-600" };

  return (
    <form onSubmit={save} className="space-y-6 rounded-card border border-line bg-paper p-6 shadow-soft sm:p-8">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-sand font-display text-2xl font-bold text-ink-faint">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (fullName || "U").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-pill border border-line-strong px-4 py-2 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-40">{uploading ? "Uploading…" : "Change photo"}</button>
          {avatar && <button type="button" onClick={() => setAvatar("")} className="ml-2 text-sm font-semibold text-ink-muted hover:text-ink">Remove</button>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="auth-input mt-1.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown publicly (optional)" className="auth-input mt-1.5" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short line about you — shown on job applications and public profiles." className="auth-input mt-1.5 resize-none" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Area</label>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="auth-input mt-1.5">
            <option value="">Choose your area…</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Private — account recovery only" className="auth-input mt-1.5" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Games handle</label>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your leaderboard name (optional)" className="auth-input mt-1.5" />
        {handleState !== "idle" && <p className={"mt-1 text-xs font-semibold " + handleColor[handleState]}>{handleMsg[handleState]}</p>}
        <p className="mt-1 text-xs text-ink-faint">Leave blank to stay anonymous on game leaderboards.</p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Profile saved ✓</p>}

      <button type="submit" disabled={busy || handleState === "taken" || handleState === "invalid"} className="rounded-pill bg-navy px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
