"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Fetch a signed .pkpass for a loyalty card from the apple-wallet-pass edge
 * function and hand it to the browser. On iOS Safari a .pkpass opens the
 * "Add to Apple Wallet" sheet; on desktop it downloads.
 */
export async function addToAppleWallet(): Promise<void> {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Please sign in first.");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${base}/functions/v1/apple-wallet-pass`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });
  if (!res.ok) {
    let msg = "Could not create your Wallet pass.";
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "oneshetland.pkpass";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
