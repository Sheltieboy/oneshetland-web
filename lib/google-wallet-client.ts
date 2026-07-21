"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Fetch a "Save to Google Wallet" link for a loyalty card from the
 * google-wallet-pass edge function and open it. Works on Android and desktop.
 */
export async function addToGoogleWallet(): Promise<void> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Please sign in first.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${base}/functions/v1/google-wallet-pass`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.saveUrl) throw new Error(body?.error ?? "Could not create your Wallet pass.");
  window.open(body.saveUrl as string, "_blank");
}
