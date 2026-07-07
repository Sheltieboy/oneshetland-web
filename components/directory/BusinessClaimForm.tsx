"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const LOCAL = "#7c3aed";

type ExistingStatus = "pending" | "approved" | "rejected";

export function BusinessClaimForm({
  businessId,
  businessName,
  alreadyClaimed,
  existingStatus,
  defaultName,
  defaultPhone,
}: {
  businessId: string;
  businessName: string;
  alreadyClaimed: boolean;
  existingStatus: ExistingStatus | null;
  defaultName: string;
  defaultPhone: string;
}) {
  const [contactName, setContactName] = useState(defaultName);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [role, setRole] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Already claimed by someone ──────────────────────────────────────────────
  if (alreadyClaimed) {
    return (
      <StateCard
        title="Already claimed"
        body={`${businessName} has already been claimed and is being managed by its owner.`}
      />
    );
  }

  // ── This user already has a pending claim ───────────────────────────────────
  if (existingStatus === "pending") {
    return (
      <StateCard
        title="Claim under review"
        body={`Your claim for ${businessName} is being verified. We'll be in touch soon.`}
      />
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <StateCard
        title="Claim submitted — we'll review it"
        body={`Thanks! We'll verify your connection to ${businessName} and get back to you. Once approved you can manage your listing and unlock Pro features.`}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) {
      return setError("Please give your name and a contact email so we can verify you.");
    }
    setError(null);
    setBusy(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const { error: dbErr } = await sb.from("business_claims").insert({
        user_id: user.id,
        business_id: businessId,
        status: "pending",
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || null,
        role: role.trim() || null,
        evidence: evidence.trim() || null,
      });
      if (dbErr) {
        // Duplicate claim (unique constraint) — treat as already-submitted, not an error.
        if (dbErr.code === "23505" || /duplicate/i.test(dbErr.message)) {
          setSubmitted(true);
          return;
        }
        throw dbErr;
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your claim. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-line bg-paper p-6 shadow-soft sm:p-8">
      <div className="flex items-center gap-2.5 rounded-xl border bg-sand/40 px-4 py-3" style={{ borderColor: `${LOCAL}40` }}>
        <span aria-hidden className="text-lg">🏪</span>
        <span className="font-display font-bold text-ink">{businessName}</span>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">
        Tell us a little about your connection to this business. We verify each claim by hand to keep
        the directory trustworthy — once approved, the listing is yours to manage and you can upgrade
        to Pro or Premium.
      </p>

      <div>
        <label className="block text-sm font-semibold text-ink">
          Your name <span className="text-rose-500">*</span>
        </label>
        <input
          value={contactName}
          onChange={e => setContactName(e.target.value)}
          placeholder="Full name"
          className="auth-input mt-1.5"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">
          Contact email <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          value={contactEmail}
          onChange={e => setContactEmail(e.target.value)}
          placeholder="you@business.com"
          autoCapitalize="none"
          className="auth-input mt-1.5"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Contact phone (optional)</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value)}
          placeholder="01595…"
          className="auth-input mt-1.5"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">Your role (optional)</label>
        <input
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="e.g. Owner, Manager"
          className="auth-input mt-1.5"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink">How can we verify you? (optional)</label>
        <textarea
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          rows={3}
          placeholder="e.g. a business email address, your website, or how you're connected"
          className="auth-input mt-1.5 resize-none"
        />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={busy || !contactName.trim() || !contactEmail.trim()}
        className="w-full rounded-pill py-3 font-semibold text-paper transition hover:brightness-95 disabled:opacity-40"
        style={{ background: LOCAL }}
      >
        {busy ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl"
        style={{ background: `${LOCAL}18`, color: LOCAL }}
        aria-hidden
      >
        ✓
      </div>
      <p className="mt-4 font-display text-xl font-bold">{title}</p>
      <p className="mt-2 text-ink-soft">{body}</p>
      <Link
        href="/directory"
        className="mt-5 inline-block rounded-pill px-6 py-3 font-semibold text-paper transition hover:brightness-95"
        style={{ background: LOCAL }}
      >
        Back to Directory
      </Link>
    </div>
  );
}
