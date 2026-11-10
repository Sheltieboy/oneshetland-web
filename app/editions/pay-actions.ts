"use server";

/** Start a payment for an Edition package, a membership or Edition participation. The client sends an id and an idempotency token only; the amount is decided by the database. */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/editions/rules";
import { isUuid } from "@/lib/editions/validate";
import { paymentsMode } from "@/lib/editions/payments.server";

export type PayResult =
  | { ok: true; mode: "simulated"; chargePence: number | null }
  | { ok: true; mode: "stripe"; clientSecret: string; chargePence: number | null }
  | { ok: false; error: string };

const KINDS = ["order", "participation", "membership"] as const;
type Kind = (typeof KINDS)[number];

export async function startPayment(kind: string, id: string, attempt: string): Promise<PayResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again to continue." };
  if (!(KINDS as readonly string[]).includes(kind) || !isUuid(id) || typeof attempt !== "string" || attempt.length < 8 || attempt.length > 80) return { ok: false, error: "That payment could not be started." };
  const k = kind as Kind;
  if (paymentsMode() === "simulated") {
    const { data, error } = await sb.rpc("edition_local_simulate_payment", { p_kind: k, p_id: id, p_attempt: attempt });
    if (error) return { ok: false, error: friendlyError(error.message) };
    revalidateAll();
    return { ok: true, mode: "simulated", chargePence: Number((data as { charge_pence?: number } | null)?.charge_pence ?? NaN) || null };
  }
  const { data, error } = await sb.functions.invoke("create-edition-checkout", { body: { kind: k, id, attempt } });
  if (error || !data) return { ok: false, error: "Card payments are not available yet. Please try again later." };
  const d = data as { client_secret?: string; error?: string; charge_pence?: number };
  if (d.error) return { ok: false, error: friendlyError(d.error) };
  if (!d.client_secret) return { ok: false, error: "The payment could not be started." };
  return { ok: true, mode: "stripe", clientSecret: d.client_secret, chargePence: d.charge_pence ?? null };
}

/** After Stripe confirms in the browser, the webhook does the real work; this only refreshes what the person sees. */
export async function afterPayment(): Promise<void> {
  // only a signed-in person can ask for a refresh: an anonymous caller must not be able to purge cached pages on demand
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user) revalidateAll();
}

function revalidateAll() {
  revalidatePath("/account/editions");
  revalidatePath("/business", "layout");
  revalidatePath("/organise", "layout");
  revalidatePath("/editions", "layout");
}
