"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/local-data";
import { findListed, likelyDuplicate, createDecision, claimHref, listingHref, type ListedBusiness, type MatchKind } from "@/lib/business-match";

const DIR = "#4f46e5";

export function BusinessCreateForm({
  isLoggedIn,
  plan = null,
  initialName = "",
}: {
  isLoggedIn: boolean;
  plan?: "pro" | "premium" | null;
  /** Carried over from the /business finder when nothing matched what was typed. */
  initialName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  // Is this business already in the Directory? Checked as the name is typed, and again on submit.
  const [similar, setSimilar] = useState<(ListedBusiness & { kind: MatchKind })[]>([]);
  const [differentBusiness, setDifferentBusiness] = useState(false);
  const seq = useRef(0);
  const duplicate = likelyDuplicate(name, similar);
  useEffect(() => {
    const term = name.trim();
    setDifferentBusiness(false);
    if (term.length < 3) { setSimilar([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try { const found = await findListed(createClient(), term); if (mine === seq.current) setSimilar(found); }
      catch { if (mine === seq.current) setSimilar([]); }   // a failed lookup never blocks someone adding their business
    }, 350);
    return () => clearTimeout(t);
  }, [name]);
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
          href={`/sign-in?next=${encodeURIComponent(`/directory/new${(() => { const q = new URLSearchParams(); if (plan) q.set("plan", plan); if (initialName) q.set("name", initialName); const s = q.toString(); return s ? `?${s}` : ""; })()}`)}`}
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
      // Re-check at the moment of creating, so a listing that appeared while the form was open (or a lookup that was still in flight) is not missed.
      if (!differentBusiness) {
        const found = await findListed(sb, name.trim()).catch(() => []);
        setSimilar(found);
        if (!createDecision(name, found, false).allowed) { setBusy(false); return setError("This looks like a business that is already listed. Claiming it is free — or tick the box below if yours is a different business."); }
      }
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
        // `local_businesses` has no locality column — keep the area inside the
        // address text so it stays searchable by the directory area filter.
        // address is NOT NULL, so fall back to "Shetland" when both are blank.
        address: [address.trim(), locality.trim()].filter(Boolean).join(", ") || "Shetland",
        is_active: true,
        is_claimed: true,
        source: "owner",
        subscription_tier: "free",
      }).select("id, slug").single();
      if (dbErr) throw dbErr;
      // A paid plan was chosen on the way in → go straight to checkout for it,
      // rather than the public listing, so they can pay there and then.
      if (plan) router.push(`/business/${data.id}/manage/billing?plan=${plan}`);
      // Otherwise into the management area. It used to land on the new public
      // listing, which is the one page that tells a new owner nothing about
      // what to do next — they had just created a business and were shown it
      // as a stranger would see it, with no route back to managing it. The id
      // is used rather than the slug because this route is keyed on the id.
      else router.push(`/business/${data.id}/manage`);
    } catch (e) {
      // Supabase PostgrestError isn't an Error instance — surface its real
      // message/details so the actual reason shows instead of a generic string.
      const err = e as { message?: string; details?: string; hint?: string; code?: string } | null;
      console.error("[directory] create listing failed:", err);
      setError(err?.message || err?.details || err?.hint || "Could not create listing.");
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

      {duplicate && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4" role="alert" data-testid="duplicate-warning">
          <p className="font-semibold text-amber-900">Is it one of these? It may already be listed.</p>
          <p className="mt-0.5 text-sm text-amber-900/80">Claiming an existing listing is free and keeps the Directory free of duplicates.</p>
          <ul className="mt-3 space-y-2">
            {similar.filter((m) => m.kind !== "possible").map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{m.name}{m.address ? <span className="font-normal text-ink-muted"> · {m.address}</span> : null}</span>
                {m.is_claimed
                  ? <Link href={listingHref(m)} className="shrink-0 text-sm font-semibold text-ink-soft underline">Already claimed</Link>
                  : <Link href={claimHref(m)} className="shrink-0 rounded-pill bg-[#7c3aed] px-3 py-1.5 text-sm font-bold text-paper">Claim it free</Link>}
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
            <input type="checkbox" checked={differentBusiness} onChange={(e) => setDifferentBusiness(e.target.checked)} className="mt-0.5" />
            <span>None of these is my business — create a new listing.</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !name.trim() || !category || (duplicate && !differentBusiness)}
        className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
        style={{ background: DIR }}
      >
        {busy ? "Creating your listing…" : "Create free listing"}
      </button>
    </form>
  );
}
