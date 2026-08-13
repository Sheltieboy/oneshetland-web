import type { SupabaseClient } from "@supabase/supabase-js";
import { LABELS, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/compliance";

/**
 * lib/compliance.server.ts — recording sign-up consent AFTER email confirmation.
 *
 * WHY THIS EXISTS.
 * The sign-up form logs consent only when `signUp()` returns a session — which
 * only happens when email confirmation is switched OFF. With confirmation ON
 * (the production setting) there is no session at that moment, so nothing was
 * ever written: no terms acceptance, no privacy acceptance, no age
 * confirmation, and the phone number was dropped on the floor.
 *
 * That is the wrong way round. The normal path for a real user produced no
 * audit trail at all, and the audit trail is the entire point of the
 * compliance_log table — it's what you'd have to produce if someone asked you
 * to prove a user accepted the terms.
 *
 * So the consent the user gave on the form is carried through sign-up as user
 * metadata, and written here the moment they confirm their email and a session
 * finally exists.
 */

/** What the sign-up form stashes in `options.data` for us to pick up later. */
type SignupMeta = {
  full_name?: string;
  phone?: string;
  marketing_opt_in?: boolean;
  terms_version?: string;
  privacy_version?: string;
  age_confirmed?: boolean;
};

/**
 * Write the sign-up consent trail for a freshly confirmed user.
 *
 * Idempotent: this route also handles magic-link sign-ins, which would
 * otherwise append a fresh set of consent rows every single time someone
 * signed in that way. If a terms acceptance already exists for this user we
 * assume the trail is written and stop.
 *
 * Never throws — a failure here must not block someone getting into their
 * account. It is logged to the server console so it isn't silently lost.
 */
export async function recordSignupConsent(
  sb: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<void> {
  try {
    const meta = (user.user_metadata ?? {}) as SignupMeta;

    const { data: already } = await sb
      .from("compliance_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_type", "terms.accepted")
      .limit(1)
      .maybeSingle();
    if (already) return;

    const fullName = meta.full_name ?? null;
    const base = {
      user_id: user.id,
      user_email: user.email ?? "",
      user_name: fullName,
      metadata: { source: "web", screen: "sign-up", via: "email-confirmation" },
    };

    const marketedIn = meta.marketing_opt_in === true;
    const rows = [
      {
        ...base,
        event_type: "email.verified",
        document_version: null,
        description: LABELS["email.verified"],
      },
      {
        ...base,
        event_type: "terms.accepted",
        document_version: meta.terms_version ?? TERMS_VERSION,
        description: LABELS["terms.accepted"],
      },
      {
        ...base,
        event_type: "privacy.accepted",
        document_version: meta.privacy_version ?? PRIVACY_VERSION,
        description: LABELS["privacy.accepted"],
      },
      {
        ...base,
        event_type: "age.confirmed",
        document_version: null,
        description: LABELS["age.confirmed"],
      },
      {
        ...base,
        event_type: marketedIn ? "marketing.opted_in" : "marketing.opted_out",
        document_version: null,
        description: marketedIn ? LABELS["marketing.opted_in"] : LABELS["marketing.opted_out"],
      },
    ];

    const { error } = await sb.from("compliance_log").insert(rows);
    if (error) throw error;

    // The phone number was also collected on the form and previously lost on
    // this path. Only fill a blank — never overwrite something the user has
    // since set on their profile.
    const phone = meta.phone?.trim();
    if (phone) {
      const { data: profile } = await sb
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.phone) {
        await sb.from("profiles").update({ phone }).eq("id", user.id);
      }
    }
  } catch (e) {
    // Consent recording must never stop someone reaching their account.
    console.error("[compliance] failed to record sign-up consent", e);
  }
}
