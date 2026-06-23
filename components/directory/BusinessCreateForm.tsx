"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/local-data";

const DIR = "#6b47bf";

export function BusinessCreateForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
        <p className="font-display text-xl font-bold">Sign in to add your business</p>
        <p className="mt-2 text-ink-soft">You need a free OneShetland account to create a listing.</p>
        <a
          href="/sign-in?next=/directory/new"
          className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper transition hover:brightness-95"
          style={{ background: DIR }}
        >
          Sign in or create account
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category) return setError("Business name and category are required.");
    setError(null);
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { data, error: dbErr } = await sb.from("local_businesses").insert({
        owner_id: user.id,
        name: name.trim(),
        category,
        description: description.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        locality: locality.trim() || null,
        is_active: true,
        is_claimed: true,
        source: "owner",
        subscription_tier: "free",
      }).select("id, slug").single();
      if (dbErr) throw dbErr;
      router.push(`/directory/${data.slug ?? data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create listing.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-line bg-paper p-6 shadow-soft sm:p-8">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-ink">
          Business name <span className="text-rose-500">*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Fullerton Croft, Lerwick Bakehouse…"
          className="auth-input mt-1.5"
          required
        />
      </div>

      {/* Category */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">
          Category <span className="text-rose-500">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={"rounded-pill border px-4 py-1.5 text-sm font-semibold transition " + (category === c.key ? "text-paper" : "border-line bg-sand text-ink hover:border-line-strong")}
              style={category === c.key ? { background: DIR, borderColor: DIR } : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-ink">What do you do? (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="A short description — what you offer, who you're for, what makes you worth a visit."
          className="auth-input mt-1.5 resize-none"
        />
      </div>

      {/* Location */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Address (optional)</label>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, village…" className="auth-input mt-1.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Area (optional)</label>
          <input value={locality} onChange={e => setLocality(e.target.value)} placeholder="e.g. Lerwick, Yell, Unst…" className="auth-input mt-1.5" />
        </div>
      </div>

      {/* Contact */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-ink">Phone (optional)</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01595…" className="auth-input mt-1.5" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink">Email (optional)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@…" className="auth-input mt-1.5" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">Website (optional)</label>
        <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" className="auth-input mt-1.5" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <p className="text-xs text-ink-muted">
        Your listing goes live immediately. You can add photos, offers, loyalty and more from the OneShetland app.
      </p>

      <button
        type="submit"
        disabled={busy || !name.trim() || !category}
        className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
        style={{ background: DIR }}
      >
        {busy ? "Creating your listing…" : "Create free listing"}
      </button>
    </form>
  );
}
