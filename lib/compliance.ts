import { createClient } from "@/lib/supabase/client";

/** Mirrors the app's compliance event types (lib/compliance.ts in the app). */
export type ComplianceEventType =
  | "email.verified"
  | "terms.accepted"
  | "privacy.accepted"
  | "marketing.opted_in"
  | "marketing.opted_out"
  | "age.confirmed"
  | "password.changed"
  | "email.changed"
  | "data.export_requested"
  | "account.deletion_req";

type LogInput = {
  eventType: ComplianceEventType;
  documentVersion?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

const LABELS: Record<ComplianceEventType, string> = {
  "email.verified": "Confirmed email address",
  "terms.accepted": "Accepted Terms of Service",
  "privacy.accepted": "Accepted Privacy Policy",
  "marketing.opted_in": "Opted into marketing emails",
  "marketing.opted_out": "Declined marketing emails",
  "age.confirmed": "Confirmed 18 or over",
  "password.changed": "Changed password",
  "email.changed": "Changed email address",
  "data.export_requested": "Requested a data export",
  "account.deletion_req": "Requested account deletion",
};

/** Immutable consent audit log — fire-and-forget, never surfaces to the user.
 *  Requires an authenticated session (RLS: user_id = auth.uid()). */
export async function logCompliance(input: LogInput): Promise<void> {
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;

    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    await sb.from("compliance_log").insert({
      user_id: user.id,
      user_email: user.email ?? "",
      user_name: profile?.full_name ?? null,
      event_type: input.eventType,
      document_version: input.documentVersion ?? null,
      description: input.description ?? LABELS[input.eventType],
      metadata: { source: "web", ...(input.metadata ?? {}) },
    });
  } catch {
    // Non-fatal.
  }
}

export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";
