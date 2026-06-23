"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [area, setArea] = useState(profile.location_area ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const sb = createClient();
    const { error } = await sb
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        location_area: area.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", profile.id);
    if (error) {
      setStatus("error");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="auth-input" />
        </Field>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="auth-input" placeholder="Shown publicly" />
        </Field>
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" />
        </Field>
        <Field label="Area">
          <input value={area} onChange={(e) => setArea(e.target.value)} className="auth-input" placeholder="e.g. Lerwick" />
        </Field>
      </div>
      <Field label="Bio">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="auth-input" placeholder="A short line about you" />
      </Field>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-pill bg-navy px-6 py-2.5 font-semibold text-paper transition hover:bg-navy-dark disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>}
        {status === "error" && <span className="text-sm font-semibold text-rose-600">Couldn&apos;t save — try again.</span>}
      </div>
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
