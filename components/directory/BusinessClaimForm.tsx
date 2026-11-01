"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { submitClaim } from "@/lib/claim-submit";

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
        body={`Your claim for ${businessName} is being checked. We check every claim by hand, and we'll email you the outcome.`}
      />
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <StateCard
        title="Claim received — thank you"
        body={`We've got your claim for ${businessName} and sent you a confirmation email. We check every claim by hand, and we'll email you as soon as there's an outcome. Once it's approved you can manage your listing — claiming is free, and you can stay on the free plan as long as you like.`}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await submitClaim(createClient(), { businessId, contactName, contactEmail, contactPhone, role, evidence });
      if (r.status === "error") { setError(r.message); setBusy(false); return; }
      setSubmitted(true);     // "submitted" and "duplicate" both mean: your claim is in
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
        Claiming is <strong>free</strong>. Tell us a little about your connection to this business. We check each claim by hand to keep
        the Directory trustworthy and email you the outcome — once it&apos;s approved the listing is yours to manage, and you can upgrade later if you want to.
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
